# 🎯 Price Hunter

Comparateur de prix **honnête** : prix réellement payable, vérifié, **jamais simulé**.

- Prix final = prix affiché − réductions **vérifiées** + livraison **connue** + frais obligatoires.
- Livraison inconnue → **PRIX NON VÉRIFIABLE** affiché tel quel, jamais estimé.
- Source indisponible → `SOURCE_UNAVAILABLE` / `API_KEY_REQUIRED` affichés, jamais comblés.
- Montants en **centimes entiers** (41899 = 418,99 €) — aucune erreur de virgule flottante.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript strict · Tailwind CSS · Prisma 5 (PostgreSQL) · Zod · Vitest · Playwright.

## Démarrage local

```bash
docker compose up -d          # PostgreSQL
npm install
cp .env.example .env          # renseigner SESSION_SECRET (openssl rand -hex 32)
npm run db:migrate
npm run dev                   # http://localhost:3000
```

## Clés eBay (gratuites)

1. Créer un compte sur [developer.ebay.com](https://developer.ebay.com).
2. Créer une application → récupérer **App ID (Client ID)** et **Cert ID (Client Secret)**.
3. Renseigner `EBAY_CLIENT_ID` et `EBAY_CLIENT_SECRET` dans `.env`.

Sans ces clés, l'application fonctionne et affiche honnêtement « clés API nécessaires ».

## Tests

```bash
npm test                      # Vitest (unitaires, dont Zod)
node tools/local-tests.mjs    # harnais local sans node_modules (Node 22)
npm run test:e2e              # Playwright (skippé sans clés eBay)
npm run typecheck             # tsc --noEmit
```

## Déploiement en ligne (Vercel + Neon) — app ouvrable par URL, installable

1. **Base PostgreSQL gratuite** : [neon.tech](https://neon.tech) (ou Supabase) → copier la chaîne `DATABASE_URL`.
2. **Importer le repo sur Vercel** : [vercel.com/new](https://vercel.com/new) → importer `price-hunter` → Framework détecté Next.js.
3. **Variables d'environnement Vercel** (Settings → Environment Variables) :
   - `DATABASE_URL` (Neon)
   - `SESSION_SECRET` (`openssl rand -hex 32`)
   - `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_MARKETPLACE_ID=EBAY_FR`
4. **Migration** : depuis un terminal local avec `DATABASE_URL` de Neon :
   ```bash
   npx prisma migrate deploy
   ```
   (ou via le bouton Vercel « Prisma migrate » / un job CI)
5. L'app est en ligne : `https://price-hunter-xxx.vercel.app`.

### Installation sur l'écran d'accueil (PWA)

Ouvrir l'URL sur téléphone (Chrome Android / Safari iOS) → menu ⋮ / Partager →
**« Ajouter à l'écran d'accueil »** → icône Price Hunter s'ouvre en plein écran
comme une app native. Le service worker ne met **jamais** en cache `/api/` :
les prix sont toujours frais.

## Alertes automatiques

Le workflow GitHub Actions `.github/workflows/alerts-cron.yml` vérifie les
alertes toutes les 6 h. Renseigner dans les **secrets du dépôt** :
`DATABASE_URL`, `SESSION_SECRET`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — vue d'ensemble
- [docs/PRICE_ENGINE.md](docs/PRICE_ENGINE.md) — moteur de prix et règles anti-simulation
- [docs/MERCHANT_ADAPTER.md](docs/MERCHANT_ADAPTER.md) — connecteurs marchands
- [docs/ALERTS.md](docs/ALERTS.md) — alertes et notifications
- [STATUS.md](STATUS.md) — état réel du projet (ce qui est testé, ce qui manque)
