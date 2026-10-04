/**
 * COUPONS — sélection déterministe du meilleur code promo applicable.
 *
 * Statuts (spec §11) : VERIFIED / UNVERIFIED / EXPIRED / INVALID.
 * Un code EXPIRED ou INVALID n'est JAMAIS présenté comme utilisable.
 */

import type { Discount, PriceCondition, VerificationStatus } from "@/lib/types";

export type CouponDiscountType = "FIXED" | "PERCENT";

export interface CouponRecord {
  id: string;
  merchantId: string;
  code: string;
  discountType: CouponDiscountType;
  /** FIXED : centimes. PERCENT : pourcentage entier. */
  discountValue: number;
  /** Panier minimum en centimes. */
  minimumBasket: number | null;
  expirationDate: Date | null;
  conditions: string | null;
  source: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: Date | null;
}

export interface CouponSelection {
  /** Meilleur coupon applicable (VERIFIED, non expiré, panier minimum atteint). */
  best: CouponRecord | null;
  /** Coupons non expirés mais non vérifiés -> présentés comme "potentiels". */
  potentials: CouponRecord[];
  /** Coupons écartés, avec raison. */
  rejected: Array<{ coupon: CouponRecord; reason: string }>;
}

export function isExpired(coupon: CouponRecord, now: Date): boolean {
  return coupon.expirationDate !== null && coupon.expirationDate.getTime() <= now.getTime();
}

/** Valeur du coupon en centimes pour un panier donné. */
export function couponValueCents(coupon: CouponRecord, basketCents: number): number {
  if (coupon.discountType === "FIXED") {
    return Math.min(coupon.discountValue, basketCents);
  }
  return Math.round((basketCents * coupon.discountValue) / 100);
}

/**
 * Sélectionne le meilleur coupon pour un panier donné.
 * Déterministe : tri par montant décroissant, puis code alphabétique.
 */
export function pickBestCoupon(
  basketCents: number,
  coupons: CouponRecord[],
  now: Date = new Date()
): CouponSelection {
  const potentials: CouponRecord[] = [];
  const rejected: CouponSelection["rejected"] = [];
  const usable: CouponRecord[] = [];

  for (const coupon of coupons) {
    if (coupon.verificationStatus === "EXPIRED" || isExpired(coupon, now)) {
      rejected.push({ coupon, reason: "Coupon expiré" });
      continue;
    }
    if (coupon.verificationStatus === "INVALID") {
      rejected.push({ coupon, reason: "Coupon invalide" });
      continue;
    }
    if (coupon.verificationStatus === "UNVERIFIED") {
      potentials.push(coupon);
      continue;
    }
    if (coupon.minimumBasket !== null && basketCents < coupon.minimumBasket) {
      rejected.push({ coupon, reason: "Panier minimum non atteint" });
      continue;
    }
    usable.push(coupon);
  }

  usable.sort((a, b) => {
    const va = couponValueCents(a, basketCents);
    const vb = couponValueCents(b, basketCents);
    if (vb !== va) return vb - va;
    return a.code.localeCompare(b.code);
  });

  return { best: usable[0] ?? null, potentials, rejected };
}

/** Convertit un coupon sélectionné en Discount pour le moteur de prix. */
export function couponToDiscount(coupon: CouponRecord, basketCents: number): Discount {
  const conditions: PriceCondition[] = [];
  if (coupon.minimumBasket !== null) {
    conditions.push({
      type: "MIN_BASKET",
      value: coupon.minimumBasket,
      satisfied: basketCents >= coupon.minimumBasket
    });
  }
  return {
    id: coupon.id,
    label: `Code promo ${coupon.code}`,
    amount: couponValueCents(coupon, basketCents),
    kind: "COUPON",
    conditions,
    verificationStatus: coupon.verificationStatus
  };
}
