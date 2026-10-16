# 16 — Préparation au lancement et exigences transverses

> Cette spec complète les domaines 01–15. Elle définit les preuves nécessaires pour considérer le système prêt à être lancé ; elle ne remplace pas les critères fonctionnels des specs sources.
> État initial : exigences à réaliser ou à valider. La présence d'une fonctionnalité dans une spec ou dans le code ne constitue pas une preuve de préparation à la production.

## Objectif

Vérifier que Paradis Immo fonctionne de bout en bout comme une plateforme multi-agences, avec :

- un site vitrine public ;
- un portail web authentifié réservé aux agents, propriétaires et administrateurs (agence et plateforme) ;
- une application mobile pour les clients finaux — chercheurs, locataires, voyageurs et acheteurs ;
- des traitements financiers et une exploitation suffisamment fiables pour un lancement maîtrisé.

Il n'existe ni portail web client, ni accès direct au système pour les prestataires externes. Les équipes des agences enregistrent dans le portail de gestion les actions et documents reçus hors plateforme des prestataires.

## 1. Isolation multi-agences et autorisations

### Exigences

- Chaque requête privée doit autoriser l'action selon l'identité, le rôle actif, l'organisation, le bien et, le cas échéant, le mandat et son périmètre.
- L'identifiant d'agence, de propriétaire, de bien ou de mandat fourni par le client ne constitue jamais à lui seul une preuve d'accès.
- Les mêmes règles d'accès s'appliquent aux endpoints de détail, listes, recherches, pièces jointes, exports, notifications et actions métier.
- Un agent ne voit que le périmètre autorisé par son rôle et ses affectations. Un membre d'agence ne peut pas lire les données privées d'une autre agence.
- Un propriétaire ne voit que ses biens, mandats, revenus, documents et opérations autorisés.
- Les routes et pages web sont limitées au portail de gestion ; les clients finaux utilisent les parcours privés mobiles.
- La séparation entre utilisateurs de la plateforme et administrateurs d'agence doit être explicite : les droits d'administration plateforme ne sont pas accordés par une adhésion à une agence.
- **Clients CRM et mandats papier (ADR-0001)** : une fiche CRM ou un dépôt de mandat hors plateforme ne prouve ni la propriété ni le consentement plateforme. Les PDF de mandat et justificatifs restent en stockage privé ; téléchargement borné aux parties et à la file de revue `PLATFORM_ADMIN` ; retention et accès ultérieur alignés sur les documents privés/KYC. Après révocation d'accès provisoire, invalider selon TTL les URLs présignées.

### Matrice minimale de tests négatifs

Pour chaque ressource protégée, tester au minimum :

| Acteur | Tentative | Résultat attendu |
|---|---|---|
| Agent de l'agence A | Lire/modifier un bien, bail, ticket, paiement ou document privé de l'agence B | Refus d'accès sans divulgation de données |
| Agent non assigné | Accéder à un bien sous mandat hors de son périmètre | Refus selon les règles `AgencyAccessService` |
| Admin d'agence | Accéder aux routes d'administration plateforme | Refus |
| Client final | Ouvrir une route de portail de gestion ou une page privée web | Redirection/refus ; accès client via l'app mobile uniquement |
| Utilisateur non authentifié | Lire une ressource privée par identifiant deviné | Refus, sans fuite d'existence ou de contenu sensible |
| Propriétaire | Lire les données privées d'un autre propriétaire | Refus |
| ADMIN/AGENT d'agence | Décider la revue documentaire d'un mandat papier | Refus |
| Membre agence A | Lire CRM / mandat / document privé de l'agence B | Refus |
| Agent | Créer/éditer/archiver un client CRM | Refus |

Les tests doivent couvrir les accès directs par ID et les accès par collection/filtre, y compris les téléchargements et exports. Les refus doivent être cohérents (`403` ou `404` selon la politique anti-énumération), sans exposer de champs sensibles.

### Critères d'acceptation

- Une suite d'intégration vérifie les cas positifs et négatifs ci-dessus sur les domaines comptes, organisations, mandats, baux, séjours, ventes, maintenance, messagerie, paiements et documents.
- Les résultats de liste ne contiennent jamais d'éléments hors périmètre, même si le client modifie les filtres ou les identifiants.
- Les liens de fichiers privés nécessitent une autorisation vérifiée côté serveur et expirent selon la politique du domaine.
- Toute nouvelle route privée déclare et teste son périmètre d'accès avant livraison.

**Références :** 01, 02, 03, 04, 05, 09, 10, 12 et 13.

## 2. Parcours mobiles clients de bout en bout

Le site vitrine permet la découverte publique et la consultation des annonces. Il ne propose pas de compte ou de portail client. Les actions et données privées des clients sont accessibles depuis l'application mobile.

### Parcours à couvrir

