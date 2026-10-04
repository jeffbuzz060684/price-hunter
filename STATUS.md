# STATUS — état réel du projet (2026-10-04)

## ✅ Fonctionnel et testé (harnais local : 132 tests OK / 0 échec)

- **Moteur de prix** : prix final déterministe, centimes entiers, devise EUR
  unique, réductions vérifiées uniquement, livraison inconnue → `null`.
- **Matching produits** : EAN > réf. fabricant > SKU > modèle > titre (plafonné
  75), conflits de variantes (35), rejet dur EAN/référence.
- **Score de bonne affaire** : 0-100 sur 5 composantes, basé sur des faits.
- **Coupons** : sélection déterministe, EXPIRED/INVALID jamais utilisables,
  UNVERIFIED = potentiels uniquement.
- **Alertes** : 4 types, jamais de déclenchement sur prix non vérifiable,
  NEW_BEST_PRICE exige un historique.
- **Historique** : stats 7/30/90 jours, insuffisant si < 7 points sur 30 j.
- **Adapter eBay Browse API** : OAuth client credentials, statuts honnêtes
  (`OK`/`SOURCE_UNAVAILABLE`/`RATE_LIMITED`), EAN jamais inventé.

## 🔑 Nécessite une configuration utilisateur (gratuite)

- **eBay** : clés `developer.ebay.com` (Browse API, 5 000 appels/jour).
- **PostgreSQL** : docker compose en local, Neon/Supabase en ligne.
- **SESSION_SECRET** : 32 caractères minimum.

## ⚠️ À valider par la CI au premier push

- `tsc --noEmit` (typecheck) et `next build` : le sandbox de développement ne
  dispose pas de node_modules ; ces étapes tournent dans GitHub Actions.
- Vitest (139 tests au total avec la validation Zod) et Prisma migrate.

## ❌ Non implémenté (V2)

- **Amazon PA-API** : réservée aux affiliés avec ventes qualifiées — non
  supportée en V1, aucun prix Amazon n'est donc affiché.
- Notifications **email / mobile** (canal WEB uniquement, table prête).
- **Autres marchands français** (Fnac, Cdiscount…) : pas d'API publique de
  prix, non déclarés supportés.
- Coupons eBay : l'API Browse ne les expose pas — jamais inventés.

## Limites documentées de la source eBay (V1)

- Pas d'EAN dans les résultats → matching titre plafonné à 75 (sous le seuil
  de fusion 80) : regroupement affichage, jamais fusion d'identités.
- Livraison parfois absente → prix final `null` (PRIX NON VÉRIFIABLE).
- Disponibilité souvent `UNKNOWN`.
- Marketplace : les vendeurs tiers eBay sont la norme (`marketplace = true`).
