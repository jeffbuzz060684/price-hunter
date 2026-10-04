/**
 * POST /api/auth/signup  { email, password }
 * Crée un compte (mot de passe scrypt salé) et pose le cookie de session.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createSessionToken, hashPassword, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { signUpSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Inscription invalide", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: { email: parsed.data.email, passwordHash: hashPassword(parsed.data.password) },
      select: { id: true, email: true }
    });
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "BASE_DE_DONNEES_INDISPONIBLE", details: error instanceof Error ? error.message : undefined },
      { status: 503 }
    );
  }
}
