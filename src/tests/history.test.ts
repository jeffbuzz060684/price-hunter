/**
 * TESTS HISTORIQUE — statistiques glissantes 7/30/90 jours.
 * Moins de 7 points sur 30 jours -> historique jugé insuffisant.
 * Aucune extrapolation : uniquement des faits passés.
 */

import { describe, expect, it } from "vitest";
import {
  compareWithAverage,
  computeHistoryStats,
  type PricePoint
} from "@/lib/history/stats";

const NOW = new Date("2026-10-04T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, price: number): PricePoint {
  return { finalPrice: price, timestamp: new Date(NOW.getTime() - days * DAY) };
}

describe("computeHistoryStats()", () => {
  it("sépare correctement les fenêtres 7 / 30 / 90 jours", () => {
    const points = [
      daysAgo(2, 45000),  // 7 j
      daysAgo(5, 44000),  // 7 j
      daysAgo(10, 43000), // 30 j
      daysAgo(20, 42000), // 30 j
      daysAgo(28, 41000), // 30 j
      daysAgo(40, 47000), // 90 j
      daysAgo(80, 48000), // 90 j
      daysAgo(85, 40000), // 90 j
      daysAgo(3, 44500),  // 7 j
      daysAgo(15, 42500)  // 30 j
    ];
    const stats = computeHistoryStats(points, NOW);
    expect(stats.count7).toBe(3);
    expect(stats.count30).toBe(7);
    expect(stats.count90).toBe(10);
    expect(stats.min7).toBe(44000);
    expect(stats.min30).toBe(41000);
    expect(stats.min90).toBe(40000);
    expect(stats.max90).toBe(48000);
    expect(stats.insufficient).toBe(false);
  });

  it("moyennes arrondies au centime près", () => {
    const points = [daysAgo(1, 40000), daysAgo(2, 40101)];
    const stats = computeHistoryStats(points, NOW);
    expect(stats.avg30).toBe(40051); // (40000 + 40101) / 2 = 40050,5 -> 40051
  });

  it("moins de 7 points sur 30 jours -> historique insuffisant", () => {
    const stats = computeHistoryStats(
      [daysAgo(1, 40000), daysAgo(2, 41000), daysAgo(3, 42000)],
      NOW
    );
    expect(stats.count30).toBe(3);
    expect(stats.insufficient).toBe(true);
  });

  it("points hors fenêtre 90 jours ignorés", () => {
    const stats = computeHistoryStats([daysAgo(100, 30000)], NOW);
    expect(stats.count90).toBe(0);
    expect(stats.min90).toBeNull();
    expect(stats.max90).toBeNull();
    expect(stats.avg90).toBeNull();
  });

  it("points dans le futur ignorés (données incohérentes)", () => {
    const future: PricePoint = { finalPrice: 35000, timestamp: new Date(NOW.getTime() + DAY) };
    const stats = computeHistoryStats([future, daysAgo(1, 40000)], NOW);
    expect(stats.count7).toBe(1);
    expect(stats.min7).toBe(40000);
  });

  it("prix nuls ignorés (jamais de fausse statistique)", () => {
    const zero: PricePoint = { finalPrice: 0, timestamp: daysAgo(1, 0).timestamp };
    const stats = computeHistoryStats([zero, daysAgo(1, 40000)], NOW);
    expect(stats.count7).toBe(1);
    expect(stats.min7).toBe(40000);
  });

  it("liste vide -> toutes valeurs null", () => {
    const stats = computeHistoryStats([], NOW);
    expect(stats.min7).toBeNull();
    expect(stats.min30).toBeNull();
    expect(stats.min90).toBeNull();
    expect(stats.max90).toBeNull();
    expect(stats.avg30).toBeNull();
    expect(stats.avg90).toBeNull();
    expect(stats.count90).toBe(0);
    expect(stats.insufficient).toBe(true);
  });
});

describe("compareWithAverage()", () => {
  it("prix supérieur à la moyenne : message honnête en %", () => {
    expect(compareWithAverage(44800, 40000)).toBe(
      "Le prix actuel est supérieur de 12 % à la moyenne."
    );
  });

  it("prix inférieur à la moyenne", () => {
    expect(compareWithAverage(36000, 40000)).toBe(
      "Le prix actuel est inférieur de 10 % à la moyenne."
    );
  });

  it("prix exactement à la moyenne", () => {
    expect(compareWithAverage(40000, 40000)).toBe(
      "Le prix actuel est exactement à la moyenne."
    );
  });

  it("moyenne nulle -> aucune comparaison inventée", () => {
    expect(compareWithAverage(40000, 0)).toBeNull();
  });

  it("prix nul -> aucune comparaison inventée", () => {
    expect(compareWithAverage(0, 40000)).toBeNull();
  });
});
