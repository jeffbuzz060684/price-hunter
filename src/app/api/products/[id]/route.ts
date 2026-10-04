/**
 * GET /api/products/[id] — produit + offres triées par prix final vérifiable,
 * statistiques d'historique et score de bonne affaire de la meilleure offre.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { computeHistoryStats, type PricePoint } from "@/lib/history/stats";
import { dealScore } from "@/lib/price-engine/deal-score";
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
      include: { offers: { orderBy: [{ finalPriceCents: "asc" }] } }
    });
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const historyRows = await prisma.priceHistory.findMany({
      where: { productId: product.id },
      orderBy: { timestamp: "asc" }
    });
    const points: PricePoint[] = historyRows
      .filter((h) => h.finalPriceCents !== null)
      .map((h) => ({ finalPrice: h.finalPriceCents as number, timestamp: h.timestamp }));
    const stats = computeHistoryStats(points);

    const verifiedOffers = product.offers.filter((o) => o.finalPriceCents !== null);
    const best = verifiedOffers[0] ?? null;
    const score = best
      ? dealScore({
          finalPrice: best.finalPriceCents,
          confidence: best.confidence as "EXACT" | "PARTIAL" | "UNVERIFIABLE",
          availability: best.availability as "IN_STOCK" | "PREORDER" | "OUT_OF_STOCK" | "UNKNOWN",
          history: {
            min90: stats.min90,
            max90: stats.max90,
            avg30: stats.avg30,
            dataPoints: stats.count90
          },
          bestCompetitorPrice: verifiedOffers.length > 1 ? verifiedOffers[1].finalPriceCents : null
        })
      : null;

    return NextResponse.json({ product, stats, dealScore: score });
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
