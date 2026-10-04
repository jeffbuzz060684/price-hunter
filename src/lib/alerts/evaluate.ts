/**
 * ÉVALUATION DES ALERTES — evaluateAlert()
 *
 * RÈGLES CRITIQUES :
 * - JAMAIS de déclenchement si le prix n'est pas vérifiable (null).
 * - NEW_BEST_PRICE exige un historique de prix (sinon pas de référence).
 * - BELOW_PRICE_WITH_COUPON ne se déclenche que si le prix AVEC coupon
 *   appliqué est vérifié (VERIFIED, panier minimum atteint).
 */

import { matchScore } from "@/lib/product-matching/match";

export type AlertType = "BELOW_PRICE" | "NEW_BEST_PRICE" | "BELOW_PRICE_WITH_COUPON" | "EXCELLENT_DEAL";

export interface AlertEvaluation {
  /** true si l'alerte doit être déclenchée et une notification envoyée. */
  triggered: boolean;
  /** Justification lisible (affichée dans la notification). */
  reason: string | null;
  /** Prix de référence en centimes (déclenché/ancien meilleur), null si aucun. */
  referencePrice: number | null;
}

export interface AlertInput {
  type: AlertType;
  /** Seuil en centimes pour BELOW_PRICE / BELOW_PRICE_WITH_COUPON. */
  targetPrice: number | null;
  /** Prix final actuel en centimes, null = non vérifiable. */
  currentPrice: number | null;
  /** Prix final AVEC meilleur coupon applicable (verifiable), null sinon. */
  currentPriceWithCoupon: number | null;
  /** Meilleur prix final historique connu (hors offre courante), null si aucun. */
  historicalBestPrice: number | null;
  /** Score de bonne affaire actuel (dealScore), null si non évaluable. */
  dealScoreValue: number | null;
  /** Seuil configurable "excellente affaire" (défaut 90). */
  excellentThreshold: number;
}

export function evaluateAlert(input: AlertInput): AlertEvaluation {
  const {
    type,
    targetPrice,
    currentPrice,
    currentPriceWithCoupon,
    historicalBestPrice,
    dealScoreValue,
    excellentThreshold
  } = input;

  switch (type) {
    case "BELOW_PRICE": {
      if (currentPrice === null) {
        return { triggered: false, reason: "Prix non vérifiable — aucune alerte", referencePrice: null };
      }
      if (targetPrice === null) {
        return { triggered: false, reason: "Seuil manquant", referencePrice: null };
      }
      const triggered = currentPrice <= targetPrice;
      return {
        triggered,
        reason: triggered
          ? `Prix final ${currentPrice} sous le seuil ${targetPrice}`
          : null,
        referencePrice: triggered ? targetPrice : null
      };
    }

    case "NEW_BEST_PRICE": {
      if (currentPrice === null) {
        return { triggered: false, reason: "Prix non vérifiable — aucune alerte", referencePrice: null };
      }
      if (historicalBestPrice === null) {
        return { triggered: false, reason: "Pas encore d'historique — aucune référence", referencePrice: null };
      }
      const triggered = currentPrice < historicalBestPrice;
      return {
        triggered,
        reason: triggered
          ? `Nouveau meilleur prix : ${currentPrice} (ancien meilleur : ${historicalBestPrice})`
          : null,
        referencePrice: triggered ? historicalBestPrice : null
      };
    }

    case "BELOW_PRICE_WITH_COUPON": {
      if (currentPriceWithCoupon === null) {
        return {
          triggered: false,
          reason: "Prix avec coupon non vérifiable — aucune alerte",
          referencePrice: null
        };
      }
      if (targetPrice === null) {
        return { triggered: false, reason: "Seuil manquant", referencePrice: null };
      }
      const triggered = currentPriceWithCoupon <= targetPrice;
      return {
        triggered,
        reason: triggered
          ? `Prix avec coupon ${currentPriceWithCoupon} sous le seuil ${targetPrice}`
          : null,
        referencePrice: triggered ? targetPrice : null
      };
    }

    case "EXCELLENT_DEAL": {
      if (dealScoreValue === null) {
        return { triggered: false, reason: "Score non évaluable — aucune alerte", referencePrice: null };
      }
      const triggered = dealScoreValue >= excellentThreshold;
      return {
        triggered,
        reason: triggered ? `Excellente affaire détectée (score ${dealScoreValue})` : null,
        referencePrice: null
      };
    }
  }
}

/** Comparaison de deux produits pour l'appartenance à une alerte. */
export function alertMatchesProduct(alertProductId: string, offerProductId: string): boolean {
  return alertProductId === offerProductId;
}

/** Utilitaire : vérifie qu'une offre correspond au produit d'une alerte (matching doux). */
export function offerMatchesIdentity(
  alertIdentity: Parameters<typeof matchScore>[0],
  offerIdentity: Parameters<typeof matchScore>[0]
): boolean {
  return matchScore(alertIdentity, offerIdentity).score >= 90;
}
