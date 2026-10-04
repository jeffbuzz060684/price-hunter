/**
 * REGISTRE DES MARCHANDS.
 *
 * Ajouter un marchand = implémenter MerchantAdapter et l'enregistrer ici.
 * Aucune autre partie du système ne connaît les spécificités d'un marchand.
 *
 * V1 : eBay uniquement. Les autres sources (Amazon PA-API, Fnac, Cdiscount…)
 * ne sont PAS supportées : PA-API exige un compte affilié avec ventes
 * qualifiées ; les marchands français n'ont pas d'API publique de prix.
 * Ne JAMAIS déclarer un marchand supporté sans connecteur fonctionnel.
 */

import { EbayAdapter } from "@/lib/merchants/ebay/adapter";
import type { MerchantAdapter, MerchantStatus } from "@/lib/merchants/types";

/** Tous les marchands implémentés (configurés ou non). */
export function getMerchantAdapters(): MerchantAdapter[] {
  const adapters: MerchantAdapter[] = [];
  const ebay = EbayAdapter.fromEnv();
  if (ebay) adapters.push(ebay);
  return adapters;
}

/** Marchands configurés (clés présentes) — utilisés par la recherche. */
export function getConfiguredAdapters(): MerchantAdapter[] {
  return getMerchantAdapters().filter((a) => a.status().configured);
}

/** Statut de tous les marchands pour le tableau de bord / STATUS. */
export function getMerchantStatus(): MerchantStatus[] {
  const statuses: MerchantStatus[] = [];
  const ebayStatus = EbayAdapter.fromEnv()?.status() ?? {
    id: "ebay",
    name: "eBay",
    configured: false,
    missingEnv: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
    note: "Browse API — gratuite. Créer un compte sur developer.ebay.com."
  };
  statuses.push(ebayStatus);
  return statuses;
}
