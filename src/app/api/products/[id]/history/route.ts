/**
 * GET /api/products/[id]/history — points d'historique (prix finaux vérifiés
 * uniquement) + statistiques 7/30/90 jours + comparaison honnête à la moyenne.
 * Jamais de prédiction : uniquement des faits passés.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { compareWithAverage, computeHistoryStats, type PricePoint } from "@/lib/history/stats";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = idParamSchema.safeParse(params.id);
  if (!id.success) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: id.data },
      select: { id: true, title: true }
    });
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const rows = await prisma.priceHistory.findMany({
      where: { productId: product.id },
      orderBy: { timestamp: "asc" }
    });
    const points: PricePoint[] = rows
      .filter((r) => r.finalPriceCents !== null)
      .map((r) => ({ finalPrice: r.finalPriceCents as number, timestamp: r.timestamp }));
    const stats = computeHistoryStats(points);

    const verified = await prisma.offer.findFirst({
      where: { productId: product.id, finalPriceCents: { not: null } },
      orderBy: { finalPriceCents: "asc" }
    });
    const comparison = verified?.finalPriceCents
      ? compareWithAverage(verified.finalPriceCents, stats.avg30 ?? 0)
      : null;

    return NextResponse.json({
      product: { id: product.id, title: product.title },
      points: points.map((p) => ({ finalPrice: p.finalPrice, timestamp: p.timestamp.toISOString() })),
      stats,
      comparison,
      insufficient: stats.insufficient
    });
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
