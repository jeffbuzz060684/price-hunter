/**
 * GET  /api/alerts — alertes de l'utilisateur connecté (+ notifications).
 * POST /api/alerts — création (validation Zod, prix cible en centimes).
 * Toujours authentifié : 401 sinon.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAlert, listAlerts, listNotifications } from "@/lib/alerts/service";
import { createAlertSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  try {
    const [alerts, notifications] = await Promise.all([
      listAlerts(user.id),
      listNotifications(user.id)
    ]);
    return NextResponse.json({ alerts, notifications });
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const parsed = createAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Alerte invalide", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  try {
    const alert = await createAlert({
      userId: user.id,
      productId: parsed.data.productId,
      type: parsed.data.type,
      targetPrice: parsed.data.targetPrice ?? null,
      frequencyHours: parsed.data.frequencyHours
    });
    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
