/**
 * Utilisateur courant — lit le cookie de session signé et charge l'utilisateur.
 * Retourne null si non connecté, token invalide, expiré ou base indisponible.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  email: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = readSessionToken(token);
  if (!payload) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true }
    });
    return user;
  } catch {
    return null;
  }
}
