/**
 * SCORE DE BONNE AFFAIRE — dealScore() ∈ [0, 100]
 *
 * Déterministe, basé UNIQUEMENT sur des faits vérifiés (historique, concurrents,
 * fiabilité, disponibilité). Ne prédit JAMAIS le futur.
 *
 * Composantes (total 100) :
 *  - position historique (40) : où se situe le prix actuel entre le min et le max 90 j
 *  - écart avec la moyenne 30 j (20)
 *  - position concurrentielle (15) : rapport avec le meilleur prix concurrent
 *  - fiabilité de l'offre (15) : EXACT > PARTIAL > UNVERIFIABLE
 *  - disponibilité (10) : en stock > précommande > indisponible
 *
 * Historique insuffisant -> composantes historiques neutres (30/60) + drapeau.
 */

import type { FinalPriceResult } from "@/lib/types";

export interface DealScoreThresholds {
  excellent: number;
  good: number;
  fair: number;
  normal: number;
}

export const DEFAULT_THRESHOLDS: DealScoreThresholds = {
  excellent: 90,
  good: 75,
  fair: 60,
  normal: 40
};

export interface DealScoreInput {
  /** Prix final en centimes, null si non vérifiable. */
  finalPrice: number | null;
  confidence: FinalPriceResult["confidence"];
  availability: "IN_STOCK" | "PREORDER" | "OUT_OF_STOCK" | "UNKNOWN";
  history: {
    min90: number | null;
    max90: number | null;
    avg30: number | null;
    dataPoints: number;
  };
  /** Meilleur prix final concurrent en centimes (hors marchand courant), null si aucun. */
  bestCompetitorPrice: number | null;
}

export interface DealScoreResult {
  score: number;
  label: string;
  /** Composantes détaillées pour l'interface. */
  breakdown: {
    history: number;
    vsAverage: number;
    competition: number;
    reliability: number;
    availability: number;
  };
  historyInsufficient: boolean;
}

function labelFor(score: number, t: DealScoreThresholds): string {
  if (score >= t.excellent) return "EXCELLENTE AFFAIRE";
  if (score >= t.good) return "TRÈS BON PRIX";
  if (score >= t.fair) return "BON PRIX";
  if (score >= t.normal) return "PRIX NORMAL";
  return "PRIX ÉLEVÉ";
}

export function dealScore(
  input: DealScoreInput,
  thresholds: DealScoreThresholds = DEFAULT_THRESHOLDS
): DealScoreResult {
  const { finalPrice, confidence, availability, history, bestCompetitorPrice } = input;

  // Prix non vérifiable ou indisponible : aucun score honnête possible.
  if (finalPrice === null || finalPrice <= 0 || availability === "OUT_OF_STOCK") {
    return {
      score: 0,
      label: "NON ÉVALUABLE",
      breakdown: { history: 0, vsAverage: 0, competition: 0, reliability: 0, availability: 0 },
      historyInsufficient: history.dataPoints < 7
    };
  }

  // --- Composante 1 : position dans l'historique 90 j (40 pts)
  let historyScore: number;
  const hasHistory =
    history.min90 !== null && history.max90 !== null && history.min90 < history.max90;
  const historyInsufficient = history.dataPoints < 7;
  if (!hasHistory) {
    historyScore = 30; // neutre : pas assez de données pour juger
  } else {
    const range = history.max90! - history.min90!;
    const position = (history.max90! - finalPrice) / range; // 1 = au minimum
    historyScore = Math.round(position * 40);
  }

  // --- Composante 2 : écart avec la moyenne 30 j (20 pts)
  let vsAverage: number;
  if (history.avg30 === null || history.avg30 <= 0 || historyInsufficient) {
    vsAverage = 10; // neutre
  } else {
    const deltaPct = (history.avg30 - finalPrice) / history.avg30;
    // -10 % vs moyenne -> ~20 pts ; +10 % -> ~0 pt ; linéaire, borné
    vsAverage = Math.max(0, Math.min(20, Math.round(10 + deltaPct * 100)));
  }

  // --- Composante 3 : position concurrentielle (15 pts)
  let competition: number;
  if (bestCompetitorPrice === null || bestCompetitorPrice <= 0) {
    competition = 8; // neutre : pas de concurrent connu
  } else {
    const ratio = bestCompetitorPrice / finalPrice; // >1 : nous moins chers
    if (ratio >= 1.1) competition = 15;
    else if (ratio >= 1.0) competition = 12;
    else if (ratio >= 0.95) competition = 7;
    else competition = 2; // nettement plus cher que le meilleur concurrent
  }

  // --- Composante 4 : fiabilité (15 pts)
  const reliability =
    confidence === "EXACT" ? 15 : confidence === "PARTIAL" ? 10 : 0;

  // --- Composante 5 : disponibilité (10 pts)
  const availabilityScore =
    availability === "IN_STOCK" ? 10 : availability === "PREORDER" ? 5 : availability === "UNKNOWN" ? 3 : 0;

  const score = Math.max(0, Math.min(100, historyScore + vsAverage + competition + reliability + availabilityScore));

  return {
    score,
    label: labelFor(score, thresholds),
    breakdown: {
      history: historyScore,
      vsAverage,
      competition,
      reliability,
      availability: availabilityScore
    },
    historyInsufficient
  };
}
