/**
 * POST /api/search/persist  { query, clusterIndex? }
 * Recherche LIVE puis persistance du cluster choisi (produit + offres +
 * historique). Retourne l'id du produit créé (utilisé par la page produit
 * et le formulaire d'alerte).
 * Erreurs honnêtes : 503 BASE_DE_DONNEES_INDISPONIBLE si la base échoue.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { persistSearchOutcome, searchProducts } from "@/lib/search/service";
import { searchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const persistSchema = z.object({
  query: searchQuerySchema.shape.query,
  clusterIndex: z.coerce.number().int().min(0).max(49).optional().default(0)
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const parsed = persistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const outcome = await searchProducts(parsed.data.query);
  if (outcome.clusters.length === 0) {
    return NextResponse.json(
      { error: "Aucun résultat à enregistrer", sources: outcome.sources },
      { status: 404 }
    );
  }

  try {
    const productId = await persistSearchOutcome(outcome, parsed.data.clusterIndex);
    if (!productId) {
      return NextResponse.json({ error: "Cluster vide" }, { status: 404 });
    }
    return NextResponse.json({ productId, query: parsed.data.query });
  } catch (error) {
    return NextResponse.json(
      {
        error: "BASE_DE_DONNEES_INDISPONIBLE",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      },
      { status: 503 }
    );
  }
}
