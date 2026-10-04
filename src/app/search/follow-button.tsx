"use client";

/**
 * BOUTON « Suivre ce produit » — persiste le cluster de recherche
 * (POST /api/search/persist) puis redirige vers la page produit
 * où l'utilisateur peut créer une alerte.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FollowButton({ query, clusterIndex }: { query: string; clusterIndex: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function follow() {
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/search/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, clusterIndex })
      });
      const data = (await response.json()) as { productId?: string; error?: string };
      if (!response.ok || !data.productId) {
        throw new Error(data.error ?? "Enregistrement impossible");
      }
      router.push(`/products/${data.productId}`);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  return (
    <div>
      <button type="button" onClick={follow} disabled={state === "loading"} className="btn-primary text-sm">
        {state === "loading" ? "Enregistrement…" : "🔔 Suivre ce produit (alerte)"}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-700">
          {error === "BASE_DE_DONNEES_INDISPONIBLE"
            ? "Base de données indisponible — vérifier DATABASE_URL puis réessayer."
            : error}
        </p>
      )}
    </div>
  );
}
