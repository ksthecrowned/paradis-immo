# Instructions agents et contributeurs — Paradis Immo

## Point d'entrée documentaire

Lire `README.md`, puis `docs/README.md` et `docs/ARCHITECTURE.md`. Pour la tâche courante, consulter la spec produit et 1 à 3 skills routées dans `CLAUDE.md` et `.skills/README.md`. Ne pas charger tout le dossier de skills par défaut.

## Dépôt et couches

- `apps/api` : NestJS, Prisma, PostgreSQL ; autorité des règles métier et autorisations.
- `apps/web` : Next.js, site public et portail de gestion.
- `apps/mobile` : Expo, application clients finaux.
- `docs/specs` : exigences produit et delta d'implémentation.
- `.skills` : conventions opérationnelles ciblées à consulter avant de coder.
- `docs/architecture`, `docs/ops`, `docs/qa`, `docs/adr` : architecture, exploitation, validation et décisions.

## Règles de travail

- Inspecter le code courant et l'état du worktree avant modification. Ne jamais écraser ou annuler des changements préexistants.
- Une règle produit ou permission sensible est implémentée côté API ; l'UI seule ne sécurise pas les données.
- Changer chaque surface consommatrice concernée (API, web public/gestion, mobile, schéma, événements) et ses tests/docs.
- Ne pas déclarer une fonctionnalité « stable », « complète » ou « prête prod » sur la seule base d'une spec ou d'un build local.
- Distinguer les états d'erreur des données vides et ne pas fabriquer un succès client.
- Ne jamais committer ou divulguer secrets, tokens, OTP, données personnelles ou pièces réelles.
- Une modification de schéma doit avoir migration, génération et tests ciblés. Une opération réelle de migration, paiement, payout ou stockage requiert autorisation et procédure.
- Pour une décision multi-domaines ou difficile à inverser, créer/mettre à jour un ADR.
- Mettre à jour les docs et skills invalidés par un changement de code.

## Validation

Lancer les tests les plus ciblés qui prouvent le comportement, puis build/lint pertinents selon les manifests. Les E2E et les opérations DB peuvent exiger une base dédiée : inspecter leur configuration avant exécution.

## Fin de tâche

Résumer les changements, les tests réellement exécutés, les limites et les contrôles manuels restant à faire. Ne pas confondre changements locaux et déploiement.
