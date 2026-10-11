# 15 — Consolidation : backlog canonique des specs

> Cette page donne l'ordre de travail et un état synthétique des specs 01–14. Les exigences détaillées restent canoniques dans chaque spec source ; les preuves de préparation au lancement restent dans la spec 16.
> État documentaire consolidé le 2026-10-11 à partir des fichiers locaux. « Présent localement » ou « implémenté » ne signifie ni déployé ni vérifié manuellement.

## Ordre de traitement

Les dépendances ci-dessous sont des prérequis de sécurité et de données ; les sujets indépendants peuvent avancer en parallèle après le premier audit.

| Ordre | Lot | Références canoniques | Condition de sortie |
|---|---|---|---|
| 0 | Consolider les bases 01–05 et traiter les écarts partiels | Deltas 01.1–05.4 | Chaque delta est marqué implémenté, partiel ou restant ; les autorisations, transitions concurrentes et écarts financiers prioritaires sont couverts par des tests ciblés. |
| 1 | Isolation multi-agences, RBAC et accès aux données/fichiers | 01.1–01.3, 02.2, 03.1, 04.1, 09.1, 10.2, 12.1–12.2, 13.1 ; critères 16.1 | Tests positifs et négatifs par rôle, agence, mandat, identifiant direct et liste ; les fichiers privés ne divulguent ni URL publique ni contenu hors périmètre. |
| 2 | Exactitude et autorisation des paiements | 05.1–05.2 ; allocation/ledger 03.2–03.3 ; critères 16.3 | Montant et payeur décidés côté serveur, états et callbacks idempotents ; adaptateurs fournisseur validés selon la checklist manuelle 05. |
| 3 | Cycle financier métier | 03.2–03.3, 04.2–04.3, 05.3–05.4, 07.1, 08.3–08.4, 09.3 | Allocations, remboursements, caution, frais et reversements réconciliés au ledger, avec autorisations testées. |
| 4 | Compléter les parcours métier et leurs événements | 02.1–02.4, 03.1–03.4, 04.1–04.4, 06.3–06.5, 07.1–07.4, 08.1–08.4, 09.2–09.5, 10.1–10.5, 11.1–11.4, 12.1–12.4, 13.2–13.5 | API et états métier sont cohérents ; chaque événement attendu a son destinataire/handler documenté et ses tests ciblés. |
| 5 | Interfaces et préparation au lancement | 14.1–14.5 ; critères 16.2, 16.4–16.6 | Parcours mobiles clients et portail de gestion disponibles ; portes applicables de la spec 16 possèdent leurs preuves et responsables. |

Les tâches de code actuellement suivies comme **isolation sécurité**, **flux financiers**, **workflows métier** et **parcours mobile** correspondent à cet ordre : sécurité précède les flux financiers ; ceux-ci précèdent les parcours métier qui en dépendent ; les interfaces réutilisent les contrats métier stabilisés. Aucun contrôle manuel de production, de banque, de bucket ou de store n'est remplacé par une ligne de ce backlog.

## Inventaire unique

