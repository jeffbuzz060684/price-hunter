/**
 * TESTS VALIDATION ZOD — nécessite le module zod (node_modules).
 * Exécuté par Vitest en CI ; exclu du harnais local sans node_modules.
 */

import { describe, expect, it } from "vitest";
import {
  alertTypeSchema,
  createAlertSchema,
  eanSchema,
  searchQuerySchema,
  signInSchema,
  signUpSchema
} from "@/lib/validation";

describe("searchQuerySchema", () => {
  it("requête valide", () => {
    const r = searchQuerySchema.safeParse({ query: "casque sony" });
    expect(r.success).toBe(true);
  });

  it("requête trop courte rejetée", () => {
    const r = searchQuerySchema.safeParse({ query: "a" });
    expect(r.success).toBe(false);
  });

  it("requête trop longue rejetée", () => {
    const r = searchQuerySchema.safeParse({ query: "x".repeat(301) });
    expect(r.success).toBe(false);
  });

  it("limite bornée entre 1 et 50", () => {
    expect(searchQuerySchema.safeParse({ query: "ok", limit: 51 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ query: "ok", limit: 0 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ query: "ok", limit: "20" }).success).toBe(true);
  });
});

describe("eanSchema", () => {
  it("EAN-13 valide", () => {
    expect(eanSchema.safeParse("3610000000000").success).toBe(true);
  });

  it("EAN-8 valide", () => {
    expect(eanSchema.safeParse("12345678").success).toBe(true);
  });

  it("EAN-12 rejeté", () => {
    expect(eanSchema.safeParse("123456789012").success).toBe(false);
  });
});

describe("alertTypeSchema", () => {
  it("les 4 types sont acceptés", () => {
    for (const t of ["BELOW_PRICE", "NEW_BEST_PRICE", "BELOW_PRICE_WITH_COUPON", "EXCELLENT_DEAL"]) {
      expect(alertTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it("type inconnu rejeté", () => {
    expect(alertTypeSchema.safeParse("PRICE_UP").success).toBe(false);
  });
});

describe("createAlertSchema", () => {
  it("BELOW_PRICE exige un prix cible", () => {
    const r = createAlertSchema.safeParse({ productId: "p1", type: "BELOW_PRICE" });
    expect(r.success).toBe(false);
  });

  it("BELOW_PRICE avec cible valide", () => {
    const r = createAlertSchema.safeParse({ productId: "p1", type: "BELOW_PRICE", targetPrice: "400" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.targetPrice).toBe(40000);
  });

  it('targetPrice "400,99" -> 40099 centimes', () => {
    const r = createAlertSchema.safeParse({ productId: "p1", type: "BELOW_PRICE", targetPrice: "400,99" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.targetPrice).toBe(40099);
  });

  it("NEW_BEST_PRICE sans cible : valide", () => {
    const r = createAlertSchema.safeParse({ productId: "p1", type: "NEW_BEST_PRICE" });
    expect(r.success).toBe(true);
  });

  it("prix cible invalide rejeté", () => {
    const r = createAlertSchema.safeParse({ productId: "p1", type: "BELOW_PRICE", targetPrice: "abc" });
    expect(r.success).toBe(false);
  });

  it("fréquence bornée 1..168", () => {
    expect(createAlertSchema.safeParse({ productId: "p1", type: "NEW_BEST_PRICE", frequencyHours: 200 }).success).toBe(false);
    expect(createAlertSchema.safeParse({ productId: "p1", type: "NEW_BEST_PRICE", frequencyHours: 6 }).success).toBe(true);
  });
});

describe("schémas d'authentification", () => {
  it("inscription valide", () => {
    const r = signUpSchema.safeParse({ email: "jade@example.fr", password: "motdepasse123" });
    expect(r.success).toBe(true);
  });

  it("mot de passe trop court rejeté", () => {
    const r = signUpSchema.safeParse({ email: "jade@example.fr", password: "court" });
    expect(r.success).toBe(false);
  });

  it("email invalide rejeté", () => {
    expect(signUpSchema.safeParse({ email: "pas-un-email", password: "motdepasse123" }).success).toBe(false);
  });

  it("connexion : mot de passe non vide requis", () => {
    expect(signInSchema.safeParse({ email: "jade@example.fr", password: "" }).success).toBe(false);
  });
});
