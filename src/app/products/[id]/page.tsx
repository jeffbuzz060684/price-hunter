/**
 * PAGE PRODUIT — meilleur prix RÉEL, autres offres, score de bonne affaire,
 * statistiques et formulaire d'alerte. Aucun prix simulé : offres non
 * vérifiables affichées comme telles.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { computeHistoryStats, type PricePoint } from "@/lib/history/stats";
import { dealScore } from "@/lib/price-engine/deal-score";
import { formatCents } from "@/lib/types";
import { idParamSchema } from "@/lib/validation";
import { AlertForm } from "./alert-form";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const parsed = idParamSchema.safeParse(params.id);
  if (!parsed.success) notFound();

  let product: Awaited<ReturnType<typeof loadProduct>> = null;
  let dbError: string | null = null;
  try {
    product = await loadProduct(parsed.data);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue";
  }

  if (dbError) {
    return (
      <div className="card border-red-300 bg-red-50">
        <h1 className="font-semibold text-red-900">BASE DE DONNÉES INDISPONIBLE</h1>
        <p className="mt-1 text-sm text-red-900">{dbError}</p>
        <p className="mt-1 text-xs text-red-800">
          Aucun prix n&apos;est affiché sans ses données réelles.
        </p>
      </div>
    );
  }
  if (!product) notFound();

  const { offers, stats, score } = product;
  const verified = offers.filter((o) => o.finalPriceCents !== null);
  const best = verified[0] ?? null;
  const others = verified.slice(1);
  const unverifiable = offers.filter((o) => o.finalPriceCents === null);

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-xl font-bold leading-snug">{product.title}</h1>
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className="mt-3 max-h-48 rounded-lg object-contain"
          />
        )}

        {best ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Meilleur prix réel (vérifié)
            </p>
            <p className="text-3xl font-bold text-green-700">
              {formatCents(best.finalPriceCents)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {best.title} · prix affiché {formatCents(best.displayedPriceCents)} ·{" "}
              {best.shippingStatus === "FREE"
                ? "livraison gratuite"
                : best.shippingStatus === "PAID"
                  ? `livraison ${formatCents(best.shippingCents)} incluse`
                  : "livraison inconnue"}
            </p>
            {best.url && (
              <a
                href={best.url}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-primary mt-2 text-sm"
              >
                Voir l&apos;offre
              </a>
            )}
          </div>
        ) : (
          <p className="mt-4">
            <span className="badge badge-warn">PRIX NON VÉRIFIABLE</span>{" "}
            <span className="text-sm text-slate-600">
              aucune offre avec un prix final vérifiable pour ce produit
            </span>
          </p>
        )}

        {score && (
          <div className="mt-4 rounded-lg bg-slate-100 p-3">
            <p className="text-sm">
              <strong>Score de bonne affaire : {score.score}/100</strong> — {score.label}
              {score.historyInsufficient && (
                <span className="text-xs text-slate-500">
                  {" "}
                  (historique encore insuffisant : score partiellement neutre)
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Basé uniquement sur des faits : historique 90 j, moyenne 30 j,
              concurrents, fiabilité et disponibilité. Aucune prédiction.
            </p>
          </div>
        )}
      </section>

      {offers.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold">Autres offres</h2>
          {others.length === 0 && unverifiable.length === 0 && (
            <p className="mt-2 text-sm text-slate-600">Aucune autre offre connue.</p>
          )}
          <ul className="mt-2 divide-y divide-slate-100">
            {others.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{offer.title}</p>
                  <p className="text-xs text-slate-500">
                    affiché {formatCents(offer.displayedPriceCents)} ·{" "}
                    {offer.availability === "IN_STOCK"
                      ? "en stock"
                      : offer.availability === "OUT_OF_STOCK"
                        ? "rupture"
                        : "disponibilité inconnue"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCents(offer.finalPriceCents)}</span>
                  {offer.url && (
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn-secondary !px-3 !py-1 text-xs"
                    >
                      Voir
                    </a>
                  )}
                </div>
              </li>
            ))}
            {unverifiable.map((offer) => (
              <li key={offer.id} className="py-2">
                <p className="truncate text-sm font-medium">{offer.title}</p>
                <p className="text-xs text-slate-500">
                  <span className="badge badge-warn">PRIX NON VÉRIFIABLE</span>{" "}
                  livraison inconnue — aucun montant estimé
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Historique</h2>
        <ul className="mt-2 text-sm text-slate-700">
          <li>Minimum 7 jours : {formatCents(stats.min7)}</li>
          <li>Minimum 30 jours : {formatCents(stats.min30)}</li>
          <li>Minimum 90 jours : {formatCents(stats.min90)}</li>
          <li>Moyenne 30 jours : {formatCents(stats.avg30)}</li>
        </ul>
        <Link href={`/products/${parsed.data}/history`} className="btn-secondary mt-3 text-sm">
          📈 Voir l&apos;historique détaillé
        </Link>
      </section>

      <AlertForm productId={parsed.data} />
    </div>
  );
}

async function loadProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { offers: { orderBy: [{ finalPriceCents: "asc" }] } }
  });
  if (!product) return null;

  const historyRows = await prisma.priceHistory.findMany({
    where: { productId: product.id },
    orderBy: { timestamp: "asc" }
  });
  const points: PricePoint[] = historyRows
    .filter((h) => h.finalPriceCents !== null)
    .map((h) => ({ finalPrice: h.finalPriceCents as number, timestamp: h.timestamp }));
  const stats = computeHistoryStats(points);

  const verified = product.offers.filter((o) => o.finalPriceCents !== null);
  const best = verified[0] ?? null;
  const score = best
    ? dealScore({
        finalPrice: best.finalPriceCents,
        confidence: best.confidence as "EXACT" | "PARTIAL" | "UNVERIFIABLE",
        availability: best.availability as "IN_STOCK" | "PREORDER" | "OUT_OF_STOCK" | "UNKNOWN",
        history: {
          min90: stats.min90,
          max90: stats.max90,
          avg30: stats.avg30,
          dataPoints: stats.count90
        },
        bestCompetitorPrice: verified.length > 1 ? verified[1].finalPriceCents : null
      })
    : null;

  return { ...product, stats, score };
}
