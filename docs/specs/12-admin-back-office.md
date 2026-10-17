# 12 — Administration et back-office plateforme

## Objectif et rôles
Donner à l'équipe Paradis Immo les outils pour opérer la plateforme :
- utilisateurs, organisations et KYC ;
- modération ;
- finance ;
- support ;
- configuration métier ;
- traçabilité (audit log).

Rôles : `PLATFORM_ADMIN`, à découper en sous-rôles : `SUPER_ADMIN`, `OPS` (modération et support), `FINANCE`, `READ_ONLY`.

## Audit initial (état local au 2026-10-11, conservé comme historique)
### Déjà en place
- API admin pour utilisateurs, suspension, signalements, statistiques et modération avec motif.
- Journal d'audit et authentification admin par TOTP présents dans les changements locaux.
- L'interface admin couvre seulement une partie des fonctions d'exploitation.

### Écarts
- Fiche 360° utilisateur, impersonation, gestion des rôles admin et RBAC complet restent à faire ou à intégrer.
- Les vues finance (paiements, remboursements, litiges, reversements, rapprochement, exports) et la gestion complète des organisations/KYC ne sont pas achevées.
- Le journal d'audit et le TOTP doivent être raccordés à toutes les routes/actions requises et à leurs écrans web.
- Configuration métier, référentiels, annonces/version d'application et KPI avancés ne sont pas complets.
- La modération avec motif existe localement ; la notification du résultat et son motif doivent encore être vérifiés.

## Complément — clôture de l'interface web admin (état vérifié le 2026-10-16)

### Objectif et périmètre
Faire du portail `/admin` un véritable back-office de supervision et d'exploitation de la plateforme, et pas seulement un ensemble de listes de validation. Cette section précise le périmètre de l'interface web et complète les user stories, écrans et critères ci-dessous ; elle ne remplace pas les contrats API, règles de sécurité ou règles financières des specs 01–11.

Le portail admin sert à superviser et administrer la plateforme entière. Les opérations quotidiennes d'un portefeuille (création des biens, gestion des baux, visites, maintenance, paiements et dossiers locataires) restent dans les espaces Agent et Propriétaire ; l'admin ne doit pas dupliquer ces parcours. Les actions d'administration sur ces objets sont transverses, limitées aux permissions admin et auditées.

### Inventaire UI constaté
- Routes disponibles : `/admin/dashboard`, `/admin/users`, `/admin/users/[id]`, `/admin/organizations`, `/admin/onboarding`, `/admin/onboarding/[id]`, `/admin/moderation`, `/admin/reports`, `/admin/reports/[id]` et `/admin/config`. Les routes organisations n'ont pas de fiche de détail, et `/admin/organizations` n'est pas dans la navigation latérale.
- Les dossiers d'ouverture permettent de valider ou rejeter une demande. La modération permet de changer le statut d'une annonce. Les signalements ouverts peuvent être traités ou rejetés.
- La liste des utilisateurs propose une page de détail et les actions de suspension/réactivation; la suspension demande un motif. La page de détail présente le profil et l'état du compte, mais ne constitue pas encore une fiche 360° complète.
- La page organisations appelle `/admin/organizations`, affiche les organisations et permet des filtres locaux limités; aucun handler API `admin/organizations` ni page de détail/action correspondante n'a été trouvé dans le code inspecté. La navigation latérale ne contient pas cette page.
- Le tableau de bord charge les statistiques/graphiques via `/admin/stats`, ainsi que des listes récentes d'utilisateurs et de signalements. Ces éléments ne sont plus des jeux de données de démonstration; l'exactitude métier des KPI, des séries et de leurs liens reste à vérifier.
- La topbar ouvre une recherche clavier sur les routes de navigation du rôle courant. Elle ne recherche pas les entités métier sur l'API.
- La cloche charge les notifications récentes de l'utilisateur, calcule les non-lues parmi les résultats reçus et permet lecture individuelle/tout lire. Ce centre personnel n'est pas l'interface d'administration des modèles, statistiques d'envoi et échecs.
- La page de configuration affiche les liens des boutiques mobiles et explique leur modification via les variables d'environnement ; elle n'édite pas de paramètres métier.
- Les listes d'organisations et de signalements demandent une première page limitée ; la modération charge un nombre fixe de biens. L'interface doit permettre d'atteindre l'ensemble des résultats, sans plafond silencieux.

### Constat de fonctionnement établi depuis le code source
Cette liste est le relevé de l'interface et des contrats effectivement câblés dans le dépôt à la date de mise à jour, et non une déduction des specs. « Existe dans l'API » ne signifie pas « utilisable depuis le web » ; « non trouvé » signifie qu'aucun écran/handler correspondant n'a été trouvé dans le code inspecté, et doit être confirmé lors de l'implémentation si de nouveaux changements sont intervenus.

