/**
 * SERVICE D'ALERTES — CRUD + vérification périodique.
 *
 * - createAlert : valide via Zod (createAlertSchema) côté API, ici via Prisma.
 * - checkAlerts : parcourt les alertes actives, recalcule les prix, évalue,
 *   crée une Notification par déclenchement, et marque l'alerte notifiée
 *   (lastTriggeredAt) pour éviter le spam.
 * - Canal V1 : notification WEB (table Notification, consultable).
 *   Email / mobile : architecture prête (channel), non implémentés.
 */

import { prisma } from "@/lib/db/client";
import { evaluateAlert, type AlertType } from "@/lib/alerts/evaluate";
import { compareWithAverage, computeHistoryStats, type PricePoint } from "@/lib/history/stats";
import { dealScore } from "@/lib/price-engine/deal-score";

export const EXCELLENT_DEAL_THRESHOLD = 90;

export interface CreateAlertInput {
  userId: string;
  productId: string;
  type: AlertType;
  /** En centimes. */
  targetPrice: number | null;
  frequencyHours: number;
}

export async function createAlert(input: CreateAlertInput) {
  return prisma.alert.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      type: input.type,
      targetPriceCents: input.targetPrice,
      frequencyHours: input.frequencyHours,
      active: true
    }
  });
}

export async function listAlerts(userId: string) {
  return prisma.alert.findMany({
    where: { userId },
    include: { product: { select: { id: true, title: true, imageUrl: true } } },
    orderBy: { createdAt: "desc" }
  });
}

export async function deleteAlert(userId: string, alertId: string): Promise<boolean> {
  const result = await prisma.alert.deleteMany({
    where: { id: alertId, userId } // un utilisateur ne supprime que SES alertes
  });
  return result.count > 0;
}

/**
 * Vérifie toutes les alertes actives dont la fréquence est échue.
 * Retourne le nombre d'alertes déclenchées (notifications créées).
 * Ne déclenche JAMAIS sur un prix non vérifiable.
 */
export async function checkAlerts(now: Date = new Date()): Promise<number> {
  const alerts = await prisma.alert.findMany({
    where: {
      active: true,
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lte: new Date(now.getTime() - 60 * 60 * 1000) } }
      ]
    },
    include: { product: true }
  });

  let triggeredCount = 0;

  for (const alert of alerts) {
    // Meilleure offre vérifiable actuelle du produit
    const offers = await prisma.offer.findMany({
      where: { productId: alert.productId, finalPriceCents: { not: null } },
      orderBy: { finalPriceCents: "asc" }
    });
    const currentPrice = offers.length > 0 ? offers[0].finalPriceCents : null;

    // Prix avec meilleur coupon vérifié applicable (V1 : pas de coupons eBay)
    const currentPriceWithCoupon = currentPrice; // sans coupon connu = identique

    // Meilleur prix historique hors aujourd'hui
    const historyRows = await prisma.priceHistory.findMany({
      where: { productId: alert.productId },
      orderBy: { timestamp: "asc" }
    });
    const points: PricePoint[] = historyRows
      .filter((h) => h.finalPriceCents !== null)
      .map((h) => ({ finalPrice: h.finalPriceCents as number, timestamp: h.timestamp }));
    const stats = computeHistoryStats(points, now);
    const historicalBest = stats.min90;

    // Score de bonne affaire
    const bestOffer = offers[0];
    const score = bestOffer
      ? dealScore({
          finalPrice: bestOffer.finalPriceCents,
          confidence: bestOffer.confidence as "EXACT" | "PARTIAL" | "UNVERIFIABLE",
          availability: bestOffer.availability as "IN_STOCK" | "PREORDER" | "OUT_OF_STOCK" | "UNKNOWN",
          history: {
            min90: stats.min90,
            max90: stats.max90,
            avg30: stats.avg30,
            dataPoints: stats.count90
          },
          bestCompetitorPrice: offers.length > 1 ? offers[1].finalPriceCents : null
        })
      : null;

    const evaluation = evaluateAlert({
      type: alert.type as AlertType,
      targetPrice: alert.targetPriceCents,
      currentPrice,
      currentPriceWithCoupon,
      historicalBestPrice: historicalBest,
      dealScoreValue: score ? score.score : null,
      excellentThreshold: EXCELLENT_DEAL_THRESHOLD
    });

    if (evaluation.triggered && evaluation.reason) {
      const oldPrice = historicalBest;
      const newPrice = currentPrice ?? currentPriceWithCoupon;
      await prisma.notification.create({
        data: {
          userId: alert.userId,
          alertId: alert.id,
          channel: "WEB",
          title: `Alerte prix : ${alert.product.title}`,
          body: evaluation.reason,
          data: {
            productId: alert.productId,
            oldPrice,
            newPrice,
            saving: oldPrice !== null && newPrice !== null ? oldPrice - newPrice : null,
            merchantId: bestOffer?.merchantId ?? null,
            offerUrl: bestOffer?.url ?? null,
            verifiedAt: now.toISOString()
          }
        }
      });
      triggeredCount += 1;
    }

    await prisma.alert.update({
      where: { id: alert.id },
      data: { lastCheckedAt: now, lastTriggeredAt: evaluation.triggered ? now : alert.lastTriggeredAt }
    });
  }

  return triggeredCount;
}

/** Notifications non lues d'un utilisateur. */
export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
}
