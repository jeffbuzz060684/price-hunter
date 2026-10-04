# MOTEUR DE PRIX — règles et exemples

## Principes

- Déterministe et pur : `calculateFinalPrice(input) → FinalPriceResult`.
- Montants en **centimes entiers**. 418,99 € = `41899`.
- Devise **EUR uniquement** en V1 → `CurrencyMismatchError` sinon.

## Formule

```
finalPrice = max(0, affiché − réductionsAppliquées − couponsAppliqués
                     + fraisObligatoires + livraisonConnue − cashbackVérifié)
```

- `livraisonConnue` : `FREE → 0`, `PAID → coût`, `UNKNOWN`/`CALCULATED_AT_CHECKOUT → null`
  → **finalPrice = null** (confidence `UNVERIFIABLE`).

## Réductions : quand est-elle appliquée ?

| verificationStatus | conditions                | résultat                       |
|--------------------|---------------------------|--------------------------------|
| EXPIRED / INVALID  | —                         | jamais appliquée, non listée   |
| UNVERIFIED         | —                         | potentielle (`CODE_NON_VERIFIE`) |
| VERIFIED           | toutes `satisfied: true`   | appliquée                      |
| VERIFIED           | MIN_BASKET `satisfied: false` | potentielle (`MIN_BASKET_NON_ATTEINT`) |
| VERIFIED           | `satisfied: null`         | potentielle (`CONDITION_NON_VERIFIABLE`) |
| VERIFIED           | autre condition `satisfied: false` | écartée              |

## Cashback

- `VERIFIED` + conditions toutes vraies → appliqué.
- `VERIFIED` + une condition fausse → zéro.
- `CONDITIONAL` → potentiel (`CASHBACK_CONDITIONNEL`).
- `INVALID` → ignoré.

## Confiance

- `EXACT` : prix final calculé, aucun élément non vérifié.
- `PARTIAL` : prix final calculé + réductions potentielles listées.
- `UNVERIFIABLE` : prix final `null` (livraison inconnue…), raisons listées.

## Exemple pivot (spec)

499 € affiché − 50 € promo vérifiée − 30 € code vérifié + 9,99 € livraison
− 10 € cashback vérifié = **418,99 €** (`41899`).

```ts
calculateFinalPrice({
  displayedPrice: money(49900),
  discounts: [promo(5000)],           // VERIFIED
  coupons: [code(3000)],              // VERIFIED
  shipping: { status: "PAID", cost: 999 },
  mandatoryFees: [],
  cashback: { amount: 1000, verificationStatus: "VERIFIED", conditions: [] }
});
// → { finalPrice: 41899, confidence: "EXACT", potential: [] }
```

## Score de bonne affaire (deal-score)

0-100, cinq composantes : position historique 90 j (40), écart moyenne 30 j
(20), concurrence (15), fiabilité EXACT/PARTIAL/UNVERIFIABLE (15),
disponibilité (10). Historique < 7 points → composantes historiques neutres
+ drapeau `historyInsufficient`. Rupture ou prix non vérifiable → 0
« NON ÉVALUABLE ». **Aucune prédiction de prix futur.**