| Fonction | État observé dans le code | Conséquence / travail nécessaire |
|---|---|---|
| Recherche topbar | `GlobalSearch` ouvre une palette clavier (`Ctrl+K`/`⌘K`) et recherche uniquement dans les groupes de navigation configurés pour le rôle; elle navigue vers une page. Aucun endpoint de recherche d'entités métier n'est câblé. | La recherche de pages fonctionne. Il reste à implémenter la recherche serveur multi-entités définie plus bas, avec autorisation et résultats paginés. |
| Notifications topbar | `NotificationsDropdown` charge `GET /notifications/my`, affiche jusqu'à huit notifications et permet de marquer une entrée ou toutes comme lues. Le pointage non lu est calculé parmi les notifications chargées; aucun compteur serveur dédié n'est exposé. | Centre utilisateur raccordé, distinct du monitoring admin (`/admin/notifications` pour la file d'échecs). Modèles et statistiques d'envoi restent absents. |
| Notifications côté API | `notifications.controller.ts` expose la liste utilisateur `GET /notifications/my` (service limité aux 100 plus récentes), lecture individuelle et « tout lire ». Routes admin `GET /admin/notifications/failed` et `POST /admin/notifications/:id/retry` ajoutées (liste FAILED/QUEUED paginée, relance manuelle auditée). Pas encore de templates admin ni de `GET /admin/notifications/stats`. | File d'échecs et relance exploitables depuis `/admin/notifications`. Templates et statistiques restent à livrer ; l'UI ne doit pas les simuler. |
| Tableau de bord | `page.tsx` charge `/admin/stats`, des utilisateurs récents et des signalements ouverts; les graphiques reçoivent une série dérivée des statistiques. | Les données de démonstration ont été retirées. Vérifier l'exactitude des agrégats, les liens KPI et les alertes d'exploitation encore absentes; ne pas considérer les seuls composants présents comme une preuve de complétude analytique. |
| Liste utilisateurs | `PaginatedDataTable` charge les utilisateurs par page; le statut est affiché, la recherche/les filtres sont activés côté tableau, chaque ligne ouvre `/admin/users/[id]` et expose suspendre/réactiver. La suspension demande un motif. La fiche montre les informations de profil et de compte. | Les actions et le détail de base sont livrés. La recherche serveur et les filtres complets définis dans la cible ne sont pas transmis par `listUsers`; la fiche 360° (relations métier, historique, sous-listes paginées) reste à compléter. |
| Organisations | La page et le client appellent `/admin/organizations` avec un type/page/pageSize; l'écran charge une page, applique ses filtres sur les lignes chargées et affiche les compteurs de cette page. Aucun handler API `admin/organizations`, aucune fiche détail ni action correspondante n'ont été trouvés dans le code inspecté; la navigation latérale n'inclut pas cette page. | Contrat API et intégration à la navigation à établir avant de considérer la page utilisable; recherche, pagination complète, fiche et actions restent à faire. |
| Dossiers d'ouverture | Chargement et décisions INVITE/REJECT sont câblés. La liste propose un lien « Voir les détails » vers `/admin/onboarding/[id]`; la décision utilise le dialogue partagé, avec motif requis au rejet. Les données et filtres sont chargés/traités côté client, sans pagination serveur/URL. | Détail et UX de confirmation sont livrés. La recherche/pagination à grande échelle et l'état complet du dossier restent à vérifier/compléter. |
| Modération des biens | `lib/admin/properties.ts` charge `/properties?limit=100` en mode anonyme, sans page suivante ni total exploité. `PATCH /admin/properties/:id/moderate` est appelé; l'archivage demande maintenant un motif via le dialogue partagé. | L'échec d'archivage lié au motif est corrigé. Les annonces au-delà de 100, la fiche avec historique et les actions enrichies restent à traiter. |
| Signalements | La page charge jusqu'à 100 éléments, utilise le dialogue partagé pour confirmer les transitions et expose des filtres locaux; l'API/client prennent en charge la pagination et `adminNote`. | Pas de pagination serveur complète/URL, fiche dossier, assignation ni saisie d'une note admin dans l'UI. Vérifier l'accès au statut `REVIEWED` et l'expérience du déclarant. |
| CSV générique des tableaux | `ListDataTable` exporte seulement les lignes actuellement chargées/triées côté navigateur ; pour un tableau alimenté côté serveur, ce n'est pas l'ensemble des résultats filtrés. | Clarifier « exporter cette page » ou créer un export serveur de l'ensemble filtré ; ne pas donner l'impression d'un export complet. |
| Journal d'audit | Un client `lib/admin/audit.ts` et le handler API `/admin/audit-logs` existent, mais aucun écran `/admin/audit` ni entrée de navigation admin n'a été trouvé. | Données et contrat non accessibles depuis l'interface. |
| Configuration | `app/admin/config/page.tsx` est uniquement informative et lit deux variables publiques de build pour les liens des stores. | Pas de formulaire ni de modification métier depuis l'admin ; tout réglage non câblé doit rester marqué indisponible plutôt que simulé. |
| Finance / support / gestion admin | Écran `/admin/notifications` (file d'échecs + relance) câblé. Aucun écran finance, support, gestion des comptes/rôles admin ou audit n'est présent dans les routes/pages de l'espace admin inspectées. | Finance, support, audit UI et reste du centre notifications (modèles, stats) restent des chantiers distincts. |

### Parcours et écrans à livrer
Les routes existantes sont conservées lorsqu'elles conviennent. Les nouvelles routes doivent suivre le préfixe `/admin` et rester dans la navigation latérale avec un libellé explicite.

| Écran | Exigences de clôture |
|---|---|
| `/admin/dashboard` | KPI et tendances issus de données réelles, période sélectionnable, horodatage de mise à jour et raccourcis vers les files d'action. Les tableaux récents affichent des données réelles ou sont retirés ; aucune donnée de démonstration ne doit être présentée comme réelle. Afficher les alertes prioritaires : demandes en attente, signalements ouverts, annonces à examiner, impayés, litiges et reversements échoués lorsque les données correspondantes sont disponibles. |
| `/admin/users` et `/admin/users/[id]` | Recherche serveur par identifiant, nom, téléphone et e-mail ; filtres rôle, statut, pays et période d'inscription ; pagination conservée dans l'URL. La fiche 360° présente identité et statut, rôles, organisations, biens liés, baux/séjours, paiements, incidents/signalements et historique pertinent, avec liens vers les dossiers sources. Suspendre/réactiver avec motif obligatoire et confirmation ; afficher le résultat et l'état courant. Les actions interdites au rôle courant sont absentes ou désactivées avec explication. |
| `/admin/organizations` et `/admin/organizations/[id]` | Recherche, filtres type/statut/pays/ville et pagination serveur. La fiche présente coordonnées, vérification/KYC, statut d'affiliation, membres et rôles, biens, mandats, indicateurs d'activité et historique. Traiter l'affiliation/KYC, suspendre/réactiver avec motif lorsque permis, et afficher l'impact et les notifications attendues avant confirmation. Les demandes d'ouverture restent dans `/admin/onboarding` et sont reliées à la fiche créée après validation. |
| `/admin/moderation` et `/admin/cases` | File de modération paginée et filtrable par statut, motif, type de bien, organisation et date. Chaque ligne ouvre un aperçu détaillé : annonce, propriétaire/agence, médias, historique et signalements associés. Approuver, demander une correction ou refuser avec motif structuré et commentaire ; avant une action irréversible, confirmer. Le dossier de signalement peut être assigné, annoté en interne puis résolu ; l'issue et la note destinée au déclarant sont distinctes. |
| `/admin/mandate-reviews` (nom final selon routes) | File paginée des mandats papier / preuves hors plateforme en attente de revue. Filtres statut de revue, agence, date. Détail : parties, bien, versions de fichiers, checklist (pages lisibles, identité parties, bien identifiable, périmètre/durée, signatures, justificatif propriété/autorisation). Décisions `APPROVED` / `NEEDS_CORRECTION` / `REJECTED` + motif ; audit de chaque accès et décision. Accès documents limité à cette file et aux permissions ; pas d'URL publique. `NEEDS_CORRECTION` conserve l'accès opérationnel provisoire mais met l'annonce en pause jusqu'à resoumission et approbation ; `REJECTED` révoque l'accès provisoire, met l'annonce en pause et bloque les nouveaux engagements. Les dossiers déjà engagés restent consultables pour leur clôture limitée selon la spec 03. |
| `/admin/client-link-claims` (ou file intégrée aux clients CRM) | Demandes de rattachement d'un contact externe à un compte lorsque le numéro vérifié ne correspond pas ou n'est plus accessible. Détail des preuves strictement nécessaires, historique des tentatives et fiche CRM/compte candidate sans divulgation à l'agence. Revue manuelle du justificatif d'identité en accès privé, comparaison avec les données de la fiche et demande d'une preuve complémentaire de continuité si les noms sont ambigus. Décision acceptée/refusée avec motif et audit ; aucune fusion automatique et aucune décision par l'agence. La conservation de copies de justificatifs exige une finalité et une durée approuvées ; à défaut, ne garder que les métadonnées de décision. |
| `/admin/finance` | Vue globale en lecture et filtres pour paiements, remboursements, litiges, reversements, rapprochement et rapports mensuels. Les actions financières sont exposées uniquement si autorisées, affichent les montants/devise, référence, statut, historique et conséquences, demandent confirmation et exigent la ré-authentification TOTP selon la politique de la spec 05. Les exports respectent les filtres et permissions courants. |
| `/admin/audit` | Journal paginé, filtrable par période, acteur, action, type/cible et exportable. Le détail présente horodatage, acteur, adresse IP disponible, cible, résultat et changements avant/après ; les secrets, jetons et documents privés ne sont jamais exposés. Écran en lecture seule. |
| `/admin/config` | Remplacer la page informative actuelle par des sections séparées : paramètres métier, référentiels, annonces système, versions minimales de l'application et feature flags. Présenter la valeur courante, validation, portée/pays concernés et effet ; toute modification affiche un aperçu, demande confirmation et conserve l'historique/audit. Les liens de boutiques ne sont éditables que s'ils sont effectivement pilotés par la configuration plateforme ; ne pas présenter une valeur d'environnement comme modifiable depuis l'admin. |
| `/admin/admins` et `/admin/security` | Gestion des profils et rôles admin réservée à `SUPER_ADMIN` ; état TOTP et procédure d'activation accessibles à l'admin concerné. Toute modification de privilège est confirmée et auditée. L'impersonation, si activée, est explicitement en lecture seule, limitée dans le temps, signalée par une bannière persistante et terminée par une action visible. |

Les pages finance, support, notifications et KYC peuvent être livrées en sous-routes ou onglets si leurs parcours restent identifiables et partageables par URL. Ne pas ajouter de lien de navigation vers une page qui n'est pas fonctionnelle.

### Spécification détaillée des pages et composants

Les champs ci-dessous sont le contrat d'affichage minimal. Un champ absent du modèle ou de l'API doit être ajouté au contrat/données avec migration si nécessaire, ou explicitement marqué « non disponible » avec une décision de périmètre ; l'interface ne doit ni inventer une valeur ni masquer silencieusement une donnée attendue. Les colonnes de liste peuvent être adaptées au petit écran, mais restent accessibles sur la fiche détail.

#### Recherche globale admin
- Un champ de recherche accessible depuis la topbar sur toutes les pages admin, ouvrable au clavier (`Ctrl+K`/`⌘K`), avec un panneau de résultats et un raccourci clavier annoncé.
- Recherche à partir de 2 caractères, temporisation de saisie, annulation des requêtes précédentes, état de chargement, état vide avec conseil, état d'erreur réessayable et navigation clavier dans les résultats. Entrée ouvre le résultat sélectionné ; Échap ferme le panneau.
- Recherche sur les entités autorisées : utilisateurs (nom, téléphone, e-mail, ID), organisations (nom, raison sociale, téléphone, e-mail, ID), biens (titre, adresse/ville, ID), baux (référence, locataire, bien), paiements (référence, téléphone payeur, ID), tickets de maintenance (référence, titre, bien), visites/réservations/ventes (référence, personne liée, bien) et dossiers de modération (ID, cible, motif). Les catégories peuvent être activées/désactivées dans les filtres.
- Une ligne de résultat expose uniquement : type d'entité, libellé principal, identifiant/référence courte, information secondaire utile, statut, date de mise à jour et lien de détail. Les résultats sont regroupés par type, avec au plus cinq suggestions par type et un lien « Voir tous les résultats » vers la recherche dédiée avec requête conservée.
- Critères de classement : correspondance exacte sur ID/référence/téléphone avant correspondance partielle, puis pertinence et date de mise à jour. Normaliser espaces, ponctuation et casse pour les téléphones/références. Ne pas rechercher dans le contenu des conversations, documents KYC ou champs secrets.
- Contrat UI/API à fournir : `GET /admin/search?q=&type=&page=&pageSize=` ; réponse paginée par type, avec `{ type, id, label, secondary, status, updatedAt, href }`. `href` est un chemin interne autorisé, jamais une URL fournie sans validation. Chaque résultat est filtré par permissions avant d'être renvoyé ; la page de détail réapplique l'autorisation. Ne jamais indiquer qu'une entité existe si l'admin ne peut pas la lire.

#### Centre de notifications admin
- La cloche de topbar affiche le compteur non lu et les notifications récentes destinées à l'admin connecté. Chaque entrée affiche titre, texte, date, état lu/non lu et lien interne vers le dossier/action concerné ; actions « Marquer comme lu » et « Tout marquer comme lu ». Le clic ouvre la cible puis marque comme lu.
- `/admin/notifications` contient des onglets distincts **Modèles**, **Envois/Statistiques** et **Échecs**. Cette page admin complète le centre personnel de la topbar ; elle ne remplace pas les notifications mobiles/web des utilisateurs.
- **Modèles** : liste paginée filtrable par type métier, canal (`IN_APP`, `PUSH`, `WHATSAPP`, `SMS`, `EMAIL`), langue et état actif. Colonnes : type, canal, langue, titre, aperçu du corps, état, date et auteur de dernière modification. Détail/édition : type (identifiant non éditable), canal, langue, titre (optionnel selon canal), corps, variables autorisées avec description/exemple, état actif, nom de template WhatsApp si nécessaire, modifié par/le. Aperçu avec données d'exemple et validation des variables/capacités du canal avant enregistrement.
- **Statistiques** : filtres période (7/30 jours et dates personnalisées), type et canal ; totaux tentés, envoyés, délivrés, lus si pris en charge, échoués, taux de succès et tendance quotidienne. Préciser le dénominateur et distinguer « envoyé » de « délivré ».
- **Échecs** : colonnes date, destinataire masqué, type, canal, statut, nombre de tentatives, prochaine tentative, dernière erreur non sensible et identifiant fournisseur. Détail montrant l'historique des tentatives. Action « Relancer » seulement si l'état et les règles de retry l'autorisent, avec confirmation et retour du résultat. Ne pas afficher de token FCM, contenu confidentiel inutile ou identifiant fournisseur sensible.
- Les rôles et permissions contrôlent séparément la lecture des statistiques, l'édition des modèles et la relance. Chaque modification de modèle et relance est auditée ; l'interface n'annonce jamais qu'un envoi a réussi avant le résultat du service.
- Contrat requis selon la spec 11 : `GET/PUT /admin/notification-templates`, `POST /admin/notification-templates/:id/preview`, `GET /admin/notifications/stats`, `GET /admin/notifications/failed`, `POST /admin/notifications/:id/retry`. **Livré** : `failed` + `retry` (UI échecs). **Non livré** : templates et stats — ne pas les simuler ; l'écran admin n'expose que la file d'échecs tant que ces contrats manquent.

#### Champs minimaux des listes et fiches principales

| Page / entité | Champs de liste | Champs et actions de la fiche |
|---|---|---|
| Utilisateurs | ID court, nom, téléphone masqué selon permission, e-mail masqué, rôles, statut (`ACTIVE`/`SUSPENDED`/`DELETED`), pays, date d'inscription, dernière activité si disponible | Profil/contact, statut et motif/date de suspension, rôles, KYC (statut seulement dans la fiche générale), organisations/membres, biens, baux, séjours, paiements, visites, maintenance, signalements et activité récente. Actions autorisées : suspendre/réactiver avec motif, révoquer les sessions, ouvrir le dossier KYC. Chaque sous-liste paginée et liée à son écran source. |
| Organisations | ID court, nom/raison sociale, type, statut affiliation, vérification/KYC, ville/pays, contact, nombre de membres et biens, créée le | Identité légale et contacts, adresse, RCCM/NIU (valeurs et documents selon permission KYC), statut et historique de décisions, membres (nom, rôle, statut, date d'adhésion), biens, mandats, statistiques et incidents. Actions : approuver/refuser affiliation ou KYC selon le dossier, suspendre/réactiver avec motif, voir les demandes d'ouverture associées. |
| Biens / modération | Référence, titre, mode, ville, prix/devise, propriétaire ou agence, statut publication/modération, date de soumission, signalements ouverts | Description et caractéristiques, adresse selon les droits, médias, contact/organisation, prix/devise, documents non privés autorisés, historique de statut/décision, motifs/commentaires, signalements liés. Actions : approuver, demander correction, refuser/archiver avec motif et commentaire ; mise en avant séparée si autorisée. |
| Signalements / dossiers | Référence, cible et type, motif, priorité, statut, déclarant masqué, assigné à, date et ancienneté | Données de la cible nécessaires à l'examen, description/preuves, historique des signalements, assignation, notes internes, décision et texte de notification au déclarant distincts. Actions : assigner, ajouter note interne, traiter/rejeter avec décision, transmettre le résultat au déclarant selon le contrat de notification. |
| Paiements et reversements | Référence, type, payeur/bénéficiaire masqué, objet (bail/séjour/vente), montant/devise, fournisseur, statut, dates | Références fournisseur, montants et ventilation, objet lié, historique des transitions, rapprochement, remboursement/litige/reversement lié, pièces justificatives permises. Actions finance explicitement autorisées, audit, confirmation et TOTP selon spec 05. |
| Audit | Date/heure, acteur, action, type/cible, résultat | Avant/après, métadonnées permises, IP/agent utilisateur selon disponibilité et corrélation de requête. Export filtré ; aucune action de modification/suppression. |

#### Statuts et formulaires
- Chaque statut est rendu par un libellé traduit stable, une couleur non utilisée seule et, si nécessaire, une explication. Les valeurs API inconnues sont affichées explicitement comme « Statut inconnu » avec leur code, sans crash.
- Les formulaires mutatifs exposent les champs obligatoires et leurs limites, valident côté client pour l'ergonomie et côté API pour l'autorité. Les erreurs de validation sont affichées près du champ concerné ; les erreurs globales conservent la saisie.
- Motifs de suspension, affiliation/KYC, modération et décisions de dossier sont des listes de choix versionnées/configurables selon la règle métier, avec option « Autre » ouvrant un commentaire obligatoire. Les notes internes ne sont jamais incluses dans un message à l'utilisateur.
- Confirmation récapitulative avant action : type d'action, cible complète, nouveau statut, motif/commentaire, effet prévu. Éviter les simples `confirm()`/`prompt()` natifs pour ces parcours.

### Exigences transverses UI
- Toutes les listes utilisent pagination serveur avec total, tri et filtres clairement visibles ; recherche et filtres s'appliquent à l'ensemble du jeu de résultats, pas uniquement à la page affichée.
- Chaque page gère distinctement chargement, absence de données, erreur récupérable et succès d'action. Une erreur de chargement ne doit jamais ressembler à une liste vide ou à une opération réussie.
- Les tableaux indiquent les unités, devises et dates ; les dates sont affichées selon `Africa/Brazzaville`. Les indicateurs affichent leur période et leur définition pour éviter les chiffres ambigus.
- Toute action mutative présente l'objet ciblé, l'effet, les éventuelles conséquences irréversibles, un motif lorsqu'exigé et une confirmation. Après action, la liste et le détail reflètent l'état serveur.
- Les permissions sont reflétées dans la navigation et les contrôles, mais la sécurité est toujours appliquée par l'API. Une réponse 401/403 est expliquée sans afficher de données protégées.
- Les écrans sont utilisables au clavier, responsives, compatibles avec les lecteurs d'écran pour les statuts/alertes et cohérents avec les composants du portail existant.
- Aucun secret, document KYC ou donnée personnelle non nécessaire n'est affiché dans une liste, un export ou une URL.

### Livraison et priorités UI
- **P0 — fiabilité et vérité de l'interface existante** : les tableaux de démonstration, le badge codé en dur et le motif manquant à l'archivage ont été corrigés localement. Reste à confirmer le contrat API Organisations avant d'exposer la page, et à contrôler les liens/KPI du tableau de bord contre leurs agrégats.
- **P1 — administration exploitable** : recherche serveur multi-entités (la recherche clavier de pages existe déjà) ; pagination, recherche et filtres serveur pour chaque liste ; fiche utilisateur 360° ; détail/actions organisation et KYC ; exactitude vérifiée du tableau de bord ; écran d'audit ; centre admin de notifications/monitoring raccordé aux fonctions réellement implémentées ; vue finance et support à partir des contrats disponibles ; configuration éditable seulement quand le backend supporte l'écriture.
- **P2 — opérations avancées** : annonces système, versions d'application, feature flags et référentiels éditables ; gestion des rôles admin et impersonation en lecture seule ; détection fraude/doublons et alertes avancées.

Les fonctionnalités qui dépendent d'un contrat API, d'une décision métier, d'une intégration financière ou d'une validation juridique non disponible restent masquées et identifiées comme non livrées ; une maquette ou un écran en lecture seule ne vaut pas livraison du parcours.

Ordre de réalisation recommandé d'après les blocages constatés : (1) corriger les faux indicateurs et l'archivage, (2) rendre l'ensemble des listes navigables et réellement recherchables, et vérifier le contrat Organizations, (3) câbler notifications et journal d'audit au web, (4) construire les fiches et vues transverses, (5) enrichir KPI et configuration. Ne pas commencer par ajouter des écrans qui reposent sur des endpoints absents ou des données qui ne sont pas calculées.

### Critères d'acceptation de clôture UI
1. Aucun écran admin ne présente de données fictives comme des données de production ; les valeurs du tableau de bord correspondent aux réponses API pour une période affichée.
2. Depuis la liste, un admin autorisé peut retrouver un utilisateur ou une organisation au-delà de la première page, ouvrir son détail et retrouver les données liées sans exposer celles d'autres périmètres.
3. Une suspension/réactivation, décision d'affiliation, action de modération ou opération financière non réversible affiche le motif requis, demande confirmation, traite les erreurs API et présente l'état effectivement enregistré.
4. Un refus de modération sans motif est impossible dans l'UI ; avec motif, le motif est envoyé et apparaît dans le détail/historique prévu.
5. L'admin peut filtrer, paginer et examiner un signalement ; une note interne n'est pas présentée comme une réponse au déclarant.
6. Un rôle sans permission ne voit pas les actions correspondantes ; en cas d'appel direct ou d'autorisation expirée, l'API reste l'autorité et l'UI n'annonce aucun succès.
7. Les actions sensibles du back-office ont un résultat traçable dans `/admin/audit` avec acteur, cible et changements disponibles ; l'écran d'audit ne permet aucune modification.
8. Chaque page livrée a des états chargement, vide, erreur et succès vérifiables, et les scénarios principaux sont utilisables sur mobile et au clavier.
9. Depuis n'importe quelle page admin, la recherche globale retrouve les entités autorisées par identifiant/référence et champs métier documentés ; résultats et fiches appliquent les permissions, liens internes, filtres par type et navigation clavier.
10. Le centre admin distingue les notifications personnelles du monitoring des envois ; les modèles ont aperçu/validation, les statistiques indiquent période et dénominateur, les échecs exposent les tentatives pertinentes et une relance autorisée retourne un résultat explicite.
11. La liste des notifications personnelles affiche non-lus, filtres et pagination, marque lu individuellement/globalement et ouvre le bon écran ; chaque événement métier attendu est réellement émis, traité par un handler et livré selon les canaux de la matrice spec 11. Une UI seule ne vaut pas preuve de livraison.

## User stories
### Utilisateurs
1. Je recherche un utilisateur par nom, téléphone, e-mail ou identifiant, et je filtre par rôle, statut, date d'inscription et pays.
2. Je vois sa fiche 360° : profil, sessions, organisations, biens, baux, séjours, paiements, tickets, signalements reçus et émis, notifications récentes.
3. Je le suspends ou le réactive (motif obligatoire, notification), je force la déconnexion, et je réinitialise son téléphone en cas de perte (procédure KYC).
4. J'attribue ou je retire un rôle admin (SUPER_ADMIN uniquement).
5. Je me connecte « en tant que » l'utilisateur (impersonation) en lecture seule, pour le support. L'utilisateur en est informé dans son journal de sécurité.

### Organisations et KYC
6. Je traite la file d'affiliation des agences PENDING : documents RCCM et NIU, puis approbation ou refus motivé.
7. Je traite la file KYC des utilisateurs et des organisations (01).
8. Je suspends une agence : ses annonces passent en pause, et ses gestionnaires et mandants sont notifiés.
9. Je vois les indicateurs d'une agence : biens, mandats, volume encaissé, litiges, avis, SLA de maintenance.
9bis. Je traite la **file de revue des mandats papier** déposés pour des clients externes (sans compte) : preview sécurisé, checklist documentaire, décisions `APPROVED` | `NEEDS_CORRECTION` | `REJECTED` avec motif obligatoire, historique immuable. L'écran précise que la revue ne certifie ni l'authenticité légale des signatures ni une propriété opposable (ADR-0001, spec 03).

### Modération
10. Je modère les annonces : file des nouvelles publications (pré-modération optionnelle par configuration), approbation, demande de correction ou refus, avec un motif choisi dans une liste et un commentaire. Le propriétaire ou l'agence est notifié.
11. Je traite les signalements d'annonces, de messages (10) et d'avis (02). Le déclarant est informé de l'issue.
12. Je repère les doublons d'annonces (mêmes photos, mêmes coordonnées) et les fraudes (prix aberrant, compte récent qui publie beaucoup).

### Finance
13. Je vois tous les paiements, avec recherche par référence, téléphone ou montant, et filtres par statut, fournisseur et période.
14. J'approuve les remboursements au-dessus du seuil, je traite les litiges escaladés, et je relance les reversements échoués (05).
15. J'importe les relevés fournisseurs et je résous les écarts de rapprochement (05).
16. J'exporte un rapport financier mensuel : encaissements par méthode, commissions plateforme, frais de service, reversements.

### Configuration métier (sans déploiement)
17. Je modifie les paramètres :
    - frais de service des séjours, taxe de séjour par ville ;
    - plafond de caution par pays ;
    - seuils de remboursement ;
    - délais (hold, expiration) ;
    - liste des motifs de modération ;
    - feature flags (pré-modération, messagerie, iCal…).
18. Je gère les référentiels : pays, villes, arrondissements, quartiers (avec coordonnées), équipements (`PropertyFeatureId`).
19. Je publie des annonces système (bannière dans l'app) et j'impose une version minimale de l'app (force update).
20. Je gère les templates de notifications (11) et les versions des CGU (01).

### Traçabilité et pilotage
21. Je consulte l'audit log de toutes les actions sensibles (qui, quoi, quand, avant/après, IP), filtrable et exportable.
22. Le tableau de bord présente des KPI avec tendances : inscriptions, annonces actives par mode, taux de conversion visite → bail, GMV, impayés, tickets ouverts, délai moyen de modération.

## Règles métier
- **RBAC admin**
  - `SUPER_ADMIN` : tout.
  - `OPS` : utilisateurs (sans les rôles), organisations, modération, support.
  - `FINANCE` : paiements, remboursements, reversements, rapprochement, exports.
  - `READ_ONLY` : lecture seule.
  - Contrôle par décorateur `@AdminPermission('finance.refund.approve')`.
- **Authentification admin** : mot de passe ou Google (existant), plus une **2FA TOTP obligatoire**, une session de 8 h et une allowlist d'IP optionnelle.
- **Audit log obligatoire** pour :
  - toute action admin ;
  - validation de paiement en espèces, remboursement, reversement ;
  - décision d'approbation de mandat ;
  - changement de rôle dans une organisation ;
  - activation et résiliation de bail ;
  - accès admin à une conversation ;
  - impersonation.
  L'audit log est en ajout seul : aucune suppression ni modification, conservation 5 ans.
- **Modération**
  - Motifs : `PHOTOS_INSUFFISANTES`, `PRIX_INCOHERENT`, `ADRESSE_INVALIDE`, `DOUBLON`, `CONTENU_INAPPROPRIE`, `FRAUDE_SUSPECTEE`, `AUTRE`.
  - Statuts : `PENDING_REVIEW` → `APPROVED` | `CHANGES_REQUESTED` | `REJECTED`. Une annonce `CHANGES_REQUESTED` corrigée revient en `PENDING_REVIEW`.
- **Signalements** : `PropertyReport` devient un `ModerationCase` générique (targetType : PROPERTY, MESSAGE, REVIEW, USER, ORGANIZATION), avec assignation à un admin, notes internes et décision. Trois signalements OPEN sur une même cible la mettent automatiquement en `PENDING_REVIEW`.
- **Suspension d'organisation** : annonces passées en `PAUSED` ; nouveaux mandats, baux et réservations bloqués. Les paiements des baux en cours restent possibles (pour ne pas bloquer les locataires), les reversements sont suspendus et les mandants sont notifiés.
- **Impersonation** : token spécial (claim `impersonatedBy`), valable 30 minutes, en lecture seule (le guard bloque toute méthode autre que GET), avec bannière visible et audit.
- **Configuration** : table `PlatformSetting` (clé, valeur JSON, schéma validé), mise en cache 60 s, avec historique des valeurs dans l'audit.

## Modèle de données
```prisma
enum AdminRole { SUPER_ADMIN OPS FINANCE READ_ONLY }
enum ModerationStatus { PENDING_REVIEW APPROVED CHANGES_REQUESTED REJECTED }
enum CaseTarget { PROPERTY MESSAGE REVIEW USER ORGANIZATION }

model AdminProfile {
  userId       String    @id
  role         AdminRole
  totpSecret   String?   // chiffré
  totpEnabledAt DateTime?
  ipAllowlist  String[]
  createdAt    DateTime  @default(now())
}

model AuditLog {
  id          String   @id @default(cuid())
  actorId     String?
  actorType   String   // USER | ADMIN | SYSTEM
  impersonatedBy String?
  action      String   // ex. "payment.refund.approve"
  targetType  String
  targetId    String
  before      Json?
  after       Json?
  metadata    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([targetType, targetId])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}

model Property {
  // + champs
  moderationStatus ModerationStatus @default(PENDING_REVIEW)
  moderationReason String?
  moderationNote   String?
  moderatedById    String?
  moderatedAt      DateTime?
}

model ModerationCase {
  id           String     @id @default(cuid())
  targetType   CaseTarget
  targetId     String
  reports      Json       // [{ reporterId, reason, comment, createdAt }]
  status       String     // OPEN | IN_REVIEW | DISMISSED | ACTIONED
  assignedToId String?
  decision     String?
  internalNotes String?
  createdAt    DateTime   @default(now())
  resolvedAt   DateTime?
}

model PlatformSetting { key String @id value Json updatedById String? updatedAt DateTime @updatedAt }

model SystemAnnouncement { id String @id @default(cuid()) title String body String audience String /* ALL | SEEKERS | MANAGERS */ startsAt DateTime endsAt DateTime? active Boolean @default(true) }

model AppVersionPolicy { platform DevicePlatform @id minVersion String latestVersion String storeUrl String? message String? }
```

## Endpoints
| Méthode | Route | Permission | Description |
|---|---|---|---|
| POST | `auth/admin/totp/setup` · `verify` | admin | 2FA |
| GET | `admin/users` | users.read | **Modifié** : `?q&role&status&countryId&from&to`, paginé |
| GET | `admin/users/:id` | users.read | Fiche 360° |
| POST | `admin/users/:id/suspend` · `unsuspend` | users.suspend | `{ reason }` |
| POST | `admin/users/:id/logout-all` | users.suspend | |
| POST | `admin/users/:id/impersonate` | users.impersonate | Token en lecture seule |
| PUT | `admin/users/:id/admin-role` | admins.manage | `{ role | null }` |
| GET | `admin/organizations` | orgs.read | `?type&affiliationStatus&q` |
| GET | `admin/organizations/:id` | orgs.read | Indicateurs |
| POST | `admin/organizations/:id/approve` · `reject` · `suspend` · `reactivate` | orgs.manage | `{ reason }` |
| GET | `admin/kyc` | kyc.review | File |
| PATCH | `admin/kyc/:id` | kyc.review | `{ status, rejectionReason }` |
| GET | `admin/moderation/properties` | moderation | File `PENDING_REVIEW` |
| PATCH | `admin/properties/:id/moderate` | moderation | **Modifié** : `{ status, reason, note }`, avec notification |
| GET | `admin/cases` | moderation | Tous signalements confondus |
| PATCH | `admin/cases/:id` | moderation | Assignation et décision |
| GET | `admin/payments` | finance.read | Recherche globale |
| GET | `admin/refunds` · PATCH `:id` | finance.refund.approve | |
| GET | `admin/disputes` · PATCH `:id` | finance.dispute | |
| GET | `admin/payouts` · POST `:id/retry` | finance.payout | |
| POST | `admin/reconciliation` · GET `:id` | finance.reconcile | |
| GET | `admin/reports/financial` | finance.read | `?month` : JSON et CSV |
| GET | `admin/audit-logs` | audit.read | Filtres, export CSV |
| GET | `admin/settings` · PUT `:key` | settings.manage | |
| CRUD | `admin/geo/countries\|cities\|arrondissements\|quartiers` | settings.manage | Référentiels |
| CRUD | `admin/announcements` | settings.manage | |
| PUT | `admin/app-versions/:platform` | settings.manage | |
| GET | `app/config` | public | Annonces actives, version minimale, feature flags publics (utilisé par le mobile) |
| GET | `admin/stats` | stats.read | **Modifié** : KPI avec séries temporelles `?from&to&granularity` |

## Écrans (web admin)
- `/admin/dashboard` : KPI, courbes et alertes (litiges escaladés, reversements échoués, files en attente).
- `/admin/users` : recherche et filtres. `/admin/users/[id]` : fiche 360° avec actions.
- `/admin/organizations` et `/admin/organizations/[id]`, plus `/admin/kyc`.
- `/admin/moderation` : file avec aperçu de l'annonce, motifs et historique. `/admin/cases`.
- `/admin/mandate-reviews` : file de revue documentaire des mandats papier (clients externes) ; preview privé, décisions et historique (03, ADR-0001).
- `/admin/finance` : onglets Paiements, Remboursements, Litiges, Reversements, Rapprochement, Rapports.
- `/admin/support` : conversations SUPPORT (10).
- `/admin/notifications` (11).
- `/admin/config` : remplacer la page en lecture seule par l'édition des paramètres, référentiels géographiques, annonces système, versions de l'app, CGU et feature flags.
- `/admin/audit` : journal.
- `/admin/admins` : gestion des comptes admin (SUPER_ADMIN).

## Critères d'acceptation
- Un admin `OPS` qui appelle `admin/refunds/:id` reçoit 403.
- Toute route `admin/*` sans TOTP validé dans la session renvoie 401 `TOTP_REQUIRED`.
- Modérer une annonce en `REJECTED` sans motif renvoie 400. Avec motif, le propriétaire reçoit une notification `LISTING_MODERATED` contenant ce motif.
- Chaque action admin crée exactement une entrée `AuditLog`, avec `before` et `after` (test sur suspend, moderate, refund).
- Un token d'impersonation sur une route POST renvoie 403. La bannière est affichée sur le web.
- Modifier `stay.serviceFeeRate` dans la configuration impacte les nouveaux devis en moins de 60 s, sans changer les réservations existantes.
- `GET app/config` renvoie `minVersion`. Le mobile force la mise à jour si la version installée est inférieure.
- La recherche `admin/users?q=0612` trouve par téléphone partiel.
- Une décision de revue de mandat papier sans motif renvoie 400 ; un ADMIN/AGENT d'agence ne peut pas décider la revue plateforme (403).
- L'approbation documentaire n'active pas un libellé « signature certifiée » et n'accorde pas de droit financier au-delà des règles existantes.
- Une décision `NEEDS_CORRECTION` exige un motif/action attendue, conserve l'accès opérationnel provisoire et suspend la diffusion jusqu'à approbation après resoumission.
- Après `REJECTED`, l'accès provisoire agence est révoqué et l'annonce concernée passe en `PAUSED` (03). Les dossiers déjà engagés ne sont ni supprimés ni invalidés ; l'agence conserve uniquement l'accès de clôture défini par la spec 03.
- Une demande de rattachement CRM assisté est décidée par PLATFORM_ADMIN, journalisée, et ne transfère aucun bien/mandat avant décision positive et confirmation appropriée.

## Priorité
- **P0** : [x] suspension, modération avec motif, base du journal d'audit et TOTP présents localement ; [ ] confirmer notification de modération et couverture des actions sensibles ; [ ] file de revue des mandats papier (12.5).
- **P1** : [ ] fiche 360°, gestion organisations/KYC, finance, RBAC complet, dossiers de modération génériques et configuration éditable.
- **P2** : [ ] impersonation, détection de fraude/doublons, annonces système, force update et KPI avancés.

## Delta d'implémentation
| ID | Priorité | Delta | État |
|---|---|---|---|
| 12.1 | P0 | Vérifier la notification de modération avec motif et couvrir toutes les actions sensibles dans le journal d'audit. | À vérifier / compléter |
| 12.2 | P1 | Compléter les écrans admin utilisateurs, organisations/KYC, finance et RBAC. | **Partiel.** Liste utilisateur paginée avec statut/actions, suspension avec motif et page détail de base présents. La fiche 360°, recherche/filtres serveur, organisation utilisable avec API/détail/actions, KYC, finance et RBAC complet restent à faire. |
| 12.3 | P1 | Terminer les dossiers de modération génériques, le suivi déclarant et la configuration/référentiels. | **Partiel.** Des pages détail existent pour les demandes d'ouverture et signalements, mais les dossiers de modération génériques, l'assignation/notes internes, le suivi du déclarant et la configuration/référentiels modifiables ne sont pas terminés. |
| 12.4 | P2 | Ajouter impersonation, détection fraude/doublons, annonces, politiques de version et KPI avancés. | **Partiel.** Le client mobile applique localement la politique `minVersion` de `app/config`; l'édition admin de cette politique, l'impersonation, les annonces, les flags, la fraude/doublons et les KPI avancés restent à faire ou valider. |
| 12.5 | P0 | File plateforme de revue documentaire des mandats papier (clients externes), checklist, décisions versionnées, rattachements CRM assistés et audit d'accès/clôture. | **Partiel.** Contrat et règles post-refus définis (ADR-0001/spec 03) ; API de file/décision et écran `/admin/mandate-reviews` ajoutés localement — gestion complète de `NEEDS_CORRECTION`, clôture des engagements préexistants, file de rattachement assisté, checklist UI et preuves E2E restent à valider/implémenter. |
