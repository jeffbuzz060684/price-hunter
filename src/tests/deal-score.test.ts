/**
 * TESTS DEAL SCORE — score de bonne affaire 0-100, basé uniquement sur des
 * faits vérifiés. Jamais de prédiction, jamais de score sur prix non vérifiable.
 */

import { describe, expect, it } from "vitest";
import {
  dealScore,
  DEFAULT_THRESHOLDS,
  type DealScoreInput
} from "@/lib/price-engine/deal-score";

function baseInput(overrides: Partial<DealScoreInput> = {}): DealScoreInput {
  return {
    finalPrice: 40000,
    confidence: "EXACT",
    availability: "IN_STOCK",
    history: { min90: null, max90: null, avg30: null, dataPoints: 0 },
    bestCompetitorPrice: null,
    ...overrides
  };
}

describe("dealScore() — cas non évaluables", () => {
  it("prix non vérifiable -> 0, NON ÉVALUABLE", () => {
    const r = dealScore(baseInput({ finalPrice: null }));
    expect(r.score).toBe(0);
    expect(r.label).toBe("NON ÉVALUABLE");
  });

  it("rupture de stock -> 0 (aucun score honnête possible)", () => {
    const r = dealScore(baseInput({ availability: "OUT_OF_STOCK" }));
    expect(r.score).toBe(0);
    expect(r.label).toBe("NON ÉVALUABLE");
  });

  it("prix nul -> 0", () => {
    const r = dealScore(baseInput({ finalPrice: 0 }));
    expect(r.score).toBe(0);
  });
});

describe("dealScore() — composantes", () => {
  it("sans historique ni concurrent : composantes neutres", () => {
    const r = dealScore(baseInput());
    expect(r.breakdown.history).toBe(30);
    expect(r.breakdown.vsAverage).toBe(10);
    expect(r.breakdown.competition).toBe(8);
    expect(r.breakdown.reliability).toBe(15);
    expect(r.breakdown.availability).toBe(10);
    expect(r.score).toBe(73);
    expect(r.label).toBe("BON PRIX");
    expect(r.historyInsufficient).toBe(true);
  });

  it("prix au minimum 90 j, sous la moyenne, moins cher que le concurrent -> EXCELLENTE", () => {
    const r = dealScore(
      baseInput({
        history: { min90: 40000, max90: 50000, avg30: 48000, dataPoints: 10 },
        bestCompetitorPrice: 44000
      })
    );
    expect(r.breakdown.history).toBe(40);
    expect(r.breakdown.competition).toBe(15);
    expect(r.score).toBe(100);
    expect(r.label).toBe("EXCELLENTE AFFAIRE");
    expect(r.historyInsufficient).toBe(false);
  });

  it("prix au maximum 90 j, fiabilité faible -> PRIX ÉLEVÉ", () => {
    const r = dealScore(
      baseInput({
        finalPrice: 50000,
        confidence: "UNVERIFIABLE",
        availability: "UNKNOWN",
        history: { min90: 40000, max90: 50000, avg30: 41000, dataPoints: 10 },
        bestCompetitorPrice: 45000
      })
    );
    expect(r.score).toBeLessThan(DEFAULT_THRESHOLDS.normal);
    expect(r.label).toBe("PRIX ÉLEVÉ");
  });

  it("historique insuffisant (< 7 points) -> drapeau even avec de bonnes données", () => {
    const r = dealScore(
      baseInput({
        history: { min90: 40000, max90: 50000, avg30: 41000, dataPoints: 3 }
      })
    );
    expect(r.historyInsufficient).toBe(true);
  });

  it("confiance PARTIAL -> fiabilité réduite (10)", () => {
    const r = dealScore(baseInput({ confidence: "PARTIAL" }));
    expect(r.breakdown.reliability).toBe(10);
  });

  it("confiance UNVERIFIABLE -> fiabilité 0", () => {
    const r = dealScore(baseInput({ confidence: "UNVERIFIABLE" }));
    expect(r.breakdown.reliability).toBe(0);
  });

  it("précommande -> 5 points de disponibilité", () => {
    const r = dealScore(baseInput({ availability: "PREORDER" }));
    expect(r.breakdown.availability).toBe(5);
  });

  it("nettement plus cher que le meilleur concurrent -> 2 points", () => {
    const r = dealScore(baseInput({ bestCompetitorPrice: 36000 }));
    expect(r.breakdown.competition).toBe(2);
  });

  it("léger avantage concurrentiel -> 12 points", () => {
    const r = dealScore(baseInput({ bestCompetitorPrice: 40400 }));
    expect(r.breakdown.competition).toBe(12);
  });
});

describe("dealScore() — bornes", () => {
  it("score toujours dans [0, 100]", () => {
    const r = dealScore(
      baseInput({
        history: { min90: 1000, max90: 100000, avg30: 100000, dataPoints: 30 },
        bestCompetitorPrice: 100000
      })
    );
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("seuils par défaut : excellent 90, good 75, fair 60, normal 40", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      excellent: 90,
      good: 75,
      fair: 60,
      normal: 40
    });
  });

  it("seuils personnalisés respectés", () => {
    const r = dealScore(baseInput(), { excellent: 70, good: 60, fair: 50, normal: 30 });
    expect(r.label).toBe("EXCELLENTE AFFAIRE");
  });
});
