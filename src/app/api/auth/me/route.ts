/**
 * GET /api/auth/me — utilisateur courant (200) ou 401.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
