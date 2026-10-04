/**
 * CONTRAT MARCHAND — MerchantAdapter
 *
 * Chaque source de prix doit implémenter cette interface. Un marchand NON
 * configuré retourne SOURCE_UNAVAILABLE ou API_KEY_REQUIRED : JAMAIS de
 * données inventées. Un marchand non implémenté retourne NOT_IMPLEMENTED.
 */

import type { Availability, ShippingInfo } from "@/lib/types";

export type SourceStatus =
  | "OK"
  | "SOURCE_UNAVAILABLE"
  | "API_KEY_REQUIRED"
  | "NOT_IMPLEMENTED"
  | "RATE_LIMITED";

export interface MerchantOfferRaw {
  /** Identifiant du produit chez ce marchand. */
  merchantProductId: string;
  title: string;
  /** Prix affiché en centimes. null = prix non récupérable. */
  displayedPriceCents: number | null;
  currency: string;
  availability: Availability;
  shipping: ShippingInfo;
  /** URL de l'offre (jamais inventée). */
  url: string | null;
  image?: string | null;
  /** EAN si fourni par la source. */
  ean?: string | null;
  /** Référence fabricant / MPN si fournie. */
  manufacturerRef?: string | null;
  /** Marque si fournie. */
  brand?: string | null;
  /** true = offre marketplace (vendeur tiers sur la plateforme). */
  marketplace?: boolean;
}

export interface MerchantSearchQuery {
  query: string;
  /** Nombre maximum de résultats demandés. */
  limit: number;
}

export interface MerchantSearchResult {
  status: SourceStatus;
  /** Message d'erreur lisible si status != OK. */
  error?: string;
  offers: MerchantOfferRaw[];
  /** Durée de l'appel en ms (journalisation). */
  durationMs?: number;
}

export interface MerchantStatus {
  /** Identifiant stable du marchand (ex: "ebay"). */
  id: string;
  name: string;
  /** true si les clés API nécessaires sont présentes dans l'environnement. */
  configured: boolean;
  /** Description de ce qui manque, le cas échéant. */
  missingEnv?: string[];
  note?: string;
}

export interface MerchantAdapter {
  readonly id: string;
  readonly name: string;
  /** Variables d'environnement nécessaires. */
  readonly requiredEnv: string[];

  searchProduct(query: MerchantSearchQuery): Promise<MerchantSearchResult>;

  /**
   * Détail d'une offre. Par défaut : recherché via searchProduct.
   * Les sources sans API de détail le laissent non implémenté.
   */
  getProduct?(merchantProductId: string): Promise<MerchantSearchResult>;

  /** Liste des coupons connus pour ce marchand. V1 : la plupart n'en ont pas. */
  getCoupons?(): Promise<[]>;

  /** Statut de configuration (clés présentes ou non). */
  status(): MerchantStatus;
}
