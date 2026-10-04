/**
 * TESTS PRODUCT MATCHING — priorité des identifiants, conflits de variantes,
 * plafond du matching par titre. Un produit différent n'est JAMAIS fusionné.
 */

import { describe, expect, it } from "vitest";
import {
  canAutoMerge,
  matchScore,
  MATCH_THRESHOLD,
  normalizeText,
  titleSimilarity
} from "@/lib/product-matching/match";

describe("normalizeText()", () => {
  it("minuscule et retire les accents", () => {
    expect(normalizeText("ÉLÉPHANT Café")).toBe("elephant cafe");
  });

  it("remplace la ponctuation par des espaces", () => {
    expect(normalizeText("S26! (Ultra) — 5G")).toBe("s26 ultra 5g");
  });
});

describe("titleSimilarity()", () => {
  it("titres identiques -> 100", () => {
    expect(titleSimilarity("Apple iPhone 15 Pro", "Apple iPhone 15 Pro")).toBe(100);
  });

  it("titres sans mot commun -> 0", () => {
    expect(titleSimilarity("Casque Sony", "Grille-pain Moulinex")).toBe(0);
  });
});

describe("matchScore() — identifiants uniques", () => {
  it("EAN identique -> 100 (fusion autorisée)", () => {
    const r = matchScore({ eans: ["3610000000000"] }, { eans: ["3610000000000"] });
    expect(r.score).toBe(100);
    expect(r.hardReject).toBeFalsy();
    expect(canAutoMerge(r)).toBe(true);
  });

  it("EAN différents -> 0 avec rejet dur", () => {
    const r = matchScore({ eans: ["3610000000000"] }, { eans: ["3610000000001"] });
    expect(r.score).toBe(0);
    expect(r.hardReject).toBe(true);
    expect(canAutoMerge(r)).toBe(false);
  });

  it("EAN d'un seul côté -> pas de rejet dur, on continue", () => {
    const r = matchScore({ eans: ["3610000000000"] }, { title: "Produit A" });
    expect(r.hardReject).toBeFalsy();
  });

  it("référence fabricant identique -> 98", () => {
    const r = matchScore({ manufacturerRef: "WH-1000XM5" }, { manufacturerRef: "wh-1000xm5" });
    expect(r.score).toBe(98);
  });

  it("références fabricant différentes -> rejet dur", () => {
    const r = matchScore({ manufacturerRef: "WH-1000XM5" }, { manufacturerRef: "WH-1000XM4" });
    expect(r.score).toBe(0);
    expect(r.hardReject).toBe(true);
  });

  it("SKU identique (casse/espaces) -> 95", () => {
    const r = matchScore({ sku: "ABC 123" }, { sku: "abc 123" });
    expect(r.score).toBe(95);
  });

  it("modèle identique -> 90", () => {
    const r = matchScore({ model: "Galaxy S26" }, { model: "galaxy s26" });
    expect(r.score).toBe(90);
  });

  it("modèles nettement différents -> 30", () => {
    const r = matchScore(
      { model: "Galaxy S26 Ultra" },
      { model: "Galaxy A16" }
    );
    expect(r.score).toBe(30);
  });
});

describe("matchScore() — conflits de variantes", () => {
  it("capacité différente via attributs -> 35, jamais fusionné", () => {
    const r = matchScore(
      { attributes: { capacity: "256go" } },
      { attributes: { capacity: "128go" } }
    );
    expect(r.score).toBe(35);
    expect(canAutoMerge(r)).toBe(false);
  });

  it('variante détectée depuis les titres : "256 Go" vs "128 Go" -> 35', () => {
    const r = matchScore(
      { title: "Samsung Galaxy S26 256 Go" },
      { title: "Samsung Galaxy S26 128 Go" }
    );
    expect(r.score).toBe(35);
  });

  it("même capacité dans les titres -> pas de conflit", () => {
    const r = matchScore(
      { title: "Samsung Galaxy S26 256 Go" },
      { title: "Galaxy S26 256 Go Noir" }
    );
    expect(r.score).toBeGreaterThan(35);
  });
});

describe("matchScore() — titre seul (plafonné)", () => {
  it("titres identiques sans identifiant -> plafonné à 75, sous le seuil 80", () => {
    const r = matchScore({ title: "Casque Bluetooth Sony" }, { title: "Casque Bluetooth Sony" });
    expect(r.score).toBeLessThanOrEqual(75);
    expect(canAutoMerge(r)).toBe(false);
  });

  it("titres très similaires -> plafonné à 75", () => {
    const r = matchScore(
      { title: "Sony WH-1000XM5 Casque" },
      { title: "Sony WH-1000XM5 Casque Noir" }
    );
    expect(r.score).toBeLessThanOrEqual(75);
    expect(MATCH_THRESHOLD).toBe(80);
  });

  it("titres peu similaires -> score faible", () => {
    const r = matchScore(
      { title: "Casque audio sans fil noir" },
      { title: "Machine à café grain blanche" }
    );
    expect(r.score).toBeLessThan(30);
  });

  it("aucun identifiant ni titre -> 0", () => {
    const r = matchScore({}, {});
    expect(r.score).toBe(0);
  });
});
