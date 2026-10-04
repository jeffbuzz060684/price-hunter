# MARCHANDS — contrat MerchantAdapter

## Interface

Chaque source de prix implémente `MerchantAdapter` (`src/lib/merchants/types.ts`) :

- `searchProduct(query)` → `MerchantSearchResult { status, offers, error? }`
- `status()` → clés présentes ou non (`configured`, `missingEnv`)

Statuts possibles : `OK`, `SOURCE_UNAVAILABLE`, `API_KEY_REQUIRED`,
`NOT_IMPLEMENTED`, `RATE_LIMITED`.

**Règle absolue : aucune donnée inventée.** Un marchand non configuré ou
indisponible renvoie un statut explicite, jamais un prix fictif.

## eBay Browse API (V1, seule source)

- **Auth** : OAuth client credentials — `POST api.ebay.com/identity/v1/oauth2/token`.
- **Recherche** : `GET /buy/browse/v1/item_summary/search?q=...&limit=...`
  avec `X-EBAY-C-MARKETPLACE-ID: EBAY_FR`.
- **Env** : `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_MARKETPLACE_ID`
  (défaut `EBAY_FR`). Clés gratuites sur developer.ebay.com (5 000 appels/jour).
- Token mis en cache jusqu'à expiration (−60 s de marge).

### Mapping honnête des résultats

- Prix absent → `displayedPriceCents: null` → PRIX NON VÉRIFIABLE.
- `shippingOptions` absent → `shipping: UNKNOWN` → prix final `null`.
- `buyingOptions` contient `FIXED_PRICE` → `IN_STOCK`, sinon `UNKNOWN`.
- **EAN : jamais fourni par l'API search → `ean: null`, jamais inventé.**
- `marketplace: true` (vendeurs tiers = norme sur eBay).

## Ajouter un marchand

1. Créer `src/lib/merchants/<id>/adapter.ts` implémentant `MerchantAdapter`.
2. L'enregistrer dans `registry.ts` (`getMerchantAdapters`).
3. Ajouter ses variables d'environnement dans `.env.example`.
4. Tests unitaires du mapping (statuts honnêtes inclus).

## Sources NON supportées en V1

- **Amazon PA-API** : réservée aux affiliés avec ventes qualifiées
  (conditions d'éligibilité Amazon) → non intégrée, aucun prix Amazon affiché.
- **Fnac, Cdiscount, etc.** : pas d'API publique de prix → non déclarés
  supportés. Ne JAMAIS annoncer un marchand sans connecteur fonctionnel.
