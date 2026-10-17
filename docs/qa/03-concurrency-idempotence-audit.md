# Audit — concurrence et idempotence (Chantier 03)

**Date** : 2026-10-17  
**Périmètre** : mandats, approbations propriétaire, ledger / dépenses  
**Sources** : `docs/specs/03-gerance-mandats-comptabilite.md` (critères + deltas 03.1–03.3), code sous `apps/api/src/mandates/**`, `mandate-approval*`, `accounting/**`, specs `mandates*.spec.ts`, `mandate-lifecycle.spec.ts`, `accounting.spec.ts`  
**Statut** : audit uniquement — les gaps listés restent ouverts tant que les tests/contraintes recommandés ne sont pas livrés.

Légende couverture : **yes** = course ou rejeu couvert avec assertion d'effet unique ; **partial** = cas séquentiel / heureux / une seule variante concurrente ; **no** = aucune preuve automatisée.

---

## 1. Matrice opération × risque × couverture

| Opération | Risque de course / doublon | Couverture | Preuve (fichier:ligne) |
|---|---|---|---|
| `acceptMandate` (PROPOSED→ACTIVE) | Double accept → double événement / état incohérent | **yes** | Impl. `updateMany` conditionnel : `mandates.service.ts:256-259`. Course : `mandate-lifecycle.spec.ts:679-728` (1 fulfilled, 1 rejected, 1× `mandate.accepted`). |
| `terminateMandate` (ACTIVE→TERMINATED) | Double résiliation → double notification / motif conflictuel | **yes** | Impl. `mandates.service.ts:684-687`. Course owner+gérant : `mandate-lifecycle.spec.ts:731-761`. |
| `declineMandate` | Double refus / accept+refuse croisés | **partial** | Impl. conditionnelle `mandates.service.ts:329-332`. Refus séquentiel : `mandate-lifecycle.spec.ts:666-670`. **Pas** de `Promise.allSettled` refuse×2 ni accept×decline. |
| `counterMandate` | Double contre-proposition → versions dupliquées | **partial** | Impl. `mandates.service.ts:417-421`. Flux heureux versionné : `mandate-lifecycle.spec.ts:496-540`. Pas de course concurrente. |
| `createMandate` / unicité living property+scope | Deux créations parallèles → 2 mandats ACTIVE/PROPOSED (check-then-insert) | **partial** | Assertion applicative `assertNoConflict` : `mandates.service.ts:1012-1037`. Rejet séquentiel 409 : `mandates.spec.ts:255-265`. **Pas** de contrainte DB unique ni test concurrent. |
| `signMandate` (OTP) | Double signature même partie | **partial** | Rejeu séquentiel `ALREADY_SIGNED` : `mandate-lifecycle.spec.ts:587-590`. Pas de course bi-partie / double OTP. |
| `decideApproval` APPROVE vs REJECT | Double effet (avenant, dépense, loyer) | **yes** (variante RENT_REDUCTION) | CAS `updateMany` PENDING : `mandate-approval.service.ts:218-250`. Course APPROVE\|REJECT : `mandate-lifecycle.spec.ts:763-813` (+1 avenant, 1× event, `APPROVAL_ALREADY_DECIDED`). |
| `decideApproval` rejeu séquentiel | 2e décision après APPROVED/REJECTED/CANCELLED | **yes** | Après cancel : `mandate-lifecycle.spec.ts:485-489`. Guard pré-tx : `mandate-approval.service.ts:189-193`. |
| Effet `RENT_REDUCTION` | Doublon avenant / schedules | **yes** (via course ci-dessus) | Effet unitaire : `mandate-lifecycle.spec.ts:308-357`. Course : `763-813`. |
| Effet `LEASE_SIGN` | Double activation bail / schedules | **partial** | Effet unitaire : `mandate-lifecycle.spec.ts:387-409`. Pas de course dédiée. |
| Effet `EXPENSE` (approbation) | Double `APPROVED` + double `expense.approved` / ledger | **partial** | Effet dans tx : `mandate-approval.service.ts:490-507`. Flux séquentiel : `accounting.spec.ts:397-437`. Pas de course `decideApproval`×2 sur EXPENSE. |
| Effet `MAJOR_REPAIR` / `SALE_PRICE` / offre | Double transition source | **partial** / **no** | Cancel MAJOR_REPAIR : `mandate-lifecycle.spec.ts:467-490`. SALE_PRICE surtout TTL : `433-465`. **Pas** de course d'effet appliqué. |
| `cancelApproval` vs `decideApproval` | Cancel∥Approve → état/effet ambigu | **no** | Cancel conditionnel : `mandate-approval.service.ts:639-641`. Aucun test parallèle cancel×decide. |
| Expiration TTL (`EXPIRED`) puis decide | Décision après expire | **partial** | Expire-on-read + refus decide : `mandate-lifecycle.spec.ts:433-465`. Pas de course expire-job × decide. |
| Revue documentaire (deposit / REJECTED / NEEDS_CORRECTION) | Courses admin×agence, double rejet | **no** (concurrence) | Happy path dépôt/rejet : `mandate-document-review.spec.ts:154-205`. Updates non conditionnés par statut atomique concurrent (`mandate-document-review.service.ts:163-173`). |
| `ledger.recordPayment` (RENT_IN + FEE) | TOCTOU findFirst→create → écritures doublées | **partial** | Idempotence **séquentielle** : `accounting.spec.ts:309-317` (2e appel → 0 entrées). Impl. check-then-create : `ledger.processor.ts:146-198`. **Pas** de `@@unique([sourceType, sourceId, type, …])` sur `LedgerEntry` (`schema.prisma:1879-1899`). **Pas** de `Promise.all` concurrent. |
| `ledger.recordExpense` | Même TOCTOU | **partial** | Rejeu séquentiel : `accounting.spec.ts:386-394`. Impl. : `ledger.processor.ts:223-250`. |
| Handler event `PAYMENT_VALIDATED` / `EXPENSE_APPROVED` rejoué | Double écriture si event bus rejoue | **partial** | Même chemin que `record*` (ci-dessus). Pas de test d'événement rejoué concurrent. |
| Commission 8 % (FEE) sous mandat | Montant faux ou FEE dupliquée | **partial** | Montants corrects séquentiels : `accounting.spec.ts:286-325`. Pas de course multi-allocation / multi-handler. |
| Génération relevé mensuel (cron) | Double PDF / double notif le 5 | **no** | Cron : `ledger.processor.ts:50-90`. Aucun test d'idempotence périodique. |
| Export / summary | Lecture seule | n/a | `accounting.spec.ts:463+` — hors scope course. |

