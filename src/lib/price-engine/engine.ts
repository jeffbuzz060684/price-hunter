/**
 * MOTEUR DE PRIX — calculateFinalPrice()
 *
 * Déterministe, pur, entièrement testé. Ne simule jamais :
 * - une réduction dont une condition n'est pas vérifiable -> "potentielle"
 * - un code promo non vérifié -> jamais appliqué au prix final
 * - une livraison inconnue -> prix final = null (confidence UNVERIFIABLE)
 *
 * Exemple de référence (spec) :
 *   499 € affiché, -50 € promo, -30 € code promo, +9,99 € livraison, -10 € cashback
 *   = 418,99 € -> 41899 centimes.
 */

import {
  CurrencyMismatchError,
  type Discount,
  type FinalPriceInput,
  type FinalPriceResult,
  type PotentialItem,
  type ShippingInfo
} from "@/lib/types";

/** Statut d'application d'une réduction. */
type DiscountApplication =
  | { applied: true; amount: number }
  | { applied: false; amount: 0 }
  | { potential: true; amount: number; reason: PotentialItem["reason"] };

/**
 * Décide si une réduction est applicable.
 * - EXPIRED / INVALID / UNVERIFIED : jamais appliquée au prix final.
 *   UNVERIFIED est listée comme potentielle.
 * - condition satisfied=true  -> appliquée
 * - condition satisfied=false -> non appliquée
 * - condition satisfied=null  -> potentielle (non vérifiable)
 */
function resolveDiscount(discount: Discount): DiscountApplication {
  if (discount.verificationStatus === "EXPIRED" || discount.verificationStatus === "INVALID") {
    return { applied: false, amount: 0 };
  }
  if (discount.verificationStatus === "UNVERIFIED") {
    return { potential: true, amount: discount.amount, reason: "CODE_NON_VERIFIE" };
  }
  // VERIFIED : on vérifie chaque condition
  let potentialReason: PotentialItem["reason"] | null = null;
  for (const condition of discount.conditions) {
    if (condition.satisfied === null) {
      potentialReason =
        condition.type === "MIN_BASKET" ? "MIN_BASKET_NON_ATTEINT" : "CONDITION_NON_VERIFIABLE";
    } else if (condition.satisfied === false) {
      // condition vérifiée et NON remplie -> réduction non applicable
      return condition.type === "MIN_BASKET" && potentialReason === null
        ? { potential: true, amount: discount.amount, reason: "MIN_BASKET_NON_ATTEINT" }
        : { applied: false, amount: 0 };
    }
  }
  if (potentialReason !== null) {
    return { potential: true, amount: discount.amount, reason: potentialReason };
  }
  return { applied: true, amount: discount.amount };
}

/** Coût de livraison en centimes, null si inconnu. */
export function shippingCostCents(shipping: ShippingInfo): number | null {
  switch (shipping.status) {
    case "FREE":
      return 0;
    case "PAID":
      return shipping.cost;
    case "UNKNOWN":
    case "CALCULATED_AT_CHECKOUT":
      return null;
  }
}

export function calculateFinalPrice(input: FinalPriceInput): FinalPriceResult {
  const acceptedCurrency = input.acceptedCurrency ?? "EUR";
  const now = new Date().toISOString();

  // 1. Cohérence des devises — V1 : EUR uniquement, jamais de conversion inventée.
  for (const m of [input.displayedPrice, ...input.mandatoryFees]) {
    if (m.currency !== acceptedCurrency) {
      throw new CurrencyMismatchError(acceptedCurrency, m.currency);
    }
  }

  // 2. Réductions et coupons
  const appliedDiscounts: Discount[] = [];
  const potential: PotentialItem[] = [];
  let discountsTotal = 0;
  let couponTotal = 0;

  const process = (list: Discount[]) => {
    for (const d of list) {
      if (d.amount <= 0) continue; // une réduction nulle est ignorée
      const resolution = resolveDiscount(d);
      if ("applied" in resolution && resolution.applied) {
        appliedDiscounts.push(d);
        if (d.kind === "COUPON") couponTotal += d.amount;
        else discountsTotal += d.amount;
      } else if ("potential" in resolution && resolution.potential) {
        potential.push({ label: d.label, amount: d.amount, reason: resolution.reason });
      }
    }
  };
  process(input.discounts);
  process(input.coupons);

  // 3. Livraison
  const shipping = shippingCostCents(input.shipping);
  const unverifiedReasons: string[] = [];
  if (shipping === null) {
    unverifiedReasons.push(
      input.shipping.status === "CALCULATED_AT_CHECKOUT"
        ? "Frais de livraison calculés uniquement au moment du paiement"
        : "Frais de livraison inconnus"
    );
  }

  // 4. Frais obligatoires
  const feesTotal = input.mandatoryFees.reduce((sum, m) => sum + m.amount, 0);

  // 5. Cashback — appliqué uniquement si VÉRIFIÉ et conditions remplies.
  let cashbackApplied = 0;
  if (input.cashback) {
    const cb = input.cashback;
    if (cb.verificationStatus === "INVALID") {
      // ignoré
    } else if (cb.verificationStatus === "VERIFIED" && cb.conditions.every((c) => c.satisfied === true)) {
      cashbackApplied = cb.amount;
    } else if (cb.verificationStatus === "VERIFIED" && cb.conditions.some((c) => c.satisfied === false)) {
      // condition non remplie -> aucun cashback
    } else {
      potential.push({
        label: "Cashback",
        amount: cb.amount,
        reason: cb.verificationStatus === "CONDITIONAL" ? "CASHBACK_CONDITIONNEL" : "CONDITION_NON_VERIFIABLE"
      });
    }
  }

  // 6. Prix final
  const base = input.displayedPrice.amount - discountsTotal - couponTotal + feesTotal;
  const finalPrice = shipping === null ? null : Math.max(0, base + shipping - cashbackApplied);

  // 7. Confiance
  let confidence: FinalPriceResult["confidence"];
  if (finalPrice === null) {
    confidence = "UNVERIFIABLE";
  } else if (potential.length > 0) {
    confidence = "PARTIAL";
  } else {
    confidence = "EXACT";
  }

  return {
    displayedPrice: input.displayedPrice.amount,
    discounts: discountsTotal,
    couponDiscount: couponTotal,
    shipping,
    mandatoryFees: feesTotal,
    cashback: cashbackApplied,
    finalPrice,
    currency: acceptedCurrency,
    confidence,
    potential,
    unverifiedReasons,
    verifiedAt: now
  };
}
