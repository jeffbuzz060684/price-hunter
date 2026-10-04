/**
 * TESTS EDGE CASES — limites et invariants anti-simulation.
 * Ce fichier n'importe NI zod NI prisma : il tourne dans le harnais local
 * sans node_modules (les tests Zod vivent dans validation.test.ts, CI only).
 */

import { describe, expect, it } from "vitest";
import {
  formatCents,
  money,
  parseAmountToCents,
  SourceUnavailableError,
  type Discount,
  type FinalPriceInput
} from "@/lib/types";
import { calculateFinalPrice } from "@/lib/price-engine/engine";
import { matchScore } from "@/lib/product-matching/match";
import { couponValueCents, type CouponRecord } from "@/lib/coupons/coupons";

describe("invariants montants", () => {
  it("jamais de montant flottant : money() refuse le dixième de centime", () => {
    expect(() => money(41899.5)).toThrow();
  });

  it('"0" est un montant valide (0 centime)', () => {
    expect(parseAmountToCents("0")).toBe(0);
  });

  it("grands montants exacts en centimes", () => {
    expect(money(99999999).amount).toBe(99999999);
    expect(formatCents(99999999)).toContain("999");
  });

  it("SourceUnavailableError porte le nom de la source", () => {
    const e = new SourceUnavailableError("amazon");
    expect(e.message).toContain("amazon");
    expect(e.name).toBe("SourceUnavailableError");
  });
});

describe("invariants moteur de prix", () => {
  it("prix final jamais négatif, même avec un coupon supérieur au prix", () => {
    const input: FinalPriceInput = {
      displayedPrice: money(100),
      discounts: [],
      coupons: [
        { label: "Gros coupon", amount: 50000, kind: "COUPON", conditions: [], verificationStatus: "VERIFIED" }
      ],
      shipping: { status: "FREE", cost: 0 },
      mandatoryFees: [],
      cashback: null
    };
    expect(calculateFinalPrice(input).finalPrice).toBe(0);
  });

  it("toutes les réductions EXPIRED -> prix final = affiché + frais réels", () => {
    const expired: Discount = {
      label: "Promo obsolète",
      amount: 5000,
      kind: "PROMOTION",
      conditions: [],
      verificationStatus: "EXPIRED"
    };
    const result = calculateFinalPrice({
      displayedPrice: money(30000),
      discounts: [expired],
      coupons: [{ ...expired, kind: "COUPON" }],
      shipping: { status: "PAID", cost: 500 },
      mandatoryFees: [],
      cashback: null
    });
    expect(result.finalPrice).toBe(30500);
    expect(result.confidence).toBe("EXACT");
  });

  it("livraison inconnue + coupon non vérifié : aucune estimation du total", () => {
    const result = calculateFinalPrice({
      displayedPrice: money(30000),
      discounts: [],
      coupons: [
        { label: "Code non vérifié", amount: 3000, kind: "COUPON", conditions: [], verificationStatus: "UNVERIFIED" }
      ],
      shipping: { status: "UNKNOWN" },
      mandatoryFees: [],
      cashback: null
    });
    expect(result.finalPrice).toBeNull();
    expect(result.confidence).toBe("UNVERIFIABLE");
    expect(result.potential.length).toBe(1);
  });

  it("frais obligatoires en devise étrangère -> erreur explicite", () => {
    expect(() =>
      calculateFinalPrice({
        displayedPrice: money(30000),
        discounts: [],
        coupons: [],
        shipping: { status: "FREE", cost: 0 },
        mandatoryFees: [money(100, "USD")],
        cashback: null
      })
    ).toThrow();
  });
});

describe("invariants matching", () => {
  it("EAN-13 vs EAN-8 : formats différents, valeurs différentes -> rejet dur", () => {
    const r = matchScore({ eans: ["3610000000000"] }, { eans: ["12345678"] });
    expect(r.score).toBe(0);
    expect(r.hardReject).toBe(true);
  });

  it('EAN "n/a" filtré : jamais traité comme identifiant', () => {
    // les deux côtés n'ont que des pseudo-EAN : on retombe sur le titre
    const r = matchScore(
      { eans: ["n/a"], title: "Casque Sony WH-1000XM5" },
      { eans: ["n/a"], title: "Casque Sony WH-1000XM5" }
    );
    expect(r.hardReject).toBeFalsy();
    expect(r.score).toBeGreaterThan(0);
  });

  it("titres unicode accentués normalisés avant comparaison", () => {
    const r = matchScore(
      { title: "Casque Écouteurs À Réduction" },
      { title: "casque ecouteurs a reduction" }
    );
    expect(r.score).toBe(75);
  });
});

describe("invariants coupons", () => {
  it("pourcentage supérieur à 100 % : valeur proportionnelle au panier", () => {
    const c: CouponRecord = {
      id: "c",
      merchantId: "merchant:ebay",
      code: "FOU",
      discountType: "PERCENT",
      discountValue: 150,
      minimumBasket: null,
      expirationDate: null,
      conditions: null,
      source: "test",
      verificationStatus: "VERIFIED",
      lastVerifiedAt: null
    };
    expect(couponValueCents(c, 20000)).toBe(30000); // 150 % du panier
  });
});