| Spec | Deltas canoniques | État synthétique local |
|---|---|---|
| [01 — Compte et sécurité](01-compte-securite-conformite.md) | 01.1–01.4 | Sessions, OTP, changements vérifiés, export et KYC privé présents ; lookup par numéro toujours global, purge différée et couverture de l'export à confirmer. |
| [02 — Organisations et équipes](02-organisations-equipes.md) | 02.1–02.4 | Demandes, invitations, membres, vitrine, avis et métriques présents ; plusieurs accès exigent maintenant une appartenance ACTIVE, mais la matrice complète, l'acceptation concurrente, signalements et modération restent à auditer. |
| [03 — Mandats et comptabilité](03-gerance-mandats-comptabilite.md) | 03.1–03.4 | Cycle, approbations et effets transactionnels présents ; accès de portefeuille/détail/actions limité aux membres actifs et agents affectés ; idempotence concurrente du ledger, commissions et fonctions P2 restent ouverts. |
| [04 — Bail et caution](04-bail-caution-etats-des-lieux.md) | 04.1–04.4 | Cycle du bail, signatures, échéances, quittances et EDL/documents privés présents ; l'autorisation de réserve gestionnaire est corrigée ; caution, candidatures/solvabilité, concurrence et options P2 restent incomplets. |
| [05 — Paiements](05-paiements-remboursements-reversements.md) | 05.1–05.4 | Collecte mobile-money et webhooks, remboursements/litiges, reversements simulés, validation espèces et rapprochement présents ; aucune exécution réelle ou validation fournisseur/production n'est attestée. |
| [06 — Visites](06-visites.md) | 06.1–06.5 | 06.1 réservation atomique, compte rendu, rappels et affectation API/web d'agent sont implémentés localement ; les routes de clôture/H+24 restent à valider manuellement. Reprogrammation/remboursement effectif, affectation aux templates, agenda avancé et parcours mobile restent à faire. |
| [07 — Séjours](07-sejours-courte-duree.md) | 07.1–07.4 | Flux de cycle, devis et changements mobile locaux ; listes et réservations pour tiers appliquent le périmètre propriété/mandat actif. Concurrence/disponibilité doit être auditée ; reprogrammation, blocages, iCal et écrans web restent à faire. |
| [08 — Vente](08-vente.md) | 08.1–08.4 | Demandes et API d'offres/contre-offres sont présentes localement ; le suivi mobile, les interfaces d'offre, le compromis et ses jalons restent incomplets. |
| [09 — Maintenance](09-maintenance.md) | 09.1–09.5 | Machine à états et assignation locales ; lecture des listes est limitée aux biens opérables, avec tests gérant actif/agent non affecté. Matrice complète, commentaires/fichiers, devis, factures, prestataires gérés par l'agence et plans préventifs restent à faire. |
| [10 — Messagerie](10-messagerie.md) | 10.1–10.5 | API locale présente ; ouverture des contextes métier limitée au participant lié et lecture gestionnaire alignée sur l'accès opérable au bien. Interfaces, assignation, pièces jointes, notifications, modération et fonctions temps réel restent à faire. |
| [11 — Notifications](11-notifications.md) | 11.1–11.4 | Plusieurs handlers sont ajoutés localement ; matrice complète, retry, échec et préférences restent à vérifier/compléter. |
| [12 — Admin](12-admin-back-office.md) | 12.1–12.4 | API de modération, motif, audit et TOTP/RBAC initiaux sont présents localement ; couverture des permissions, journaux, notification de décision et interfaces restent à valider/compléter. |
| [13 — Recherche et annonces](13-recherche-annonces.md) | 13.1–13.5 | Filtres, visibilité publique, vues et signalements sont présents localement ; autorisation/URLs des documents restent à vérifier. Carte, alertes, médias et fonctions avancées restent à faire. |
| [14 — Mobile transverse](14-mobile-transverse.md) | 14.1–14.5 | SecureStore, API `app/config`, devices, aperçu d'annulation et des parcours locaux sont présents ; adoption mobile de `app/config`, écrans de gestion et validation de bout en bout restent à faire. |

## Décisions encore ouvertes

| Sujet | Référence | Décision requise avant |
|---|---|---|
| Modèle commercial SaaS, limites, essai, facturation, taxes et cycle d'abonnement | [Spec 16, section 5](16-preparation-lancement-et-exigences-transverses.md#5-modèle-commercial-de-la-plateforme--décision-ouverte) | Toute activation ou communication de facturation logicielle aux agences. |
| Frais de transfert, politiques de remboursement et seuils d'approbation | Specs 03, 05, 06 et 07 | Toute opération financière réelle ; expliciter les valeurs/configurations par organisation et pays avant activation. |
| Périmètre des fonctionnalités activées au premier lancement | [Spec 16, sections 2 et 6](16-preparation-lancement-et-exigences-transverses.md#6-porte-de-lancement) | Publication iOS/Android et ouverture des parcours réels. Les éléments non prêts doivent être désactivés/masqués. |

Ne pas inventer les choix commerciaux, juridiques ou financiers : garder ces points « à décider/valider » jusqu'à approbation explicite et consigner la décision dans la spec canonique.

## Règles de maintien

- Chaque exigence détaillée a une seule définition dans le delta de sa spec source ; cette page ne réécrit pas ses critères fonctionnels.
- Pour 01–05, les statuts sont une inspection du code local, pas une preuve de déploiement, de conformité métier complète ni de validation manuelle ; les écarts explicitement listés dans chaque delta restent ouverts.
- Pour 01–14, réviser la ligne de synthèse dès qu'une livraison locale modifie un delta ; distinguer toujours « code présent », « tests automatisés » et « preuve manuelle/déploiement ».
- Les vérifications manuelles restent documentées dans les checklists/portes de lancement ; ne pas exécuter de contrôle sur les systèmes de production depuis le travail local.
- Chaque changement de code doit passer ses tests ciblés et validations applicables. Les migrations restent à appliquer par le responsable du déploiement, après sauvegarde et selon la spec 16.
