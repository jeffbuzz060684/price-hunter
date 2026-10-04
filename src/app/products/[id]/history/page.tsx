/**
 * PAGE HISTORIQUE — statistiques glissantes 7/30/90 jours + courbe SVG.
 * Points = prix finaux VÉRIFIÉS uniquement. Historique insuffisant (< 7
 * points sur 30 j) : affiché honnêtement, aucune extrapolation.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import {
  compareWithAverage,
  computeHistoryStats,
  type PricePoint
} from "@/lib/history/stats";
import { formatCents } from "@/lib/types";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: { id: string } }) {
  const parsed = idParamSchema.safeParse(params.id);
  if (!parsed.success) notFound();

  let product: { id: string; title: string } | null = null;
  let points: PricePoint[] = [];
  let dbError: string | null = null;
  try {
    product = await prisma.product.findUnique({
      where: { id: parsed.data },
      select: { id: true, title: true }
    });
    if (product) {
      const rows = await prisma.priceHistory.findMany({
        where: { productId: product.id },
        orderBy: { timestamp: "asc" }
      });
      points = rows
        .filter((r) => r.finalPriceCents !== null)
        .map((r) => ({ finalPrice: r.finalPriceCents as number, timestamp: r.timestamp }));
    }
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue";
  }

  if (dbError) {
    return (
      <div className="card border-red-300 bg-red-50">
        <h1 className="font-semibold text-red-900">BASE DE DONNÉES INDISPONIBLE</h1>
        <p className="mt-1 text-sm text-red-900">{dbError}</p>
      </div>
    );
  }
  if (!product) notFound();

  const stats = computeHistoryStats(points);
  const best = await (async () => {
    try {
      return await prisma.offer.findFirst({
        where: { productId: product!.id, finalPriceCents: { not: null } },
        orderBy: { finalPriceCents: "asc" }
      });
    } catch {
      return null;
    }
  })();
  const comparison =
    best?.finalPriceCents != null ? compareWithAverage(best.finalPriceCents, stats.avg30 ?? 0) : null;

  const W = 600;
  const H = 200;
  const path = buildChartPath(points, W, H);

  return (
    <div className="space-y-6">
      <section className="card">
        <Link href={`/products/${product.id}`} className="text-sm text-green-700 underline">
          ← Retour au produit
        </Link>
        <h1 className="mt-2 text-xl font-bold leading-snug">Historique de prix</h1>
        <p className="text-sm text-slate-600">{product.title}</p>
      </section>

      {stats.insufficient ? (
        <section className="card border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-900">Historique insuffisant</h2>
          <p className="mt-1 text-sm text-amber-900">
            {stats.count30} point(s) sur 30 jours — il en faut au moins 7 pour
            des statistiques fiables. Aucune tendance n&apos;est extrapolée.
          </p>
        </section>
      ) : (
        <section className="card">
          <h2 className="text-lg font-semibold">Statistiques (prix finaux vérifiés)</h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-3">
            <li>Min 7 j : <strong>{formatCents(stats.min7)}</strong></li>
            <li>Min 30 j : <strong>{formatCents(stats.min30)}</strong></li>
            <li>Min 90 j : <strong>{formatCents(stats.min90)}</strong></li>
            <li>Max 90 j : <strong>{formatCents(stats.max90)}</strong></li>
            <li>Moy. 30 j : <strong>{formatCents(stats.avg30)}</strong></li>
            <li>Moy. 90 j : <strong>{formatCents(stats.avg90)}</strong></li>
          </ul>
          {comparison && <p className="mt-2 text-sm text-slate-700">{comparison}</p>}
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Courbe ({points.length} point(s))</h2>
        {points.length < 2 ? (
          <p className="mt-2 text-sm text-slate-600">
            Pas encore assez de points vérifiés pour tracer une courbe.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-3 h-56 w-full"
            role="img"
            aria-label="Courbe des prix finaux vérifiés"
          >
            <line x1="0" y1={H - 20} x2={W} y2={H - 20} stroke="#cbd5e1" strokeWidth="1" />
            <path d={path} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        )}
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {points.slice(-5).map((p, i) => (
            <li key={i}>
              {p.timestamp.toLocaleDateString("fr-FR")} — {formatCents(p.finalPrice)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Construit le path SVG (échelle temporelle x, prix y). */
function buildChartPath(points: PricePoint[], w: number, h: number): string {
  if (points.length < 2) return "";
  const top = 10;
  const bottom = h - 20;
  const min = Math.min(...points.map((p) => p.finalPrice));
  const max = Math.max(...points.map((p) => p.finalPrice));
  const range = max > min ? max - min : 1;
  const t0 = points[0].timestamp.getTime();
  const t1 = points[points.length - 1].timestamp.getTime();
  const span = t1 > t0 ? t1 - t0 : 1;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - 10) + 5;
      const y = bottom - ((p.finalPrice - min) / range) * (bottom - top);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
