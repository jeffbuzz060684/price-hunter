/**
 * HISTORIQUE DE PRIX — statistiques glissantes.
 *
 * computeHistoryStats : min/max/moyenne sur 7, 30, 90 jours.
 * compareWithAverage : phrase de comparaison en % (jamais de prédiction).
 */

export interface PricePoint {
  /** Prix final en centimes (null ignoré). */
  finalPrice: number;
  /** Date du point. */
  timestamp: Date;
}

export interface HistoryStats {
  min7: number | null;
  min30: number | null;
  min90: number | null;
  max90: number | null;
  avg30: number | null;
  avg90: number | null;
  count7: number;
  count30: number;
  count90: number;
  /** Moins de 7 points sur 30 jours -> historique jugé insuffisant. */
  insufficient: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function min(values: number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

export function computeHistoryStats(points: PricePoint[], now: Date = new Date()): HistoryStats {
  const p7: number[] = [];
  const p30: number[] = [];
  const p90: number[] = [];

  for (const point of points) {
    if (point.finalPrice === null || point.finalPrice <= 0) continue;
    const age = now.getTime() - point.timestamp.getTime();
    if (age < 0) continue; // point dans le futur : ignoré (données incohérentes)
    if (age <= 7 * DAY_MS) p7.push(point.finalPrice);
    if (age <= 30 * DAY_MS) p30.push(point.finalPrice);
    if (age <= 90 * DAY_MS) p90.push(point.finalPrice);
  }

  return {
    min7: min(p7),
    min30: min(p30),
    min90: min(p90),
    max90: p90.length > 0 ? Math.max(...p90) : null,
    avg30: avg(p30),
    avg90: avg(p90),
    count7: p7.length,
    count30: p30.length,
    count90: p90.length,
    insufficient: p30.length < 7
  };
}

/**
 * Compare le prix actuel à une moyenne.
 * Retourne null si aucune comparaison honnête n'est possible.
 * Ex : "Le prix actuel est inférieur de 12 % à la moyenne des 30 derniers jours."
 */
export function compareWithAverage(currentPrice: number, average: number): string | null {
  if (average === null || average <= 0 || currentPrice <= 0) return null;
  const deltaPct = Math.round(((average - currentPrice) / average) * 100);
  if (deltaPct > 0) {
    return `Le prix actuel est inférieur de ${deltaPct} % à la moyenne.`;
  }
  if (deltaPct < 0) {
    return `Le prix actuel est supérieur de ${Math.abs(deltaPct)} % à la moyenne.`;
  }
  return "Le prix actuel est exactement à la moyenne.";
}
