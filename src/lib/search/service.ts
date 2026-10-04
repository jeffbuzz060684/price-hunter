/**
 * SERVICE DE RECHERCHE — orchestration.
 *
 * 1. Interroge uniquement les marchands CONFIGURÉS (clés présentes).
 * 2. Source indisponible -> statut explicite affiché, jamais de données inventées.
 * 3. Calcule le prix final (moteur déterministe) pour chaque offre.
 * 4. Regroupe les offres par produit (matchScore >= seuil requis par identifiant).
 * 5. Persiste produits/offres/historique via Prisma.
 */

import { prisma } from "@/lib/db/client";
import { calculateFinalPrice } from "@/lib/price-engine/engine";
import { matchScore } from "@/lib/product-matching/match";
import { getConfiguredAdapters, getMerchantStatus } from "@/lib/merchants/registry";
import type { MerchantOfferRaw, MerchantSearchResult } from "@/lib/merchants/types";
import type { FinalPriceResult } from "@/lib/types";
import { money } from "@/lib/types";

export interface OfferWithPrice {
  raw: MerchantOfferRaw;
  finalPrice: FinalPriceResult;
  merchantId: string;
  merchantName: string;
}

export interface ProductCluster {
  /** Titre canonique = titre de la meilleure offre du cluster. */
  title: string;
  image: string | null;
  offers: OfferWithPrice[];
  /** Meilleur prix final vérifiable du cluster (null si aucun vérifiable). */
  bestFinalPrice: number | null;
  /** Score de matching de la meilleure paire (affiché pour transparence). */
  matchScore: number;
}

export interface SearchOutcome {
  /** "ok" = au moins une source a répondu. */
  status: "ok" | "no_source";
  query: string;
  clusters: ProductCluster[];
  /** Statut par marchand — pour afficher honnêtement ce qui n'a pas marché. */
  sources: Array<{ merchantId: string; merchantName: string; status: string; error?: string }>;
  searchedAt: string;
}

/** Calcule le prix final d'une offre brute. Ne simule jamais. */
export function computeOfferPrice(offer: MerchantOfferRaw): FinalPriceResult {
  if (offer.displayedPriceCents === null || offer.displayedPriceCents <= 0) {
    // Prix non récupérable -> résultat explicitement non vérifiable
    return {
      displayedPrice: offer.displayedPriceCents ?? 0,
      discounts: 0,
      couponDiscount: 0,
      shipping: null,
      mandatoryFees: 0,
      cashback: 0,
      finalPrice: null,
      currency: offer.currency,
      confidence: "UNVERIFIABLE",
      potential: [],
      unverifiedReasons: ["Prix non récupérable depuis la source"],
      verifiedAt: new Date().toISOString()
    };
  }
  return calculateFinalPrice({
    displayedPrice: money(offer.displayedPriceCents, offer.currency),
    discounts: [],
    coupons: [],
    shipping: offer.shipping,
    mandatoryFees: [],
    cashback: null,
    acceptedCurrency: "EUR"
  });
}

/**
 * Regroupe les offres en clusters de produits.
 * eBay ne fournit pas d'EAN : le matching titre est plafonné à 75 par
 * matchScore (< seuil 80). On regroupe donc uniquement si les titres sont
 * très similaires (score >= 70) : regroupement affichage, jamais fusion
 * silencieuse d'identités distinctes.
 */
export function clusterOffers(offers: OfferWithPrice[]): ProductCluster[] {
  const clusters: ProductCluster[] = [];
  for (const offer of offers) {
    let bestCluster: { cluster: ProductCluster; score: number } | null = null;
    for (const cluster of clusters) {
      const score = matchScore(
        { title: cluster.title },
        { title: offer.raw.title, eans: offer.raw.ean ? [offer.raw.ean] : undefined }
      ).score;
      if (score >= 70 && (!bestCluster || score > bestCluster.score)) {
        bestCluster = { cluster, score };
      }
    }
    if (bestCluster) {
      bestCluster.cluster.offers.push(offer);
      bestCluster.cluster.matchScore = Math.max(bestCluster.cluster.matchScore, bestCluster.score);
      bestCluster.cluster.bestFinalPrice = bestCluster.cluster.offers.reduce(
        (best, o) => (o.finalPrice.finalPrice !== null && (best === null || o.finalPrice.finalPrice < best)) ? o.finalPrice.finalPrice : best,
        bestCluster.cluster.bestFinalPrice
      );
    } else {
      clusters.push({
        title: offer.raw.title,
        image: offer.raw.image ?? null,
        offers: [offer],
        bestFinalPrice: offer.finalPrice.finalPrice,
        matchScore: 100
      });
    }
  }
  return clusters;
}

