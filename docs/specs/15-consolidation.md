# 15 — Consolidation : index des chantiers

> Cette spec coordonne les travaux transverses des specs 01–14. Les exigences détaillées et critères d'acceptation restent dans leur spec source et son tableau « Delta d'implémentation » ; cette page ne les duplique pas.
> État local constaté le 2026-10-11. Les mentions « en place localement » ne signifient pas que les tests sont passés.

## Inventaire consolidé

### P0 — Bloc A
| ID | Chantier | Référence canonique | État local | Suite |
|---|---|---|---|---|
| A1 | Éligibilité maintenance et périmètre mandat | 09, delta 09.1 | Machine à états et assignation présentes ; contrôle d'accès et périmètre restent à vérifier/compléter. | Terminer 09.1 |
| A2 | Modération avec motif et notification | 12, delta 12.1 | Motif présent localement ; notification avec motif à vérifier. | Terminer 12.1 |
| A3 | Audit log des actions sensibles | 12, delta 12.1 | Base du journal présente ; couverture des actions et endpoint à valider. | Terminer 12.1 |
| A4 | Utiliser `app/config` et appliquer la version minimale au mobile | 14, delta 14.1 | Endpoint présent ; consommateur mobile et écran bloquant absents. | Terminer 14.1 |

### P1 — Bloc B
| ID | Chantier | Référence canonique | État local | Suite |
|---|---|---|---|---|
| B1 | États des lieux | 04, sections Endpoints / Critères d'acceptation | Service et contrôleur locaux ; restent l'immuabilité après une seule signature, OTP, photos et PDF. | Poursuivre dans la spec 04, sans recréer un chantier ici. |
| B2 | RBAC admin et TOTP | 12, delta 12.2 | TOTP et premiers éléments RBAC présents localement ; couverture des permissions et garde des routes à terminer. | Terminer 12.2 |
| B3 | Favoris avec biens embarqués | 14, delta 14.2 | Implémentation en cours localement. | Terminer 14.2 et valider l'absence de N+1. |
| B4 | Filtres de recherche de base | 13, delta 13.2 | Filtres étendus et visibilité publique présents localement ; les compléments sont suivis dans 13.2. | Continuer 13.2 ; ne pas rouvrir les filtres déjà livrés. |
| B5 | Devis, seuils d'approbation et affectation prestataire | 09, deltas 09.3–09.4 ; 03 pour approbations | Reste à réaliser/intégrer. | Suivre 09.3–09.4 et les critères de la spec 03. |

### P2 — Bloc C
| ID | Chantier | Référence canonique | État local | Suite |
|---|---|---|---|---|
| C1 | Suivi des prestataires par l'agence et plans préventifs | 09, deltas 09.4–09.5 | Non réalisé. | L'agence centralise les contacts, devis et pièces ; aucun accès direct prestataire. Suivre 09.4–09.5. |
| C2 | Biens similaires, suggestions, recherches sauvegardées et alertes | 13, delta 13.4 | Non réalisé. | Suivre 13.4. |
| C3 | Impersonation et KPI admin avancés | 12, delta 12.4 | Non réalisé. | Suivre 12.4. |
| C4 | Notifications temps réel sur le web | 10, delta 10.5 | Non réalisé ; polling acceptable pour le MVP. | Suivre 10.5. |
| C5 | Visite virtuelle, miniatures, SEO et partage documentaire | 13, delta 13.5 | Non réalisé ou partiel. | Suivre 13.5. |

## Règles de suivi
- Toute tâche détaillée doit avoir une seule définition canonique dans le delta de sa spec source. Cette page ne garde que la priorité transverse et un lien de suivi.
- Les changements existants sont à compléter plutôt qu'à réécrire ; les migrations restent manuelles si la shadow DB est indisponible.
- Chaque delta livré doit avoir des tests ciblés. Exécuter les vérifications TypeScript et les suites des modules touchés avant clôture.
