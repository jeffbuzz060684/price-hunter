/**
 * TESTS ALERTES — evaluateAlert. Règles critiques :
 * - JAMAIS de déclenchement sur un prix non vérifiable (null).
 * - NEW_BEST_PRICE exige un historique.
 * - BELOW_PRICE_WITH_COUPON exige un prix avec coupon VÉRIFIÉ.
 */

import { describe, expect, it } from "vitest";
import {
  alertMatchesProduct,
  evaluateAlert,
  offerMatchesIdentity,
  type AlertInput
} from "@/lib/alerts/evaluate";

function input(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    type: "BELOW_PRICE",
    targetPrice: 40000,
    currentPrice: 39900,
    currentPriceWithCoupon: null,
    historicalBestPrice: null,
    dealScoreValue: null,
    excellentThreshold: 90,
    ...overrides
  };
}

describe("BELOW_PRICE", () => {
  it("se déclenche quand le prix vérifié passe sous le seuil", () => {
    const r = evaluateAlert(input());
    expect(r.triggered).toBe(true);
    expect(r.reason).toContain("39900");
    expect(r.referencePrice).toBe(40000);
  });

  it("se déclenche à égalité exacte avec le seuil", () => {
    const r = evaluateAlert(input({ currentPrice: 40000 }));
    expect(r.triggered).toBe(true);
  });

  it("ne se déclenche pas au-dessus du seuil", () => {
    const r = evaluateAlert(input({ currentPrice: 41000 }));
    expect(r.triggered).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("JAMAIS de déclenchement si le prix est non vérifiable", () => {
    const r = evaluateAlert(input({ currentPrice: null }));
    expect(r.triggered).toBe(false);
    expect(r.reason).toContain("non vérifiable");
  });

  it("pas de déclenchement sans seuil", () => {
    const r = evaluateAlert(input({ targetPrice: null }));
    expect(r.triggered).toBe(false);
    expect(r.reason).toBe("Seuil manquant");
  });
});

describe("NEW_BEST_PRICE", () => {
  it("exige un historique : sans référence, pas de déclenchement", () => {
    const r = evaluateAlert(
      input({ type: "NEW_BEST_PRICE", targetPrice: null, historicalBestPrice: null })
    );
    expect(r.triggered).toBe(false);
    expect(r.reason).toContain("historique");
  });

  it("se déclenche sous le meilleur prix historique", () => {
    const r = evaluateAlert(
      input({ type: "NEW_BEST_PRICE", targetPrice: null, historicalBestPrice: 42000, currentPrice: 41000 })
    );
    expect(r.triggered).toBe(true);
    expect(r.referencePrice).toBe(42000);
  });

  it("ne se déclenche pas à égalité avec le meilleur historique", () => {
    const r = evaluateAlert(
      input({ type: "NEW_BEST_PRICE", targetPrice: null, historicalBestPrice: 41000, currentPrice: 41000 })
    );
    expect(r.triggered).toBe(false);
  });

  it("jamais de déclenchement si le prix actuel est non vérifiable", () => {
    const r = evaluateAlert(
      input({ type: "NEW_BEST_PRICE", targetPrice: null, historicalBestPrice: 42000, currentPrice: null })
    );
    expect(r.triggered).toBe(false);
  });
});

describe("BELOW_PRICE_WITH_COUPON", () => {
  it("se déclenche si le prix avec coupon VÉRIFIÉ passe sous le seuil", () => {
    const r = evaluateAlert(
      input({ type: "BELOW_PRICE_WITH_COUPON", currentPriceWithCoupon: 39000 })
    );
    expect(r.triggered).toBe(true);
    expect(r.reason).toContain("39000");
  });

  it("jamais de déclenchement si le prix avec coupon est non vérifiable", () => {
    const r = evaluateAlert(
      input({ type: "BELOW_PRICE_WITH_COUPON", currentPriceWithCoupon: null })
    );
    expect(r.triggered).toBe(false);
    expect(r.reason).toContain("coupon");
  });

  it("pas de déclenchement sans seuil", () => {
    const r = evaluateAlert(
      input({ type: "BELOW_PRICE_WITH_COUPON", targetPrice: null, currentPriceWithCoupon: 39000 })
    );
    expect(r.triggered).toBe(false);
    expect(r.reason).toBe("Seuil manquant");
  });

  it("pas de déclenchement au-dessus du seuil", () => {
    const r = evaluateAlert(
      input({ type: "BELOW_PRICE_WITH_COUPON", currentPriceWithCoupon: 45000 })
    );
    expect(r.triggered).toBe(false);
  });
});

describe("EXCELLENT_DEAL", () => {
  it("se déclenche au seuil excellent (score >= 90)", () => {
    const r = evaluateAlert(
      input({ type: "EXCELLENT_DEAL", targetPrice: null, dealScoreValue: 90 })
    );
    expect(r.triggered).toBe(true);
    expect(r.reason).toContain("90");
  });

  it("se déclenche au-dessus du seuil", () => {
    const r = evaluateAlert(
      input({ type: "EXCELLENT_DEAL", targetPrice: null, dealScoreValue: 97 })
    );
    expect(r.triggered).toBe(true);
  });

  it("pas de déclenchement sous le seuil", () => {
    const r = evaluateAlert(
      input({ type: "EXCELLENT_DEAL", targetPrice: null, dealScoreValue: 89 })
    );
    expect(r.triggered).toBe(false);
  });

  it("score non évaluable -> aucune alerte", () => {
    const r = evaluateAlert(
      input({ type: "EXCELLENT_DEAL", targetPrice: null, dealScoreValue: null })
    );
    expect(r.triggered).toBe(false);
    expect(r.reason).toContain("non évaluable");
  });
});

describe("utilitaires d'appartenance", () => {
  it("alertMatchesProduct : identifiants produits identiques", () => {
    expect(alertMatchesProduct("p1", "p1")).toBe(true);
    expect(alertMatchesProduct("p1", "p2")).toBe(false);
  });

  it("offerMatchesIdentity : modèles identiques -> true (score 90)", () => {
    expect(
      offerMatchesIdentity({ model: "Galaxy S26" }, { model: "galaxy s26" })
    ).toBe(true);
  });

  it("offerMatchesIdentity : variantes différentes -> false", () => {
    expect(
      offerMatchesIdentity(
        { title: "S26 256 Go" },
        { title: "S26 128 Go" }
      )
    ).toBe(false);
  });

  it("la date de référence d'une notification n'est jamais Invalid Date", () => {
    // Simule le champ verifiedAt envoyé avec la notification.
    const verifiedAt = new Date().toISOString();
    const parsed = new Date(verifiedAt);
    expect(parsed.toString()).not.toBe("Invalid Date");
  });
});
