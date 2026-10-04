/**
 * TESTS COUPONS — sélection déterministe du meilleur code applicable.
 * Un coupon EXPIRED ou INVALID n'est JAMAIS présenté comme utilisable.
 */

import { describe, expect, it } from "vitest";
import {
  couponToDiscount,
  couponValueCents,
  isExpired,
  pickBestCoupon,
  type CouponRecord
} from "@/lib/coupons/coupons";

function coupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: "c1",
    merchantId: "merchant:ebay",
    code: "BIENVENUE",
    discountType: "FIXED",
    discountValue: 2000,
    minimumBasket: null,
    expirationDate: null,
    conditions: null,
    source: "test",
    verificationStatus: "VERIFIED",
    lastVerifiedAt: null,
    ...overrides
  };
}

describe("couponValueCents()", () => {
  it("FIXED : montant fixe", () => {
    expect(couponValueCents(coupon({ discountType: "FIXED", discountValue: 2000 }), 50000)).toBe(2000);
  });

  it("FIXED : plafonné au panier (jamais de prix négatif)", () => {
    expect(couponValueCents(coupon({ discountType: "FIXED", discountValue: 2000 }), 1000)).toBe(1000);
  });

  it("PERCENT : pourcentage arrondi", () => {
    expect(
      couponValueCents(coupon({ discountType: "PERCENT", discountValue: 10 }), 41899)
    ).toBe(4190);
  });
});

describe("isExpired()", () => {
  it("date passée -> expiré", () => {
    expect(isExpired(coupon({ expirationDate: new Date("2026-01-01") }), new Date("2026-10-04"))).toBe(true);
  });

  it("date future -> valide", () => {
    expect(isExpired(coupon({ expirationDate: new Date("2027-01-01") }), new Date("2026-10-04"))).toBe(false);
  });

  it("sans date -> jamais expiré par date", () => {
    expect(isExpired(coupon({ expirationDate: null }), new Date())).toBe(false);
  });
});

describe("pickBestCoupon()", () => {
  const now = new Date("2026-10-04T12:00:00Z");

  it("choisit le meilleur coupon VÉRIFIÉ applicable", () => {
    const selection = pickBestCoupon(
      50000,
      [
        coupon({ id: "a", code: "PROMO10", discountValue: 1000 }),
        coupon({ id: "b", code: "PROMO50", discountValue: 5000 })
      ],
      now
    );
    expect(selection.best?.code).toBe("PROMO50");
  });

  it("égalité de montant -> tri alphabétique déterministe", () => {
    const selection = pickBestCoupon(
      50000,
      [
        coupon({ code: "ZEBRA", discountValue: 2000 }),
        coupon({ code: "ALPHA", discountValue: 2000 })
      ],
      now
    );
    expect(selection.best?.code).toBe("ALPHA");
  });

  it("coupon EXPIRED rejeté avec raison", () => {
    const selection = pickBestCoupon(
      50000,
      [coupon({ id: "x", code: "VIEUX", verificationStatus: "EXPIRED" })],
      now
    );
    expect(selection.best).toBeNull();
    expect(selection.rejected.length).toBe(1);
    expect(selection.rejected[0].reason).toBe("Coupon expiré");
  });

  it("tous les rejets d'expiration portent la même raison", () => {
    const selection = pickBestCoupon(
      50000,
      [
        coupon({ id: "x1", verificationStatus: "EXPIRED" }),
        coupon({ id: "x2", expirationDate: new Date("2025-01-01") })
      ],
      now
    );
    expect(selection.rejected.length).toBe(2);
    expect(selection.rejected.every((r) => r.reason === "Coupon expiré")).toBe(true);
  });

  it("coupon INVALID rejeté", () => {
    const selection = pickBestCoupon(
      50000,
      [coupon({ verificationStatus: "INVALID" })],
      now
    );
    expect(selection.rejected[0].reason).toBe("Coupon invalide");
  });

  it("coupon UNVERIFIED -> potentiel, jamais meilleur", () => {
    const selection = pickBestCoupon(
      50000,
      [coupon({ verificationStatus: "UNVERIFIED" })],
      now
    );
    expect(selection.best).toBeNull();
    expect(selection.potentials.length).toBe(1);
  });

  it("panier minimum non atteint -> rejet honnête", () => {
    const selection = pickBestCoupon(
      5000,
      [coupon({ minimumBasket: 10000 })],
      now
    );
    expect(selection.best).toBeNull();
    expect(selection.rejected[0].reason).toBe("Panier minimum non atteint");
  });

  it("panier minimum atteint -> applicable", () => {
    const selection = pickBestCoupon(
      10000,
      [coupon({ minimumBasket: 10000 })],
      now
    );
    expect(selection.best?.code).toBe("BIENVENUE");
  });

  it("aucun coupon -> best null", () => {
    expect(pickBestCoupon(50000, [], now).best).toBeNull();
  });
});

describe("couponToDiscount()", () => {
  it("produit un Discount COUPON avec le bon montant", () => {
    const d = couponToDiscount(coupon(), 50000);
    expect(d.kind).toBe("COUPON");
    expect(d.amount).toBe(2000);
    expect(d.verificationStatus).toBe("VERIFIED");
  });

  it("condition MIN_BASKET remplie quand le panier atteint le seuil", () => {
    const d = couponToDiscount(coupon({ minimumBasket: 10000 }), 10000);
    expect(d.conditions[0].type).toBe("MIN_BASKET");
    expect(d.conditions[0].satisfied).toBe(true);
  });

  it("condition MIN_BASKET non remplie sinon", () => {
    const d = couponToDiscount(coupon({ minimumBasket: 10000 }), 9999);
    expect(d.conditions[0].satisfied).toBe(false);
  });
});