/** Interroge un adapter avec gestion d'erreurs contrôlée. */
async function searchMerchant(
  merchant: { id: string; name: string; searchProduct(q: { query: string; limit: number }): Promise<MerchantSearchResult> },
  query: string,
  limit: number
): Promise<{ merchantId: string; merchantName: string; result: MerchantSearchResult }> {
  const result = await merchant.searchProduct({ query, limit });
  return { merchantId: merchant.id, merchantName: merchant.name, result };
}

/**
 * Recherche publique : interroge les sources configurées et retourne les
 * clusters, SANS persistance (utilisée par /api/search en mode "live").
 * La persistance (produit créé + alerte) passe par la page produit.
 */
export async function searchProducts(query: string, limit = 20): Promise<SearchOutcome> {
  const adapters = getConfiguredAdapters();
  const statuses = getMerchantStatus();
  const sources: SearchOutcome["sources"] = [];

  // Aucune source configurée : on liste honnêtement ce qui manque.
  if (adapters.length === 0) {
    for (const s of statuses) {
      if (!s.configured) {
        sources.push({
          merchantId: s.id,
          merchantName: s.name,
          status: "API_KEY_REQUIRED",
          error: `Clés manquantes : ${(s.missingEnv ?? []).join(", ")}`
        });
      }
    }
    return {
      status: "no_source",
      query,
      clusters: [],
      sources,
      searchedAt: new Date().toISOString()
    };
  }

  const results = await Promise.allSettled(
    adapters.map((a) => searchMerchant(a, query, limit))
  );

  const offers: OfferWithPrice[] = [];
  for (const settled of results) {
    if (settled.status === "fulfilled") {
      const { merchantId, merchantName, result } = settled.value;
      sources.push({
        merchantId,
        merchantName,
        status: result.status,
        error: result.error
      });
      if (result.status === "OK") {
        for (const raw of result.offers) {
          offers.push({ raw, finalPrice: computeOfferPrice(raw), merchantId, merchantName });
        }
      }
    } else {
      sources.push({
        merchantId: "unknown",
        merchantName: "inconnu",
        status: "SOURCE_UNAVAILABLE",
        error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason)
      });
    }
  }

  return {
    status: sources.some((s) => s.status === "OK") ? "ok" : "no_source",
    query,
    clusters: clusterOffers(offers),
    sources,
    searchedAt: new Date().toISOString()
  };
}

/**
 * Persiste un cluster de recherche en base : Merchant (upsert), Product,
 * ProductIdentifier, Offer, PriceHistory. Retourne l'id du produit.
 * Les erreurs de base sont propagées (jamais ignorées silencieusement).
 */
export async function persistSearchOutcome(outcome: SearchOutcome, firstClusterIndex = 0): Promise<string | null> {
  const cluster = outcome.clusters[firstClusterIndex];
  if (!cluster || cluster.offers.length === 0) return null;

  const best = cluster.offers[0];
  const merchantId = `merchant:${best.merchantId}`;

  const merchant = await prisma.merchant.upsert({
    where: { id: merchantId },
    create: { id: merchantId, name: best.merchantName },
    update: {}
  });

  const product = await prisma.product.create({
    data: {
      title: cluster.title,
      imageUrl: cluster.image
    }
  });

  await prisma.productIdentifier.createMany({
    data: [
      {
        productId: product.id,
        type: "TITLE",
        value: cluster.title,
        normalizedValue: cluster.title
      }
    ]
  });

  for (const offer of cluster.offers) {
    const created = await prisma.offer.create({
      data: {
        productId: product.id,
        merchantId: merchant.id,
        merchantProductId: offer.raw.merchantProductId,
        title: offer.raw.title,
        displayedPriceCents: offer.raw.displayedPriceCents,
        currency: offer.raw.currency,
        availability: offer.raw.availability,
        shippingStatus: offer.raw.shipping.status,
        shippingCents: offer.raw.shipping.status === "PAID" ? offer.raw.shipping.cost : offer.raw.shipping.status === "FREE" ? 0 : null,
        finalPriceCents: offer.finalPrice.finalPrice,
        confidence: offer.finalPrice.confidence,
        url: offer.raw.url,
        marketplace: offer.raw.marketplace ?? false,
        lastCheckedAt: new Date()
      }
    });

    if (offer.finalPrice.finalPrice !== null) {
      await prisma.priceHistory.create({
        data: {
          offerId: created.id,
          productId: product.id,
          merchantId: merchant.id,
          priceCents: offer.raw.displayedPriceCents,
          shippingCents: offer.finalPrice.shipping,
          finalPriceCents: offer.finalPrice.finalPrice,
          promotionCents: offer.finalPrice.discounts,
          couponCents: offer.finalPrice.couponDiscount,
          timestamp: new Date()
        }
      });
    }
  }

  return product.id;
}
