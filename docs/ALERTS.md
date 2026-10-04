# ALERTES — types, règles et notifications

## Types (4)

| Type | Déclenche si | Donnée requise |
|------|--------------|----------------|
| `BELOW_PRICE` | prix final vérifié ≤ seuil | `targetPriceCents` |
| `NEW_BEST_PRICE` | prix final vérifié < meilleur historique 90 j | historique (sinon jamais) |
| `BELOW_PRICE_WITH_COUPON` | prix avec coupon VÉRIFIÉ ≤ seuil | `targetPriceCents` |
| `EXCELLENT_DEAL` | dealScore ≥ 90 | historique/concurrents |

## Règles critiques

1. **Jamais de déclenchement sur un prix non vérifiable** (`currentPrice: null`).
2. `NEW_BEST_PRICE` exige un historique ; sans référence, pas d'alerte.
3. `BELOW_PRICE_WITH_COUPON` n'utilise qu'un prix avec coupon **vérifié**.
4. `EXCELLENT_DEAL` : score non évaluable → aucune alerte.
5. Seuil strictement inférieur pour « nouveau meilleur » (pas d'égalité).
6. Une notification par déclenchement ; `lastTriggeredAt` mis à jour.

## Cycle de vie

- Création : `POST /api/alerts` (authentifié, validation Zod : prix cible
  converti en centimes, fréquence 1-168 h).
- Vérification : `checkAlerts()` (service) parcourt les alertes actives échues,
  recalcule le meilleur prix vérifiable, évalue, crée une `Notification`
  (canal `WEB`), met à jour `lastCheckedAt`.
- Suppression : `DELETE /api/alerts/[id]` — uniquement par son propriétaire.
- Cron GitHub Actions : toutes les 6 h (`alerts-cron.yml`).

## Notifications

- Canal V1 : `WEB` (table `Notification`, consultable sur /alerts).
- Email / mobile : colonne `channel` prête, **non implémentés en V2+**.
- Contenu : titre produit, raison chiffrée (centimes), ancien/nouveau prix,
  économie, URL de l'offre, date de vérification.
