/**
 * SESSIONS — authentification maison, sans dépendance externe.
 *
 * - Mots de passe : scrypt (salt aléatoire) — JAMAIS en clair.
 * - Session : token aléatoire signé HMAC-SHA256 avec SESSION_SECRET,
 *   stocké dans un cookie httpOnly. Contenu : {userId, issuedAt}.
 *
 * Limitation assumée : V1 sans expiration automatique configurable
 * (durée fixe : 30 jours) ni rotation de token.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "ph_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET manquante ou trop courte (32 caractères minimum)");
  }
  return secret;
}

/* ------------------ Mots de passe ------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/* ------------------ Tokens de session ------------------ */

/** token = payloadBase64.signatureHMAC */
export function createSessionToken(userId: string, now: Date = new Date()): string {
  const payload = JSON.stringify({ userId, issuedAt: now.getTime() });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readSessionToken(token: string): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      userId?: string;
      issuedAt?: number;
    };
    if (!payload.userId || typeof payload.issuedAt !== "number") return null;
    if (Date.now() - payload.issuedAt > SESSION_TTL_MS) return null; // expirée
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000
};
