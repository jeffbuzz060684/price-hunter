/**
 * TESTS MOTEUR DE PRIX — calculateFinalPrice, money, formatCents.
 * Référence spec : 499 € − 50 € promo − 30 € coupon + 9,99 € livraison
 * − 10 € cashback = 418,99 € (41899 centimes).
 */

import { describe, expect, it } from "vitest";
import {
  CurrencyMismatchError,
  formatCents,
  money,
  parseAmountToCents,
  type Discount,
  type FinalPriceInput
} from "@/lib/types";
import { calculateFinalPrice, shippingCostCents } from "@/lib/price-engine/engine";

function verifiedDiscount(amount: number, label = "Promotion", kind: Discount["kind"] = "PROMOTION"): Discount {
  return { label, amount, kind, conditions: [], verificationStatus: "VERIFIED" };
}

function pivotInput(): FinalPriceInput {
  return {
    displayedPrice: money(49900),
    discounts: [verifiedDiscount(5000, "Promo -50 €")],
    coupons: [verifiedDiscount(3000, "Code promo -30 €", "COUPON")],
    shipping: { status: "PAID", cost: 999 },
    mandatoryFees: [],
    cashback: { amount: 1000, verificationStatus: "VERIFIED", conditions: [] },
    acceptedCurrency: "EUR"
  };
}

describe("money()", () => {
  it("crée un montant en centimes", () => {
    expect(money(41899)).toEqual({ amount: 41899, currency: "EUR" });
  });

  it("accepte une devise explicite", () => {
    expect(money(100, "USD").currency).toBe("USD");
  });

  it("rejette un montant non entier (jamais de centime approximatif)", () => {
    expect(() => money(418.99)).toThrow();
  });

  it("rejette NaN", () => {
    expect(() => money(Number.NaN)).toThrow();
  });
});

describe("parseAmountToCents()", () => {
  it('convertit "418,99" en 41899', () => {
    expect(parseAmountToCents("418,99")).toBe(41899);
  });

  it('convertit "400" en 40000', () => {
    expect(parseAmountToCents("400")).toBe(40000);
  });

  it('tolère les espaces : "1 234,56" -> 123456', () => {
    expect(parseAmountToCents("1 234,56")).toBe(123456);
  });

  it("rejette une saisie non numérique", () => {
    expect(() => parseAmountToCents("abc")).toThrow();
  });

  it("rejette un montant négatif", () => {
    expect(() => parseAmountToCents("-5")).toThrow();
  });
});

describe("formatCents()", () => {
  it("formate 41899 en euros français", () => {
    expect(formatCents(41899)).toContain("418,99");
  });

  it("affiche un tiret pour null", () => {
    expect(formatCents(null)).toBe("—");
  });

  it("affiche un tiret pour undefined", () => {
    expect(formatCents(undefined)).toBe("—");
  });
});

describe("shippingCostCents()", () => {
  it("livraison gratuite -> 0", () => {
    expect(shippingCostCents({ status: "FREE", cost: 0 })).toBe(0);
  });

  it("livraison payante -> coût exact", () => {
    expect(shippingCostCents({ status: "PAID", cost: 999 })).toBe(999);
  });

  it("livraison inconnue -> null (jamais estimée)", () => {
    expect(shippingCostCents({ status: "UNKNOWN" })).toBeNull();
  });

  it("livraison calculée au paiement -> null", () => {
    expect(shippingCostCents({ status: "CALCULATED_AT_CHECKOUT" })).toBeNull();
  });
});

describe("calculateFinalPrice() — cas de référence", () => {
  it("pivot spec : 499 − 50 − 30 + 9,99 − 10 = 418,99 €", () => {
    const result = calculateFinalPrice(pivotInput());
    expect(result.displayedPrice).toBe(49900);
    expect(result.discounts).toBe(5000);
    expect(result.couponDiscount).toBe(3000);
    expect(result.shipping).toBe(999);
    expect(result.mandatoryFees).toBe(0);
    expect(result.cashback).toBe(1000);
    expect(result.finalPrice).toBe(41899);
    expect(result.confidence).toBe("EXACT");
    expect(result.potential).toEqual([]);
  });

  it("livraison gratuite -> prix final sans frais", () => {
    const input = pivotInput();
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.shipping).toBe(0);
    expect(result.finalPrice).toBe(40900);
    expect(result.confidence).toBe("EXACT");
  });

  it("livraison inconnue -> finalPrice null, UNVERIFIABLE", () => {
    const input = pivotInput();
    input.shipping = { status: "UNKNOWN" };
    const result = calculateFinalPrice(input);
    expect(result.finalPrice).toBeNull();
    expect(result.confidence).toBe("UNVERIFIABLE");
    expect(result.unverifiedReasons.length).toBeGreaterThan(0);
  });

  it("livraison calculée au paiement -> finalPrice null avec raison honnête", () => {
    const input = pivotInput();
    input.shipping = { status: "CALCULATED_AT_CHECKOUT" };
    const result = calculateFinalPrice(input);
    expect(result.finalPrice).toBeNull();
    expect(result.unverifiedReasons.join(" ")).toContain("paiement");
  });

  it("devise non EUR -> CurrencyMismatchError (jamais de conversion inventée)", () => {
    const input = pivotInput();
    input.displayedPrice = money(49900, "USD");
    expect(() => calculateFinalPrice(input)).toThrow(CurrencyMismatchError);
  });

  it("frais obligatoires ajoutés au prix final", () => {
    const input = pivotInput();
    input.mandatoryFees = [money(150)];
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.mandatoryFees).toBe(150);
    expect(result.finalPrice).toBe(41050);
  });

  it("verifiedAt est une date ISO valide", () => {
    const result = calculateFinalPrice(pivotInput());
    expect(Number.isNaN(Date.parse(result.verifiedAt))).toBe(false);
  });
});

