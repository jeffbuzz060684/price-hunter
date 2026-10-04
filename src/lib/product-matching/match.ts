/**
 * PRODUCT MATCHING — matchScore(a, b) ∈ [0, 100]
 *
 * Ordre de priorité (spec §7) : EAN/GTIN > réf. fabricant > SKU > modèle >
 * caractéristiques > titre.
 *
 * RÈGLES CRITIQUES :
 * - EAN identique                      -> 100
 * - EAN présents des deux côtés, différents -> 0 (rejet dur : produits différents)
 * - réf. fabricant identique           -> 98
 * - SKU identique                      -> 95
 * - conflit de variante (capacité, couleur, taille…) -> score <= 40
 *   "S26 256 Go" n'est JAMAIS "S26 128 Go"
 * - correspondance titre seul          -> plafonné à 75 (jamais fusionné automatiquement,
 *   le seuil de fusion par défaut est 80)
 */

export interface ProductIdentity {
  eans?: string[];
  manufacturerRef?: string;
  sku?: string;
  model?: string;
  /** Attributs variant : capacity, color, storage, size… */
  attributes?: Record<string, string>;
  title?: string;
}

export interface MatchResult {
  score: number;
  /** Justification lisible, affichée à l'utilisateur. */
  reason: string;
  /** true = rejet dur (EAN contradictoires). */
  hardReject?: boolean;
}

/** Seuil par défaut sous lequel on ne fusionne JAMAIS automatiquement. */
export const MATCH_THRESHOLD = 80;

const VARIANT_KEYS = ["capacity", "storage", "color", "colour", "size", "ram", "screen"];

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(list: string[] | undefined): string[] {
  if (!list) return [];
  return list
    .map((v) => normalizeText(v))
    .filter((v) => v.length > 0 && v !== "0" && v !== "n a" && v !== "na");
}

function tokens(text: string): Set<string> {
  return new Set(normalizeText(text).split(" ").filter(Boolean));
}

/** Similarité de Jaccard entre deux titres, en %. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return Math.round((intersection / (ta.size + tb.size - intersection)) * 100);
}

/**
 * Détecte un conflit de variante entre deux dictionnaires d'attributs.
 * Retourne la clé en conflit, ou null.
 */
function variantConflict(
  attrsA: Record<string, string>,
  attrsB: Record<string, string>
): string | null {
  for (const key of VARIANT_KEYS) {
    const va = normalizeText(attrsA[key] ?? "");
    const vb = normalizeText(attrsB[key] ?? "");
    if (va && vb && va !== vb) return key;
  }
  return null;
}

/** Extrait une variante depuis le titre si les attributs sont absents. */
function attributesFromTitle(identity: ProductIdentity): Record<string, string> {
  const merged: Record<string, string> = { ...(identity.attributes ?? {}) };
  const title = identity.title ?? "";
  const go = title.match(/(\d+)\s*(go|gb)\b/i);
  if (go && !merged.capacity) merged.capacity = `${go[1]}${go[2].toLowerCase()}`;
  return merged;
}

export function matchScore(a: ProductIdentity, b: ProductIdentity): MatchResult {
  // 1. EAN / GTIN
  const eansA = normalizeList(a.eans);
  const eansB = normalizeList(b.eans);
  if (eansA.length > 0 && eansB.length > 0) {
    if (eansA.some((ean) => eansB.includes(ean))) {
      return { score: 100, reason: "EAN identique" };
    }
    return { score: 0, reason: "EAN différents — produits distincts", hardReject: true };
  }

  // 2. Conflit de variante (vérifié tôt : domine tout le reste)
  const conflict = variantConflict(attributesFromTitle(a), attributesFromTitle(b));
  if (conflict) {
    return { score: 35, reason: `Variante différente (${conflict}) — produits distincts` };
  }

  // 3. Référence fabricant
  const refA = normalizeText(a.manufacturerRef ?? "");
  const refB = normalizeText(b.manufacturerRef ?? "");
  if (refA && refB) {
    if (refA === refB) return { score: 98, reason: "Référence fabricant identique" };
    return { score: 0, reason: "Références fabricant différentes", hardReject: true };
  }

  // 4. SKU
  const skuA = normalizeText(a.sku ?? "");
  const skuB = normalizeText(b.sku ?? "");
  if (skuA && skuB && skuA === skuB) {
    return { score: 95, reason: "SKU identique" };
  }

  // 5. Modèle identique (sans conflit de variante, déjà vérifié)
  const modelA = normalizeText(a.model ?? "");
  const modelB = normalizeText(b.model ?? "");
  if (modelA && modelB) {
    if (modelA === modelB) return { score: 90, reason: "Modèle identique" };
    const sim = titleSimilarity(modelA, modelB);
    if (sim >= 90) return { score: 85, reason: "Modèle très proche" };
    if (sim < 60) return { score: 30, reason: "Modèles différents" };
  }

  // 6. Titre seul — plafonné sous le seuil de fusion
  if (a.title && b.title) {
    const sim = titleSimilarity(a.title, b.title);
    if (sim >= 80) {
      return { score: Math.min(75, Math.round(sim * 0.9)), reason: "Correspondance de titre (sans identifiant unique)" };
    }
    if (sim >= 55) {
      return { score: Math.round(sim * 0.6), reason: "Correspondance partielle de titre" };
    }
    return { score: Math.max(0, Math.round(sim * 0.4)), reason: "Titres peu similaires" };
  }

  return { score: 0, reason: "Pas assez d'identifiants pour comparer" };
}

/** true si deux identités peuvent être fusionnées automatiquement. */
export function canAutoMerge(result: MatchResult, threshold = MATCH_THRESHOLD): boolean {
  return !result.hardReject && result.score >= threshold;
}