| Profil | Parcours minimum avant lancement |
|---|---|
| Chercheur | Créer/ouvrir une session, chercher et consulter des biens, enregistrer des favoris, contacter l'agence, réserver/annuler une visite, suivre ses demandes et gérer son compte. |
| Acheteur | Envoyer une demande, la retrouver, faire/suivre une offre, voir les décisions, signer et suivre les étapes du compromis selon les fonctionnalités activées. |
| Voyageur | Obtenir un devis, réserver, payer, consulter le séjour, accéder aux instructions au moment autorisé, annuler selon la politique et suivre les remboursements. |
| Locataire | Consulter son bail et ses documents, voir le solde et les échéances, payer, obtenir ses reçus/quittances, demander un congé, signaler un incident et suivre l'état des lieux et la caution. |
| Utilisateur multi-profils | Changer de rôle actif sans mélanger les données ni perdre le contexte de navigation. |

### Critères d'acceptation

- Chaque parcours prioritaire fonctionne de l'entrée à la confirmation serveur, avec un état visible dans l'app après fermeture/réouverture.
- Les erreurs réseau, refus métier, expirations, paiements en attente et reprises sont compréhensibles et ne présentent pas un faux succès.
- Les actions nécessitant une session ne sont pas disponibles dans le site vitrine comme portail web alternatif.
- Les liens publics peuvent ouvrir le site vitrine ; les liens privés/universels ouvrent le bon écran mobile et exigent une authentification lorsque nécessaire.
- Les parcours de suppression du compte et de gestion de session sont présents dans l'app.
- Les critères d'accessibilité, de sécurité locale et de confidentialité définis dans 01 et 14 sont validés sur iOS et Android.

La liste exacte des fonctionnalités activées au lancement doit être associée à une matrice de disponibilité iOS/Android, API, portail de gestion et site vitrine. Une fonctionnalité spécifiée mais non livrée doit être explicitement désactivée ou présentée comme indisponible, sans lien mort.

**Références :** 01, 04, 06, 07, 08, 10, 11, 13 et 14.

## 3. Validation des flux financiers réels

Les stubs, simulations ou webhooks génériques ne sont pas suffisants pour déclarer les paiements prêts à la production.

### Exigences

- Utiliser les environnements et mécanismes officiels Airtel Money et MTN MoMo, avec comptes, secrets, URLs et procédures de support de production documentés.
- Vérifier signatures/tokens, certificats ou allowlists conformément à chaque fournisseur ; ne pas partager les secrets entre environnements.
- Rendre les callbacks, webhooks, relances et rapprochements idempotents. Une même opération fournisseur ne peut créer deux allocations, reçus, remboursements ou reversements.
- Le statut métier, le ledger, l'échéance et le reçu restent cohérents lors des succès, échecs, délais d'attente, callbacks tardifs et indisponibilités du fournisseur.
- Tester les paiements, expirations, paiements partiels autorisés, annulations, remboursements, litiges, reversements et rapprochements.
- Documenter les opérations manuelles autorisées, leurs permissions, leur audit et la procédure de réconciliation après incident.

### Parcours et preuves requises

1. Paiement réussi de bout en bout sur le sandbox de chaque fournisseur, depuis l'app mobile jusqu'à la confirmation API et l'allocation comptable.
2. Paiement refusé, expiré, interrompu ou confirmé tardivement ; vérifier que l'utilisateur voit l'état correct et qu'aucune allocation erronée n'est créée.
3. Webhook rejoué, reçu dans le désordre ou avec signature invalide ; vérifier idempotence et rejet sécurisé.
4. Remboursement total et partiel, litige, reversement échoué puis relancé et rapprochement d'un relevé fournisseur.
5. Test contrôlé en production avec montants et bénéficiaires approuvés avant ouverture à tous les utilisateurs.

### Critères d'acceptation

- Les tests d'intégration manuels prévus dans 05 sont exécutés et leurs résultats (date, environnement, référence non sensible, résultat) sont conservés.
- Aucun paiement n'est marqué validé uniquement sur la base d'une réponse cliente ; la confirmation provient d'une source fournisseur vérifiée ou d'une validation manuelle autorisée.
- L'équipe sait identifier et rapprocher les transactions « fournisseur sans transaction locale » et « transaction locale sans confirmation fournisseur ».
- Les secrets de production sont gérés hors du dépôt et leur rotation est documentée.

**Référence canonique :** 05 ; règles d'allocation et de ledger en 03.

## 4. Exploitation et continuité de service

### Environnements et changements

- Séparer développement, préproduction et production, y compris bases de données, buckets, clés et comptes fournisseurs.
- Configurer un bucket R2 privé distinct de celui des médias publics (`R2_PRIVATE_BUCKET`) avec accès public désactivé ; après sauvegarde, depuis `apps/api`, exécuter d'abord `bunx prisma migrate deploy`, puis `bun run storage:migrate-documents`. Cet outil migre les pièces de biens, locataires, baux, KYC, mandats, comptabilité, reçus et rapprochements ; il conserve les objets publics encore référencés par des médias ou des pièces jointes de messagerie, et échoue explicitement si une référence ne peut pas être migrée. Vérifier et traiter ces objets conservés avant de considérer le stockage sécurisé en production.
- Exécuter les migrations de schéma selon une procédure reproductible, avec sauvegarde et stratégie de retour/compatibilité. Une migration non réversible doit documenter la restauration et le plan de reprise.
- Déployer progressivement les changements à risque, avec feature flags ou mécanisme équivalent lorsque pertinent.
- Conserver une procédure de rollback applicatif et de désactivation des intégrations sans corrompre les opérations déjà engagées.

