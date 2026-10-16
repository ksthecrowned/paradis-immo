# Documentation Paradis Immo

Point d'entrée de la documentation du dépôt. La documentation distingue les faits observés dans le code, les décisions d'architecture, les procédures opératoires et les exigences produit. Une exigence écrite dans une spec n'est pas une preuve qu'elle est implémentée ou déployée.

## Démarrer

| Besoin | Référence |
|---|---|
| Comprendre les applications et leurs relations | [Architecture générale](ARCHITECTURE.md) |
| Naviguer dans les domaines API | [Architecture API](architecture/api.md) |
| Comprendre les portails web et l'app mobile | [Architecture clients](architecture/clients.md) |
| Lire les conventions ciblées avant de coder | [Skills](../.skills/README.md) et [routage des tâches](../CLAUDE.md) |
| Installer, tester et contribuer | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Préparer ou diagnostiquer un environnement | [Runbook](ops/runbook.md) |
| Signaler un risque de sécurité | [SECURITY.md](../SECURITY.md) |
| Consulter les décisions structurantes | [ADR](adr/README.md) |
| Préparer une campagne de validation | [QA et release](qa/README.md) |

## Documentation produit et historique

| Dossier | Usage | Statut |
|---|---|---|
| [specs/](specs/README.md) | Exigences produit et deltas d'implémentation des domaines 01–16 | Source canonique des exigences ; statuts locaux à revalider |
| [checklists/](checklists/) | Vérifications ciblées, dont visites et stockage privé | À exécuter dans l'environnement indiqué par chaque checklist |
| [superpowers/specs/](superpowers/specs/) | Conceptions de features datées | Historique de conception ; vérifier la spec canonique et le code avant usage |
| [superpowers/plans/](superpowers/plans/) | Plans d'implémentation datés | Plans de travail, pas une description garantie de l'état courant |

## Statuts documentaires

- **Architecture** décrit les frontières et conventions observées. Relire le code si une décision dépend d'un détail d'implémentation.
- **Spec** décrit le comportement attendu. Le tableau « Delta d'implémentation » indique l'état local connu, jamais la preuve de déploiement.
- **ADR accepté** consigne une décision en vigueur. Un ADR remplacé reste consultable mais ne constitue plus la règle courante.
- **Runbook/checklist** décrit une procédure à suivre. Ne lancer aucune opération destructive ou financière réelle sans les autorisations et sauvegardes requises.
- **Historique** conserve le contexte ; ne pas l'utiliser comme contrat courant.

## Règles de maintenance

1. Ajouter chaque nouveau document de référence à ce sommaire.
2. Lors d'un changement de contrat partagé entre API, web et mobile, mettre à jour chaque document touché dans la même livraison.
3. Dater les audits et préciser s'ils décrivent le code local, un environnement déployé ou une validation manuelle.
4. Signaler les inconnues comme « à vérifier » ; ne pas transformer une intention de spec en fait établi.
5. Garder les secrets, données personnelles et identifiants réels hors de la documentation versionnée.