---

## 2. Constat d'implémentation (résumé)

### Ce qui est déjà solide

- Transitions mandat **accept** / **terminate** et décision d'approbation utilisent `updateMany` / CAS sur le statut attendu ; les tests de course dans `mandate-lifecycle.spec.ts` (bloc « Courses et idempotence », ~L675+) valident l'invariant « une seule transition + un seul event ».
- Effets d'approbation sensibles (dont `RENT_REDUCTION`) sont appliqués **dans** la même transaction que le CAS de statut.
- Le ledger est **idempotent en rejeu séquentiel** (second `recordPayment` / `recordExpense` → 0 nouvelle ligne).

### Faiblesses structurelles

1. **Ledger** : idempotence applicative seule (`findFirst` puis `create`), **sans** contrainte d'unicité Prisma/Postgres sur `(sourceType, sourceId, type[, propertyId])`. Sous concurrence réelle (double webhook, double handler), des doublons RENT_IN/FEE/EXPENSE restent possibles — écart explicite des deltas 03.2 / 03.3.
2. **Unicité mandat living** : `assertNoConflict` est un check applicatif ; deux `createMandate` parallèles peuvent passer avant insert.
3. **Couverture des effets d'approbation** : une seule course multi-décision existe (`RENT_REDUCTION` APPROVE vs REJECT). EXPENSE / LEASE_SIGN / MAJOR_REPAIR n'ont pas d'équivalent concurrent.
4. **Revue documentaire (03.6)** : hors du bloc de courses actuel ; transitions non CAS.

---

## 3. Gaps priorisés

### P0 — corriger / prouver avant confiance finance & transitions critiques

| ID | Gap | Pourquoi | Action recommandée |
|---|---|---|---|
| G-P0-1 | Pas de contrainte unique ledger + pas de test concurrent `recordPayment` / `recordExpense` | Doublons monétaires silencieux | Ajouter `@@unique([sourceType, sourceId, type, propertyId])` (ou équivalent documenté), migration, puis test `Promise.allSettled([recordPayment, recordPayment])` → exactement 1× RENT_IN + 1× FEE. |
| G-P0-2 | Course `decideApproval` non couverte pour `EXPENSE` | Double APPROVED + double event ledger | Même pattern que `mandate-lifecycle.spec.ts:763-813` avec actionType EXPENSE ; assert 1 statut dépense + ≤1 écriture ledger après handlers. |
| G-P0-3 | Course create mandat property+scope | Violation critère « deux mandats ACTIVE exclusifs impossibles » | Test concurrent `createMandate`×2 → 1 succès + 1× `MANDATE_CONFLICT` ; idéalement contrainte/ partial unique index living. |

