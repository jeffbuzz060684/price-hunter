/**
 * PAGE RECHERCHE — résultats LIVE des marchands configurés.
 * - Statut honnête de chaque source (indisponible = affiché, jamais masqué).
 * - Meilleur prix RÉEL uniquement (prix non vérifiable = affiché comme tel).
 * - Bouton « Suivre ce produit » : persiste le cluster puis ouvre la page
 *   produit (formulaire d'alerte).
 */

import { Suspense } from "react";
import { searchProducts, type SearchOutcome } from "@/lib/search/service";
import { formatCents } from "@/lib/types";
import { FollowButton } from "./follow-button";

export const dynamic = "force-dynamic";

function SourceBanner({ outcome }: { outcome: SearchOutcome }) {
  if (outcome.status === "ok" && outcome.sources.every((s) => s.status === "OK")) {
    return null;
  }
  return (
    <div className="card border-amber-300 bg-amber-50">
      <h2 className="font-semibold text-amber-900">État des sources</h2>
      <ul className="mt-2 space-y-1 text-sm text-amber-900">
        {outcome.sources.map((s) => (
          <li key={s.merchantId}>
            <strong>{s.merchantName}</strong> :{" "}
            {s.status === "API_KEY_REQUIRED"
              ? "clés API nécessaires — recherche impossible"
              : s.status === "SOURCE_UNAVAILABLE"
                ? "source indisponible"
                : s.status === "RATE_LIMITED"
                  ? "quota atteint — réessayer plus tard"
                  : s.status}
            {s.error ? ` (${s.error})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function SearchResults({ q }: { q: string }) {
  let outcome: SearchOutcome;
  try {
    outcome = await searchProducts(q, 20);
  } catch (error) {
    return (
      <div className="card border-red-300 bg-red-50">
        <h2 className="font-semibold text-red-900">Erreur de recherche</h2>
        <p className="mt-1 text-sm text-red-900">
          {error instanceof Error ? error.message : "Erreur inconnue"} — aucune
          donnée inventée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SourceBanner outcome={outcome} />
      {outcome.clusters.length === 0 && (
        <div className="card">
          <p className="text-slate-700">
            Aucun résultat vérifiable pour « {q} ». Aucun prix n&apos;a été simulé
            pour combler les sources indisponibles.
          </p>
        </div>
      )}
      {outcome.clusters.map((cluster, index) => (
        <article key={index} className="card">
          <h2 className="font-semibold leading-snug">{cluster.title}</h2>
          {cluster.bestFinalPrice !== null ? (
            <p className="mt-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Meilleur prix réel
              </span>
              <br />
              <span className="text-2xl font-bold text-green-700">
                {formatCents(cluster.bestFinalPrice)}
              </span>
            </p>
          ) : (
            <p className="mt-1">
              <span className="badge badge-warn">PRIX NON VÉRIFIABLE</span>{" "}
              <span className="text-xs text-slate-500">
                livraison inconnue — aucun montant estimé
              </span>
            </p>
          )}
          <ul className="mt-3 divide-y divide-slate-100">
            {cluster.offers.map((offer, i) => (
              <li key={offer.raw.merchantProductId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{offer.raw.title}</p>
                  <p className="text-xs text-slate-500">
                    {offer.merchantName} · affiché {formatCents(offer.raw.displayedPriceCents)} ·{" "}
                    {offer.finalPrice.confidence === "EXACT"
                      ? "prix exact"
                      : offer.finalPrice.confidence === "PARTIAL"
                        ? "prix partiellement vérifié"
                        : "prix non vérifiable"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {offer.finalPrice.finalPrice !== null
                      ? formatCents(offer.finalPrice.finalPrice)
                      : "—"}
                  </span>
                  {offer.raw.url && (
                    <a
                      href={offer.raw.url}
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
          </ul>
          <div className="mt-3">
            <FollowButton query={q} clusterIndex={index} />
          </div>
        </article>
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  return (
    <div className="space-y-4">
      <form action="/search" method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Produit, référence ou EAN…"
          minLength={2}
          maxLength={300}
          required
          className="input flex-1"
          aria-label="Recherche de produit"
        />
        <button type="submit" className="btn-primary">
          Comparer
        </button>
      </form>
      {q.length < 2 ? (
        <div className="card">
          <p className="text-slate-700">
            Saisis au moins 2 caractères pour lancer une recherche.
          </p>
        </div>
      ) : (
        <Suspense fallback={<p className="text-slate-500">Recherche en cours…</p>}>
          <SearchResults q={q} />
        </Suspense>
      )}
    </div>
  );
}
