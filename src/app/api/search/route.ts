/**
 * GET /api/search?q=...&limit=...
 * Recherche LIVE auprès des marchands configurés. Aucune persistance.
 * Réponses honnêtes : no_source + statut par marchand si rien n'est configuré.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/search/service";
import { searchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = searchQuerySchema.safeParse({
    query: request.nextUrl.searchParams.get("q") ?? "",
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Requête invalide", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const outcome = await searchProducts(parsed.data.query, parsed.data.limit);
  return NextResponse.json(outcome, {
    status: outcome.status === "ok" ? 200 : 503
  });
}
