/**
 * DELETE /api/alerts/[id] — supprime UNE alerte de l'utilisateur connecté
 * (un utilisateur ne peut supprimer que ses propres alertes).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteAlert } from "@/lib/alerts/service";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const id = idParamSchema.safeParse(params.id);
  if (!id.success) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }
  try {
    const deleted = await deleteAlert(user.id, id.data);
    if (!deleted) {
      return NextResponse.json({ error: "Alerte introuvable" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
