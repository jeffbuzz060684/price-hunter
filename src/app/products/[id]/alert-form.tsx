"use client";

/**
 * FORMULAIRE D'ALERTE — client component.
 * 1. Si non connecté : formulaire inline inscription/connexion (honnête :
 *    erreur affichée, jamais ignorée).
 * 2. Création de l'alerte : type + prix cible (si requis) + fréquence.
 *    Le prix cible est envoyé en centimes après validation locale.
 */

import { useEffect, useState } from "react";

const ALERT_TYPES = [
  { value: "BELOW_PRICE", label: "Prix sous un seuil" },
  { value: "NEW_BEST_PRICE", label: "Nouveau meilleur prix historique" },
  { value: "BELOW_PRICE_WITH_COUPON", label: "Prix avec coupon sous un seuil" },
  { value: "EXCELLENT_DEAL", label: "Excellente affaire (score ≥ 90)" }
] as const;

export function AlertForm({ productId }: { productId: string }) {
  const [authState, setAuthState] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [type, setType] = useState<string>("BELOW_PRICE");
  const [targetPrice, setTargetPrice] = useState("");
  const [frequencyHours, setFrequencyHours] = useState("6");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.status === 401 || response.status === 503) {
          setAuthState("signed-out");
        } else {
          setAuthState("signed-in");
        }
      })
      .catch(() => setAuthState("signed-out"));
  }, []);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);
    try {
      const response = await fetch(`/api/auth/${authMode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Authentification impossible");
      }
      setAuthState("signed-in");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function submitAlert(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const needsTarget = type === "BELOW_PRICE" || type === "BELOW_PRICE_WITH_COUPON";
    const body: Record<string, unknown> = {
      productId,
      type,
      frequencyHours: Number(frequencyHours)
    };
    if (needsTarget) {
      const normalized = targetPrice.trim();
      if (!normalized) {
        setSubmitError("Un prix cible est requis pour ce type d'alerte.");
        setSubmitState("error");
        return;
      }
      const value = Number(normalized.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) {
        setSubmitError("Prix cible invalide.");
        setSubmitState("error");
        return;
      }
      body.targetPrice = normalized;
    }
    setSubmitState("loading");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Création impossible");
      setSubmitState("done");
    } catch (e) {
      setSubmitState("error");
      setSubmitError(
        e instanceof Error && e.message === "BASE_DE_DONNEES_INDISPONIBLE"
          ? "Base de données indisponible — vérifier DATABASE_URL."
          : e instanceof Error
            ? e.message
            : "Erreur inconnue"
      );
    }
  }

  if (authState === "checking") {
    return <section className="card">Vérification de la session…</section>;
  }

  if (authState === "signed-out") {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold">Créer une alerte</h2>
        <p className="mt-1 text-sm text-slate-600">
          Connecte-toi (ou crée un compte, gratuit) pour suivre ce produit.
        </p>
        <form onSubmit={submitAuth} className="mt-3 space-y-2">
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={authMode === "signup" ? "font-bold text-green-700" : "text-slate-500"}
            >
              Inscription
            </button>
            <span className="text-slate-400">|</span>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={authMode === "login" ? "font-bold text-green-700" : "text-slate-500"}
            >
              Connexion
            </button>
          </div>
          <div>
            <label className="label" htmlFor="alert-email">
              Email
            </label>
            <input
              id="alert-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="alert-password">
              Mot de passe {authMode === "signup" ? "(8 caractères minimum)" : ""}
            </label>
            <input
              id="alert-password"
              type="password"
              required
              minLength={authMode === "signup" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {authMode === "signup" ? "Créer mon compte" : "Se connecter"}
          </button>
          {authError && <p className="text-sm text-red-700">{authError}</p>}
        </form>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">🔔 Créer une alerte sur ce produit</h2>
      <p className="mt-1 text-xs text-slate-500">
        Les alertes ne se déclenchent que sur un prix VÉRIFIÉ — jamais sur une
        estimation.
      </p>
      <form onSubmit={submitAlert} className="mt-3 space-y-3">
        <div>
          <label className="label" htmlFor="alert-type">
            Type d&apos;alerte
          </label>
          <select
            id="alert-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
          >
            {ALERT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {(type === "BELOW_PRICE" || type === "BELOW_PRICE_WITH_COUPON") && (
          <div>
            <label className="label" htmlFor="alert-target">
              Prix cible (€)
            </label>
            <input
              id="alert-target"
              type="text"
              inputMode="decimal"
              placeholder="ex : 418,99"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="input"
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="alert-frequency">
            Vérification toutes les (heures)
          </label>
          <input
            id="alert-frequency"
            type="number"
            min={1}
            max={168}
            value={frequencyHours}
            onChange={(e) => setFrequencyHours(e.target.value)}
            className="input"
          />
        </div>
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submitState === "loading" || submitState === "done"}
        >
          {submitState === "loading"
            ? "Création…"
            : submitState === "done"
              ? "✅ Alerte créée"
              : "Créer l'alerte"}
        </button>
        {submitError && <p className="text-sm text-red-700">{submitError}</p>}
        {submitState === "done" && (
          <p className="text-sm text-green-700">
            L&apos;alerte est active. Voir{" "}
            <a href="/alerts" className="underline">
              Mes alertes
            </a>
            .
          </p>
        )}
      </form>
    </section>
  );
}
