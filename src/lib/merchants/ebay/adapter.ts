/**
 * ADAPTER eBay — Browse API (api.ebay.com).
 *
 * Source RÉELLE et légale : OAuth client credentials (App ID + Cert ID).
 * Endpoint : GET /buy/browse/v1/item_summary/search?q=...
 *
 * Limites documentées (V1) :
 * - Les résultats ne contiennent PAS d'EAN -> le matching reste basé sur le
 *   titre, plafonné à 75 (sous le seuil de fusion 80). Aucune fusion
 *   automatique sans identifiant unique : les offres restent liées à la
 *   recherche et le matchScore est affiché.
 * - Pas de promotions ni coupons (l'API ne les expose pas).
 * - Disponibilité : souvent UNKNOWN (conditionIds partiels).
 * - Livraison : shippingOptions parfois absents -> prix final null
 *   (confidence UNVERIFIABLE), affiché "Prix non vérifiable".
 * - marketplace = true : les vendeurs tiers eBay sont la norme.
 *
 * Auth : POST https://api.ebay.com/identity/v1/oauth2/token
 *        grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope
 */

import type {
  MerchantAdapter,
  MerchantOfferRaw,
  MerchantSearchQuery,
  MerchantSearchResult,
  MerchantStatus
} from "@/lib/merchants/types";
import type { ShippingInfo } from "@/lib/types";

const EBAY_BASE = "https://api.ebay.com";

interface EbayTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: EbayTokenCache | null = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.token;
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${EBAY_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });
  if (!response.ok) {
    throw new Error(`eBay OAuth échoué (${response.status})`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}

/** Traduit les options de livraison eBay en ShippingInfo. JAMAIS inventé. */
function mapShipping(item: EbayItemSummary): ShippingInfo {
  const option = item.shippingOptions?.[0];
  if (!option) return { status: "UNKNOWN" };
  const cost = option.shippingCost?.value ?? option.fullShippingCost?.value;
  if (cost === undefined || cost === null) return { status: "UNKNOWN" };
  if (parseFloat(cost) === 0) return { status: "FREE", cost: 0 };
  return { status: "PAID", cost: Math.round(parseFloat(cost) * 100) };
}

/** Traduit les conditions eBay en Availability. */
function mapAvailability(item: EbayItemSummary): "IN_STOCK" | "UNKNOWN" {
  // eBay expose conditionId mais pas le stock temps réel. Les offres actives
  // avec achat immédiat sont présumées commandables.
  if (item.buyingOptions?.includes("FIXED_PRICE")) return "IN_STOCK";
  return "UNKNOWN";
}

export function mapItem(item: EbayItemSummary): MerchantOfferRaw {
  const price = item.price?.value;
  return {
    merchantProductId: item.itemId,
    title: item.title ?? "Titre indisponible",
    displayedPriceCents:
      price !== undefined && price !== null ? Math.round(parseFloat(price) * 100) : null,
    currency: item.price?.currency ?? "EUR",
    availability: mapAvailability(item),
    shipping: mapShipping(item),
    url: item.itemWebUrl ?? null,
    image: item.image?.imageUrl ?? null,
    ean: null, // l'API Browse ne retourne pas d'EAN dans search — jamais inventé
    manufacturerRef: null,
    brand: item.brand ?? null,
    marketplace: true
  };
}

/** Réponse eBay (sous-ensemble des champs utilisés). */
export interface EbayItemSummary {
  itemId: string;
  title?: string;
  price?: { value: string; currency: string };
  shippingOptions?: Array<{
    shippingCost?: { value: string; currency: string };
    fullShippingCost?: { value: string; currency: string };
  }>;
  buyingOptions?: string[];
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  brand?: string;
  conditionId?: string;
}

export interface EbayAdapterOptions {
  clientId: string;
  clientSecret: string;
  /** EBAY_FR par défaut. */
  marketplaceId: string;
}

export class EbayAdapter implements MerchantAdapter {
  readonly id = "ebay";
  readonly name = "eBay";
  readonly requiredEnv = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_MARKETPLACE_ID"];

  private constructor(private readonly options: EbayAdapterOptions) {}

  /** Retourne l'adapter si l'environnement est complet, sinon null. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): EbayAdapter | null {
    const clientId = env.EBAY_CLIENT_ID;
    const clientSecret = env.EBAY_CLIENT_SECRET;
    const marketplaceId = env.EBAY_MARKETPLACE_ID ?? "EBAY_FR";
    if (!clientId || !clientSecret) return null;
    return new EbayAdapter({ clientId, clientSecret, marketplaceId });
  }

  status(): MerchantStatus {
    const missing: string[] = [];
    if (!process.env.EBAY_CLIENT_ID) missing.push("EBAY_CLIENT_ID");
    if (!process.env.EBAY_CLIENT_SECRET) missing.push("EBAY_CLIENT_SECRET");
    return {
      id: this.id,
      name: this.name,
      configured: missing.length === 0,
      missingEnv: missing.length > 0 ? missing : undefined,
      note: "Browse API — gratuite (quota limité 5 000 appels/jour). Nécessite un compte développeur eBay."
    };
  }

  async searchProduct(query: MerchantSearchQuery): Promise<MerchantSearchResult> {
    const started = Date.now();
    try {
      const token = await getAccessToken(this.options.clientId, this.options.clientSecret);
      const url = new URL(`${EBAY_BASE}/buy/browse/v1/item_summary/search`);
      url.searchParams.set("q", query.query);
      url.searchParams.set("limit", String(Math.min(query.limit, 50)));
      url.searchParams.set("buyingOption", "FIXED_PRICE");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": this.options.marketplaceId
        }
      });

      if (response.status === 429) {
        return {
          status: "RATE_LIMITED",
          error: "Quota eBay atteint — réessayer plus tard",
          offers: [],
          durationMs: Date.now() - started
        };
      }
      if (!response.ok) {
        return {
          status: "SOURCE_UNAVAILABLE",
          error: `eBay Browse API erreur ${response.status}`,
          offers: [],
          durationMs: Date.now() - started
        };
      }

      const data = (await response.json()) as { itemSummaries?: EbayItemSummary[] };
      const offers = (data.itemSummaries ?? []).map(mapItem);
      return { status: "OK", offers, durationMs: Date.now() - started };
    } catch (error) {
      return {
        status: "SOURCE_UNAVAILABLE",
        error: error instanceof Error ? error.message : "Erreur inconnue eBay",
        offers: [],
        durationMs: Date.now() - started
      };
    }
  }
}