### P1 — fermer les deltas 03.1 / 03.2 restants

| ID | Gap | Action recommandée |
|---|---|---|
| G-P1-1 | `decline` / `accept`×`decline` concurrent | `Promise.allSettled` sur même PROPOSED ; un seul état terminal + un seul event. |
| G-P1-2 | `cancelApproval` ∥ `decideApproval` | Un seul gagnant ; pas d'effet si CANCELLED. |
| G-P1-3 | Course effet `LEASE_SIGN` (et `MAJOR_REPAIR` si applicable) | Assert activation / transition source une seule fois. |
| G-P1-4 | Rejeu event `PAYMENT_VALIDATED` (deux émissions) | Via processor/handler ; count ledger inchangé. |
| G-P1-5 | `counterMandate` concurrent | Une seule nouvelle `MandateVersion` (+ statut cohérent). |

### P2 — robustesse secondaire

| ID | Gap | Action recommandée |
|---|---|---|
| G-P2-1 | Signature OTP concurrente même partie | 1 signature, 2e `ALREADY_SIGNED`. |
| G-P2-2 | Expire-job ∥ decide | Décision post-expire → `APPROVAL_EXPIRED`, source intacte. |
| G-P2-3 | Revue documentaire concurrente (reject×approve, double deposit) | CAS sur `documentReviewStatus` + tests. |
| G-P2-4 | Cron relevé mensuel rejoué | Idempotence statement (clé période+mandat) + une notif. |
| G-P2-5 | Side-effect hors tx : `buildAvenant` avant CAS | Course APPROVE×2 peut uploader 2 PDF même si 1 seul appliqué — acceptable si orphan OK ; sinon déplacer après CAS ou dédupliquer. |

---

## 4. Cas de test recommandés (à ajouter)

Ne pas tous implémenter d'un coup ; ordre suggéré = P0 puis P1.

1. **Ledger concurrent payment** — `accounting.spec.ts`  
   Préparer paiement VALIDATED + allocation loyer sous mandat 8 %.  
   `Promise.allSettled([ledger.recordPayment(id), ledger.recordPayment(id)])`.  
   Assert : `ledgerEntry` count pour `(PAYMENT, id)` = 2 (RENT_IN + FEE), montants 100000 / −8000.  
   **Prérequis** : unique index, sinon le test est flaky/rouge à juste titre.

2. **Ledger concurrent expense** — même fichier, `recordExpense`×2 → 1 ligne EXPENSE.

3. **EXPENSE approval race** — `mandate-lifecycle.spec.ts` ou `accounting.spec.ts`  
   Deux `decideApproval(APPROVE)` parallèles ; dépense APPROVED une fois ; events `expense.approved` / écritures ≤1.

4. **Mandate create race** — `mandates.spec.ts`  
   Deux `createMandate` même property+scopes ; exactement un conflit 409.

5. **Accept vs decline race** — mandat PROPOSED ; états finaux exclusifs ACTIVE|DECLINED ; pas les deux.

6. **Cancel vs approve race** — PENDING ; résultat CANCELLED sans effet **ou** APPROVED avec effet, jamais les deux.

7. **LEASE_SIGN race** — double APPROVE ; un seul bail ACTIVE + schedule non dupliqué (respect index `(leaseId, dueDate, kind)`).

---

## 5. Fichiers de référence rapide

| Zone | Implémentation | Specs |
|---|---|---|
| Mandats | `apps/api/src/mandates/mandates.service.ts` | `mandates.spec.ts`, `mandate-lifecycle.spec.ts`, `mandates.assign.spec.ts` |
| Approbations | `apps/api/src/mandates/mandate-approval.service.ts` | `mandate-lifecycle.spec.ts`, `mandates.spec.ts`, `accounting.spec.ts` |
| Ledger / dépenses | `ledger.processor.ts`, `expenses.service.ts`, `accounting.service.ts` | `accounting.spec.ts` |
| Revue documentaire | `mandate-document-review.service.ts` | `mandate-document-review.spec.ts` |
| Schéma | `apps/api/prisma/schema.prisma` (`Mandate`, `MandateApproval`, `LedgerEntry` ~L1746–1899) | — |

---

## 6. Lien checklist produit

Voir deltas **03.1**, **03.2**, **03.3** dans `docs/specs/03-gerance-mandats-comptabilite.md` : état toujours **Partiel**, avec renvoi explicite vers ce document. Ne pas marquer « fait » tant que G-P0-1…G-P0-3 ne sont pas fermés avec preuves CI.
