---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: finance
audience: agents, humans
---

# Paiements, ledger et reversements

## Où regarder

- `apps/api/src/payments/` — paiements, providers, événements, remboursements et rapprochement.
- `apps/api/src/accounting/` — écritures et agrégats du ledger.
- `apps/api/src/payouts/`, `deposits/`, `leases/`, `bookings/`, `sales/` — cibles et cycles dépendants.
- Schéma Prisma : `Payment`, `PaymentAllocation`, `LedgerEntry`, `Refund`, `Payout`, `PaymentEvent`.
- Références produit : specs 03, 04, 05, 07, 08 et gate 16.3.

## Invariants

- Le serveur confirme le payeur, la cible, la devise et le montant dû ; un montant client n'est pas une autorité.
- Idempotence et contraintes persistées doivent couvrir retries HTTP, concurrence, callbacks doublés et événements rejoués.
- Aucun succès financier ne vient d'un écran client. Utiliser la confirmation fournisseur vérifiée ou une validation manuelle autorisée et auditée.
- Garder paiement, allocation, échéance, ledger, reçu, remboursement et reversement cohérents, y compris sur callbacks tardifs/échoués.
- Une opération externe ne participe pas à la transaction PostgreSQL : modéliser initiation, attente, confirmation, expiration et reprise.
- Les sommes agrégées doivent préciser devise, périmètre, période et statut comptable.
- Les remboursements/reversements simulés ou sandbox ne sont pas des intégrations réelles validées.

## Processus de changement

1. Identifier l'acteur autorisé, la cible métier et l'invariant financier.
2. Vérifier les chemins de succès, refus, timeout, duplication, désordre, remboursement et reprise.
3. Tester concurrence/idempotence ainsi que les assertions sur allocation et ledger.
4. Ne jamais déclencher de paiement réel dans un test automatisé.
5. Maintenir les écrans d'attente/échec et l'état serveur cohérents.

## À éviter

- Éditer une échéance ou un solde en contournant le ledger.
- Traiter une réponse de lancement USSD comme un paiement confirmé.
- Retenter un transfert sortant sans clé/idempotence ni vérification du statut antérieur.
- Copier des credentials ou des références sensibles dans tests/docs.

## Validation de production

Les adaptateurs locaux ne prouvent pas la connectivité fournisseur. Suivre la checklist du fournisseur et les preuves manuelles dans les specs 05/16 avant d'activer des fonds réels.

## Références

- [Spec paiements](../docs/specs/05-paiements-remboursements-reversements.md)
- [Spec préparation au lancement](../docs/specs/16-preparation-lancement-et-exigences-transverses.md)
- [Auth et accès](auth-and-access.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
