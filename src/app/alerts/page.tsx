/**
 * PAGE MES ALERTES — connexion/inscription si besoin, puis liste des alertes
 * et notifications. Chaque alerte affiche le produit, le type et le seuil.
 * Notifications : uniquement des faits vérifiés (aucune alerte sur prix estimé).
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { listAlerts, listNotifications } from "@/lib/alerts/service";
import { formatCents } from "@/lib/types";
import { AuthPanel } from "./auth-panel";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  BELOW_PRICE: "Prix sous le seuil",
  NEW_BEST_PRICE: "Nouveau meilleur prix",
  BELOW_PRICE_WITH_COUPON: "Prix avec coupon sous le seuil",
  EXCELLENT_DEAL: "Excellente affaire"
};

export default async function AlertsPage() {
  let user = null;
  let dbError: string | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <section className="card">
          <h1 className="text-xl font-bold">Mes alertes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Connecte-toi pour voir tes alertes prix et tes notifications.
          </p>
        </section>
        <AuthPanel />
      </div>
    );
  }

  let alerts: Awaited<ReturnType<typeof listAlerts>> = [];
  let notifications: Awaited<ReturnType<typeof listNotifications>> = [];
  try {
    [alerts, notifications] = await Promise.all([listAlerts(user.id), listNotifications(user.id)]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue";
  }

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Mes alertes</h1>
        <span className="text-sm text-slate-500">{user.email}</span>
      </section>

      {dbError && (
        <section className="card border-red-300 bg-red-50">
          <h2 className="font-semibold text-red-900">BASE DE DONNÉES INDISPONIBLE</h2>
          <p className="mt-1 text-sm text-red-900">{dbError}</p>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Alertes actives</h2>
        {alerts.length === 0 && !dbError && (
          <p className="mt-2 text-sm text-slate-600">
            Aucune alerte. Cherche un produit puis clique « Suivre ce produit ».
          </p>
        )}
        <ul className="mt-2 divide-y divide-slate-100">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <a
                  href={`/products/${alert.productId}`}
                  className="truncate text-sm font-medium text-green-700 underline"
                >
                  {alert.product.title}
                </a>
                <p className="text-xs text-slate-500">
                  {TYPE_LABELS[alert.type] ?? alert.type}
                  {alert.targetPriceCents !== null && ` · seuil ${formatCents(alert.targetPriceCents)}`}
                  {" "}· toutes les {alert.frequencyHours} h ·{" "}
                  {alert.active ? "active" : "inactive"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {notifications.length === 0 && !dbError && (
          <p className="mt-2 text-sm text-slate-600">
            Aucune notification. Les alertes ne se déclenchent que sur un prix
            vérifié.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-lg bg-slate-100 p-3">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-slate-700">{n.body}</p>
              <p className="mt-1 text-xs text-slate-500">
                {n.createdAt.toLocaleString("fr-FR")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
