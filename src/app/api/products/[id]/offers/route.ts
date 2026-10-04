/**
 * GET /api/products/[id]/offers — toutes les offres du produit,
 * triées par prix final vérifiable croissant (non vérifiables en dernier).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
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
      select: { id: true }
    });
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }
    const offers = await prisma.offer.findMany({
      where: { productId: product.id },
      orderBy: [{ finalPriceCents: "asc" }, { lastCheckedAt: "desc" }]
    });
    return NextResponse.json({ offers });
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
