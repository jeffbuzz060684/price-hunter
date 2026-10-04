/**
 * ACCUEIL — recherche + état honnête des sources.
 * Aucune donnée inventée : les sources non configurées sont listées comme telles.
 */

import { getMerchantStatus } from "@/lib/merchants/registry";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const statuses = getMerchantStatus();

  return (
    <div className="space-y-8">
      <section className="card">
        <h1 className="text-2xl font-bold">Comparateur de prix honnête</h1>
        <p className="mt-2 text-slate-600">
          Le prix réellement payable — livraison, frais et réductions vérifiées.
          Jamais de prix simulé : une source indisponible est affichée comme telle.
        </p>
        <form action="/search" method="get" className="mt-4 flex gap-2">
          <input
            type="search"
            name="q"
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
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Sources de prix</h2>
        <ul className="mt-3 space-y-2">
          {statuses.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.name}</span>
              {s.configured ? (
                <span className="badge badge-ok">CONFIGURÉE</span>
              ) : (
                <span className="badge badge-warn">CLÉS API NÉCESSAIRES</span>
              )}
              {s.missingEnv && s.missingEnv.length > 0 && (
                <span className="text-xs text-slate-500">
                  Manque : {s.missingEnv.join(", ")}
                </span>
              )}
              {s.note && <span className="text-xs text-slate-500">{s.note}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          eBay Browse API est gratuite : crée un compte sur{" "}
          <a
            href="https://developer.ebay.com"
            className="font-medium text-green-700 underline"
            rel="noreferrer noopener"
            target="_blank"
          >
            developer.ebay.com
          </a>{" "}
          puis renseigne EBAY_CLIENT_ID et EBAY_CLIENT_SECRET.
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Comment ça marche</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
          <li>Recherche auprès des marchands configurés (eBay en V1).</li>
          <li>
            Calcul du prix final : affiché − réductions vérifiées + livraison
            connue + frais obligatoires.
          </li>
          <li>
            Livraison inconnue ou condition non vérifiable → prix affiché
            « PRIX NON VÉRIFIABLE », jamais estimé.
          </li>
          <li>Score de bonne affaire basé uniquement sur des faits (historique, concurrents).</li>
          <li>Alertes : notification uniquement sur un prix vérifié.</li>
        </ol>
      </section>
    </div>
  );
}
