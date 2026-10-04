/**
 * POST /api/auth/login  { email, password }
 * Vérifie le mot de passe (scrypt + timingSafeEqual) et pose le cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifyPassword
} from "@/lib/auth/session";
import { signInSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