### Surveillance et incidents

- Surveiller disponibilité HTTP, erreurs API, latence, erreurs client mobile, files et événements en attente, notifications, tâches planifiées, fournisseurs de paiement, base de données et stockage.
- Centraliser des logs structurés et horodatés, sans tokens, secrets, données de paiement complètes ni données personnelles non nécessaires.
- Définir des alertes actionnables, une personne/équipe responsable, une procédure d'escalade et un journal d'incident.
- Vérifier que les crons et workers critiques sont observables, rejouables sans doublons et alertent en cas d'arrêt ou d'accumulation.

### Sauvegardes et reprise

- Sauvegarder les données et fichiers nécessaires ; définir les durées de conservation et contrôler les accès aux sauvegardes.
- Tester régulièrement une restauration réelle dans un environnement isolé, incluant base, fichiers et configuration nécessaire.
- Faire approuver des objectifs de perte maximale de données (RPO) et de délai de reprise (RTO) avant le lancement ; aucune valeur n'est présumée par cette spec.
- Documenter la reprise des paiements, reversements et tâches planifiées après restauration.

### Critères d'acceptation

- Une restauration documentée a été exécutée avec succès et ses résultats sont consignés.
- Les alertes de santé et de panne des workers, crons et intégrations sont testées.
- Les responsables savent suspendre un flux, diagnostiquer un incident et reprendre le traitement sans doublon.
- Les procédures de support, d'incident de sécurité et de notification aux utilisateurs sont disponibles aux personnes concernées.

**Références :** 05 pour paiements/rapprochement, 11 pour notifications et handlers, 12 pour audit/configuration.

## 5. Modèle commercial de la plateforme — décision ouverte

Les commissions de gestion immobilière, frais de service, retenues, paiements et reversements décrits dans 03, 05 et 07 correspondent aux opérations immobilières. Ils ne définissent pas, à eux seuls, la façon dont Paradis Immo facture l'utilisation du logiciel aux agences.

Avant le lancement commercial, le propriétaire produit doit décider et documenter :

| Décision | Options à arbitrer | Statut |
|---|---|---|
| Facturation du logiciel aux agences | Gratuit ; abonnement par agence ; abonnement par siège/utilisateur ; offre à paliers ; combinaison forfait + usage | À décider |
| Limites par offre | Nombre de membres, biens, mandats, stockage, volume de messages ou d'opérations | À décider |
| Période d'essai et changement d'offre | Aucune ; essai limité ; passage de plan, suspension et grâce en cas d'impayé | À décider |
| Qui paie les frais de plateforme | Agence, propriétaire, client final ou partage selon le service | À décider |
| Taxes, factures et remboursements de frais logiciels | Pays concernés, devise, numérotation, pièces, règles fiscales applicables | À valider juridiquement et comptablement |
| Moyens et cycle de facturation | Mobile money, carte, virement ; mensuel/annuel ; renouvellement et résiliation | À décider |

### Critères d'acceptation

- Le modèle retenu est approuvé et consigné avant d'activer toute facturation SaaS.
- Les frais logiciels des agences sont séparés des loyers, dépôts, frais de service et commissions métier ; chaque flux a un bénéficiaire et un relevé explicites.
- Si la facturation SaaS n'est pas incluse au lancement, elle est explicitement désactivée et aucune page, promesse ou limite payante n'est exposée.
- Les règles de facturation, taxes, factures, suspension, export et support sont testées avant activation.

## 6. Porte de lancement

Le statut de chaque porte est **à valider** jusqu'à ce que les preuves soient obtenues. L'achèvement des specs fonctionnelles ne fait pas passer automatiquement une porte à « prêt ».

| Porte | Condition de passage | Responsable de validation |
|---|---|---|
| Sécurité multi-agences | Tests d'isolation et d'autorisations réussis sur API, portail et fichiers | Technique / sécurité |
| Parcours produit | Parcours mobiles prioritaires et parcours portail/vitrine testés de bout en bout | Produit / QA |
| Flux financiers | Intégrations réelles validées, rapprochement et reprise démontrés | Finance / technique |
| Exploitation | Monitoring, alertes, sauvegarde/restauration, rollback et gestion d'incident vérifiés | Opérations / technique |
| Commercial/juridique | Modèle de facturation tranché ou désactivé ; obligations légales et stores vérifiés | Direction / produit / conseil |
| Publication | Builds iOS/Android signés, comptes stores prêts, versions/configuration et support préparés | Mobile / release |

**Décision de lancement :** lancer seulement si toutes les portes applicables sont validées, les risques résiduels acceptés par leur responsable et les fonctionnalités non prêtes masquées ou désactivées. Un statut bloqué doit inclure la preuve manquante, le responsable et l'action de résolution.
