# ARCHITECTURE — Price Hunter

## Vue d'ensemble

```
src/
  app/                    # Next.js 14 App Router
    api/                  # routes REST (search, products, alerts, auth)
    products/[id]/        # page produit + historique
    search/               # recherche live
    alerts/               # page « Mes alertes »
  lib/
    types.ts              # Money (centimes), conditions, erreurs
    validation.ts         # Zod : toutes les entrées API validées
    price-engine/         # moteur de prix + score de bonne affaire
    product-matching/     # matchScore, seuils, rejets durs
    coupons/              # sélection déterministe des codes promo
    merchants/            # MerchantAdapter + adapter eBay + registre
    search/service.ts     # orchestration recherche → clusters → persistance
    alerts/               # evaluateAlert (pur) + service (Prisma)
    history/stats.ts      # statistiques glissantes 7/30/90 j
    auth/                 # scrypt + sessions cookie signées HMAC
    db/client.ts          # singleton Prisma
  tests/                  # Vitest (unitaires purs)
e2e/                      # Playwright (parcours réel, skippé sans clés)
scripts/check-alerts.ts   # vérification périodique (cron GitHub)
prisma/                   # schéma + migrations
public/                   # manifest PWA, service worker, icônes
```

## Invariants anti-simulation

1. **Centimes entiers** partout (`Money.amount: number`, `money()` refuse le
   flottant).
2. **EUR uniquement** en V1 → `CurrencyMismatchError` sinon (aucune conversion
   inventée).
3. **Prix final `null`** si la livraison est inconnue — jamais estimé.
4. **Réductions** : appliquées seulement si VÉRIFIÉES et conditions remplies ;
   `satisfied: null` → « potentielle », jamais soustraite.
5. **Sources** : un marchand non configuré renvoie un statut explicite
   (`API_KEY_REQUIRED`, `SOURCE_UNAVAILABLE`), jamais de données fictives.
6. **Alertes** : aucun déclenchement sur un prix non vérifiable.
7. **Historique** : aucune prédiction ; « insuffisant » si < 7 points sur 30 j.

## Flux de recherche

1. `/api/search` (ou page `/search`) → `searchProducts()` interroge les
   marchands **configurés** en parallèle.
2. Chaque offre → `computeOfferPrice()` (moteur déterministe).
3. `clusterOffers()` regroupe par similarité de titre ≥ 70 (affichage).
4. `persistSearchOutcome()` (bouton « Suivre ce produit ») écrit
   Merchant/Product/Offer/PriceHistory via Prisma.
5. Page produit : meilleur prix réel, autres offres, deal score, stats.
6. Formulaire d'alerte → `POST /api/alerts` (auth requise).

## Sessions

- Mots de passe : **scrypt** (salt 16 o, clé 64 o) — jamais en clair.
- Cookie `ph_session` : payload `{userId, issuedAt}` signé HMAC-SHA256
  (`SESSION_SECRET` ≥ 32 caractères), httpOnly, 30 jours.
- Pas de dépendance d'auth externe (NextAuth etc.) en V1.

## PWA

- `manifest.webmanifest` : standalone, thème `#16a34a`, icônes 192/512.
- `sw.js` : **jamais de cache sur `/api/`** (prix toujours frais) ;
  navigation network-first avec repli hors ligne ; statiques cache-first.
- Icônes générées par `tools/gen-icons.js` (PNG pur Node, aucun binaire).
