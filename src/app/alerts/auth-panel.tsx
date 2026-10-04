"use client";

/**
 * PANNEAU D'AUTHENTIFICATION (page Mes alertes) — inscription/connexion
 * inline via /api/auth/*. Les erreurs sont affichées, jamais masquées.
 */

import { useState } from "react";

export function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Authentification impossible");
      window.location.reload();
    } catch (e) {
      setError(
        e instanceof Error && e.message === "BASE_DE_DONNEES_INDISPONIBLE"
          ? "Base de données indisponible — vérifier DATABASE_URL."
          : e instanceof Error
            ? e.message
            : "Erreur inconnue"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={mode === "signup" ? "font-bold text-green-700" : "text-slate-500"}
        >
          Inscription
        </button>
        <span className="text-slate-400">|</span>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={mode === "login" ? "font-bold text-green-700" : "text-slate-500"}
        >
          Connexion
        </button>
      </div>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <div>
          <label className="label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="auth-password">
            Mot de passe {mode === "signup" ? "(8 caractères minimum)" : ""}
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}
