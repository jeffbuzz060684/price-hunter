/**
 * VALIDATION ZOD — toutes les entrées API sont validées ici.
 * Jamais de données non validées en base.
 */

import { z } from "zod";

/** 13 chiffres = EAN-13. 8 chiffres = EAN-8. */
export const eanSchema = z.string().regex(/^\d{8}$|^\d{13}$/, "EAN invalide (8 ou 13 chiffres)");

/** Une recherche : texte libre, EAN, référence ou URL. */
export const searchQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Requête trop courte (minimum 2 caractères)")
    .max(300, "Requête trop longue (maximum 300 caractères)"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

export const alertTypeSchema = z.enum([
  "BELOW_PRICE",
  "NEW_BEST_PRICE",
  "BELOW_PRICE_WITH_COUPON",
  "EXCELLENT_DEAL"
]);

/** "400" ou "400,99" -> centimes. */
const priceStringToCents = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const num = Number(normalized);
    if (!Number.isFinite(num) || num <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Prix invalide" });
      return z.NEVER;
    }
    return Math.round(num * 100);
  });

export const createAlertSchema = z
  .object({
    productId: z.string().min(1),
    type: alertTypeSchema,
    /** Requis pour BELOW_PRICE et BELOW_PRICE_WITH_COUPON. */
    targetPrice: priceStringToCents.optional(),
    frequencyHours: z.coerce.number().int().min(1).max(168).optional().default(6)
  })
  .refine(
    (data) =>
      (data.type === "BELOW_PRICE" || data.type === "BELOW_PRICE_WITH_COUPON") ? data.targetPrice !== undefined : true,
    { message: "Un prix cible est requis pour ce type d'alerte", path: ["targetPrice"] }
  );

export const signUpSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum").max(200)
});

export const signInSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis")
});

export const idParamSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Identifiant invalide");
