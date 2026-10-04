/**
 * Types fondamentaux — Price Hunter
 *
 * RÈGLE ABSOLUE : un prix non vérifiable n'est JAMAIS inventé.
 * Toute valeur monétaire est un entier en centimes (minor units) pour éviter
 * toute erreur de virgule flottante. 418.99 € = 41899.
 */

export const EUR = "EUR";

export interface Money {
  /** Montant en centimes (entier). Ex : 41899 = 418,99 €. */
  amount: number;
  currency: string;
}

export function money(amount: number, currency = EUR): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Montant invalide (doit être en centimes entiers) : ${amount}`);
  }
  return { amount, currency };
}

/** Convertit une saisie utilisateur en centimes. "418,99" -> 41899 */
export function parseAmountToCents(input: string): number {
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Montant invalide : ${input}`);
  }
  return Math.round(value * 100);
}

export function formatCents(cents: number | null | undefined, currency = EUR): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

/**
 * Une condition est soit vérifiable par l'application (MIN_BASKET avec le
 * montant du panier connu), soit non vérifiable (UNKNOWN / LOYALTY externe…).
 * - satisfied = true  -> condition remplie, vérifiée par l'application
 * - satisfied = false -> condition NON remplie, vérifiée
 * - satisfied = null  -> condition NON VÉRIFIABLE -> réduction "potentielle"
 */
export interface PriceCondition {
  type:
    | "MIN_BASKET"
    | "NEW_CUSTOMER"
    | "LOYALTY"
    | "MEMBERSHIP"
    | "SUBSCRIPTION"
    | "UNKNOWN";
  /** Seuil éventuel en centimes (MIN_BASKET). */
  value?: number;
  description?: string;
  satisfied: boolean | null;
}

/* ------------------------------------------------------------------ */
/* Réductions et coupons                                               */
/* ------------------------------------------------------------------ */

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "EXPIRED" | "INVALID";

export interface Discount {
  id?: string;
  label: string;
  /** En centimes, positif. */
  amount: number;
  kind: "IMMEDIATE" | "PROMOTION" | "COUPON";
  conditions: PriceCondition[];
  verificationStatus: VerificationStatus;
}

export interface Cashback {
  /** En centimes, positif. */
  amount: number;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "CONDITIONAL" | "INVALID";
  conditions: PriceCondition[];
}

export type ShippingInfo =
  | { status: "FREE"; cost: 0 }
  | { status: "PAID"; cost: number; freeThreshold?: number | null }
  | { status: "UNKNOWN" }
  | { status: "CALCULATED_AT_CHECKOUT" };

export type Availability = "IN_STOCK" | "PREORDER" | "OUT_OF_STOCK" | "UNKNOWN";

/* ------------------------------------------------------------------ */
/* Moteur de prix                                                      */
/* ------------------------------------------------------------------ */

export interface FinalPriceInput {
  /** Prix affiché par le marchand, en centimes. */
  displayedPrice: Money;
  /** Réductions immédiates et promotions. */
  discounts: Discount[];
  /** Codes promo. */
  coupons: Discount[];
  shipping: ShippingInfo;
  /** Frais obligatoires (recupel, éco-participation, service imposé…). */
  mandatoryFees: Money[];
  cashback: Cashback | null;
  /** Devise acceptée. V1 : EUR uniquement. */
  acceptedCurrency?: string;
}

export interface PotentialItem {
  label: string;
  amount: number;
  reason: "CONDITION_NON_VERIFIABLE" | "CODE_NON_VERIFIE" | "CASHBACK_CONDITIONNEL" | "MIN_BASKET_NON_ATTEINT";
}

export interface FinalPriceResult {
  /** Prix affiché, en centimes. */
  displayedPrice: number;
  /** Total des réductions APPLIQUÉES (immédiates + promotions), en centimes. */
  discounts: number;
  /** Total des codes promo APPLIQUÉS, en centimes. */
  couponDiscount: number;
  /** Frais de livraison en centimes, null si inconnus. */
  shipping: number | null;
  /** Frais obligatoires en centimes. */
  mandatoryFees: number;
  /** Cashback APPLIQUÉ en centimes (uniquement si vérifié). */
  cashback: number;
  /** Prix final réellement payable, en centimes. null = non calculable. */
  finalPrice: number | null;
  currency: string;
  /**
   * EXACT     : prix final totalement vérifié (livraison connue, tout vérifié)
   * PARTIAL    : prix calculable mais des éléments non vérifiés existent
   *              (réductions potentielles listées)
   * UNVERIFIABLE : livraison inconnue -> aucun prix final affiché
   */
  confidence: "EXACT" | "PARTIAL" | "UNVERIFIABLE";
  /** Réductions/cashback non appliqués mais possibles. */
  potential: PotentialItem[];
  /** Raisons techniques si finalPrice est null. */
  unverifiedReasons: string[];
  verifiedAt: string;
}

/* ------------------------------------------------------------------ */
/* Erreurs                                                             */
/* ------------------------------------------------------------------ */

export class CurrencyMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(`Devise non supportée : ${actual} (acceptée : ${expected})`);
    this.name = "CurrencyMismatchError";
  }
}

export class SourceUnavailableError extends Error {
  constructor(source: string) {
    super(`Source indisponible : ${source}`);
    this.name = "SourceUnavailableError";
  }
}