describe("calculateFinalPrice() — réductions et conditions", () => {
  it("coupon UNVERIFIED -> jamais appliqué, listé potentiel, PARTIAL", () => {
    const input = pivotInput();
    input.coupons = [verifiedDiscount(2000, "Code mystère", "COUPON")];
    input.coupons[0].verificationStatus = "UNVERIFIED";
    const result = calculateFinalPrice(input);
    expect(result.couponDiscount).toBe(0);
    expect(result.potential.length).toBe(1);
    expect(result.potential[0].reason).toBe("CODE_NON_VERIFIE");
    expect(result.confidence).toBe("PARTIAL");
  });

  it("coupon EXPIRED -> jamais appliqué, jamais listé utilisable", () => {
    const input = pivotInput();
    input.coupons = [];
    input.discounts = [verifiedDiscount(5000)];
    input.discounts[0].verificationStatus = "EXPIRED";
    const result = calculateFinalPrice(input);
    expect(result.discounts).toBe(0);
    expect(result.potential.length).toBe(0);
  });

  it("coupon INVALID -> ignoré", () => {
    const input = pivotInput();
    input.coupons = [verifiedDiscount(3000, "Code refusé", "COUPON")];
    input.coupons[0].verificationStatus = "INVALID";
    const result = calculateFinalPrice(input);
    expect(result.couponDiscount).toBe(0);
    expect(result.potential.length).toBe(0);
  });

  it("promotion avec condition vérifiée remplie -> appliquée", () => {
    const input = pivotInput();
    input.discounts = [{
      label: "Offre étudiante",
      amount: 4000,
      kind: "PROMOTION",
      conditions: [{ type: "MEMBERSHIP", satisfied: true }],
      verificationStatus: "VERIFIED"
    }];
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.discounts).toBe(4000);
    expect(result.confidence).toBe("EXACT");
  });

  it("MIN_BASKET non atteint (vérifié) -> réduction potentielle, pas appliquée", () => {
    const input = pivotInput();
    input.discounts = [{
      label: "-20 € dès 100 €",
      amount: 2000,
      kind: "PROMOTION",
      conditions: [{ type: "MIN_BASKET", value: 10000, satisfied: false }],
      verificationStatus: "VERIFIED"
    }];
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.discounts).toBe(0);
    expect(result.potential[0].reason).toBe("MIN_BASKET_NON_ATTEINT");
    expect(result.confidence).toBe("PARTIAL");
  });

  it("condition non vérifiable (satisfied null) -> réduction potentielle", () => {
    const input = pivotInput();
    input.discounts = [{
      label: "Offre fidélité",
      amount: 1500,
      kind: "PROMOTION",
      conditions: [{ type: "LOYALTY", satisfied: null }],
      verificationStatus: "VERIFIED"
    }];
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.discounts).toBe(0);
    expect(result.potential[0].reason).toBe("CONDITION_NON_VERIFIABLE");
  });

  it("condition vérifiée NON remplie (hors panier) -> réduction écartée", () => {
    const input = pivotInput();
    input.discounts = [{
      label: "Nouveau client",
      amount: 1000,
      kind: "IMMEDIATE",
      conditions: [{ type: "NEW_CUSTOMER", satisfied: false }],
      verificationStatus: "VERIFIED"
    }];
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.discounts).toBe(0);
    expect(result.potential.length).toBe(0);
  });

  it("réduction de montant nul ignorée", () => {
    const input = pivotInput();
    input.discounts = [verifiedDiscount(0)];
    input.shipping = { status: "FREE", cost: 0 };
    const result = calculateFinalPrice(input);
    expect(result.discounts).toBe(0);
    expect(result.potential.length).toBe(0);
  });
});

describe("calculateFinalPrice() — cashback", () => {
  it("cashback VÉRIFIÉ sans condition -> appliqué", () => {
    const input = pivotInput();
    input.coupons = [];
    input.discounts = [];
    input.shipping = { status: "FREE", cost: 0 };
    input.cashback = { amount: 1000, verificationStatus: "VERIFIED", conditions: [] };
    expect(calculateFinalPrice(input).cashback).toBe(1000);
  });

  it("cashback CONDITIONNEL -> potentiel, non appliqué", () => {
    const input = pivotInput();
    input.coupons = [];
    input.discounts = [];
    input.shipping = { status: "FREE", cost: 0 };
    input.cashback = { amount: 500, verificationStatus: "CONDITIONAL", conditions: [] };
    const result = calculateFinalPrice(input);
    expect(result.cashback).toBe(0);
    expect(result.potential[0].reason).toBe("CASHBACK_CONDITIONNEL");
  });

  it("cashback VÉRIFIÉ avec condition non remplie -> zéro, sans potentiel", () => {
    const input = pivotInput();
    input.coupons = [];
    input.discounts = [];
    input.shipping = { status: "FREE", cost: 0 };
    input.cashback = {
      amount: 500,
      verificationStatus: "VERIFIED",
      conditions: [{ type: "SUBSCRIPTION", satisfied: false }]
    };
    const result = calculateFinalPrice(input);
    expect(result.cashback).toBe(0);
    expect(result.potential.length).toBe(0);
  });

  it("cashback INVALID -> ignoré", () => {
    const input = pivotInput();
    input.coupons = [];
    input.discounts = [];
    input.shipping = { status: "FREE", cost: 0 };
    input.cashback = { amount: 500, verificationStatus: "INVALID", conditions: [] };
    const result = calculateFinalPrice(input);
    expect(result.cashback).toBe(0);
    expect(result.potential.length).toBe(0);
  });
});
