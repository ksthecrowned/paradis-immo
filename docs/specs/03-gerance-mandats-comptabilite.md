# 03 — Gérance : mandats, approbations et comptabilité propriétaire

## Objectif et rôles
Formaliser la relation propriétaire–agence :
- mandat négocié et accepté, avec commission ;
- approbations qui produisent réellement leurs effets ;
- comptabilité claire pour le propriétaire (encaissements, honoraires, dépenses, reversements, relevés).

Rôles : `OWNER`, `MANAGER`, `AGENT`, `PLATFORM_ADMIN` (consultation).

## Audit initial — état local à revalider
- `Mandate` : `status` ACTIVE ou REVOKED, `startDate`, `endDate?`, `assignedAgentId`. Il est actif dès la création par le propriétaire, sans acceptation de l'agence.
- Pas de type de mandat (gestion locative, vente, séjours), pas de commission, pas d'exclusivité, pas de document signé.
- `revokeMandate` existe dans le service, mais aucune route ne l'expose. Aucun `GET` ne liste les mandats du propriétaire.
- `MandateApproval` : `LEASE_SIGN`, `RENT_REDUCTION`, `MAJOR_REPAIR`.
  - `decideApproval` change le statut mais n'émet aucun événement et n'applique pas l'action.
  - `RENT_REDUCTION` n'a pas de flux de création.
  - Aucun type pour la vente (prix, offre).
- L'événement `MANDATE_ACTION_PENDING` est émis mais n'a pas de listener.
- Pas de page web « mandats » côté agent. `owner/mandate` liste les approbations.
- Pas de comptabilité : ni honoraires, ni dépenses, ni reversements, ni relevés.

## Audit source du tableau de bord Owner / agence / Agent (2026-10-15)

Cette section décrit les parcours présents dans le code web et les services de stats correspondants, pas l'état cible des anciennes user stories. « Admin agence » désigne ici le membre `ADMIN` d'une organisation `AGENCY` ; ce rôle n'a pas de route dashboard distincte.

### État réellement câblé

| Surface | Source observée | Limite fonctionnelle actuelle |
|---|---|---|
| Dashboard Owner | `/owner/dashboard` appelle `/owner/stats` et charge aussi paiements, visites, biens et baux via des requêtes séparées. Il affiche 4 compteurs : biens actifs, baux actifs, paiements en attente et demandes de visite. | Pas de synthèse du net propriétaire, des loyers encaissés/impayés, des dépenses, des reversements, des candidatures, des séjours ou des demandes d'approbation sur le dashboard. Les compteurs API de paiements couvrent les échéances de loyers allouées, pas nécessairement tous les types de paiement. |
| Dashboard Admin agence | Le membre organisation `ADMIN` est résolu comme rôle dashboard `agent`, puis utilise `/agent/dashboard` et `/agent/stats`, comme un Agent. | Aucun dashboard gérant distinct, aucun sélecteur d'agence active ni indicateurs d'équipe/org. Le périmètre repose sur les biens que `AgencyAccessService.listOperablePropertyIds` rend opérables ; pour un `ADMIN`, il peut couvrir les mandats actifs de l'agence et les biens d'organisation sans mandat. |
| Dashboard Agent | `/agent/dashboard` affiche biens mandatés, visites aujourd'hui, paiements espèces à valider et tickets maintenance ouverts. Le service API calcule les visites sur le jour calendaire `Africa/Brazzaville`. | Le champ « biens mandatés » compte en réalité les biens actifs du périmètre opérable, qui peut ne pas correspondre strictement aux biens sous mandat. Le comptage des paiements espèces inclut un scan plafonné à 500 paiements cash non alloués pour retrouver ceux reliés par metadata, pouvant sous-compter les cas au-delà de cette limite. Les actions du tableau n'affichent pas le nom du bien ou du client, seulement un identifiant court dans plusieurs endroits. |
| Graphique « Revenus encaissés » partagé | `RevenueChart` calcule côté navigateur une série à partir des paiements chargés par les pages Owner/Agent. Il considère `VALIDATED` et `PAID`, regroupe par `createdAt` et rend montant + nombre de paiements. | Les pages ne chargent que la première page de 100 paiements : au-delà, historique incomplet. La date d'encaissement n'est pas utilisée (le calcul s'appuie sur `createdAt`) et le montant du paiement n'est pas nécessairement le revenu net/honoraires/revenu propriétaire. Le libellé « revenus encaissés » peut donc induire en erreur. |
| Graphique « Biens par mode » partagé | Construit dans le navigateur avec `/properties/managed?limit=100`. | Limité aux 100 premiers biens, sans total ni navigation ; peut être faux dès que le portefeuille dépasse 100 biens. La répartition ne précise pas si elle porte sur tous les statuts ou seulement les biens actifs. |
| Sparklines des compteurs | Construites dans le navigateur à partir des listes courantes. | Les séries « biens » et « baux » du Owner répètent le total actuel sur 7 jours ; « biens » Agent répète le nombre de biens chargés. Ces valeurs ne sont pas une évolution historique. Les autres courbes sont dérivées des listes récentes/courantes, donc bornées à 100 paiements ou au périmètre renvoyé par la route. Elles ne doivent pas être présentées comme des tendances historiques fiables. |
| Activité récente Owner | Affiche jusqu'à cinq visites et cinq paiements à partir des listes chargées. | Les visites sont des demandes récentes par date de création, pas nécessairement les prochaines visites à traiter. Les lignes utilisent l'ID court du bien au lieu de son titre/adresse. |
| Activité récente Agent | Filtre les visites renvoyées sur aujourd'hui à Brazzaville et les trie par début de créneau ; affiche jusqu'à cinq paiements espèces `PENDING_VALIDATION` dans les 100 paiements chargés. | Les paiements à valider peuvent être omis si plus de 100 paiements plus récents existent ; les deux blocs n'affichent pas le nom du bien, ni le payeur/demandeur. |
| Chargement et erreurs | Les appels de stats, paiements, visites, biens et baux/maintenance sont lancés ensemble. Les stats échouées affichent un bandeau mais des compteurs à zéro ; la plupart des autres erreurs sont converties en listes vides. | Une panne partielle peut être présentée comme une absence réelle de données. Un zéro de repli n'est pas distingué de la valeur serveur. Les widgets n'ont pas d'état d'erreur/retry indépendant. |
| Carte des biens du marché | Le composant réutilisé Owner/Agent charge les biens puis choisit jusqu'à quatre actifs, sinon les quatre premiers disponibles. | Erreurs avalées sans message ; la section peut être vide sans distinguer panne et absence de biens. Le titre « sur le marché » peut inclure des biens non actifs lorsque aucun bien actif n'est présent. |

### Périmètre des rôles et accès
- Le web résout une appartenance d'organisation `ADMIN` ou `AGENT` vers l'unique rôle dashboard `agent`. Le commutateur de rôle distingue `owner`, `agent` et `admin` (plateforme), pas `ADMIN` d'agence et Agent.
- Un utilisateur `ADMIN` d'agence et un utilisateur `AGENT` partagent donc les mêmes composants et routes du dashboard, mais le service `AgencyAccessService` applique des périmètres de biens différents : l'ADMIN d'organisation peut opérer les biens actifs de mandats de l'organisation et ses biens sans mandat ; l'AGENT de terrain est limité aux biens où il est assigné sous mandat actif.
- Un membre `ADMIN` d'agence ne doit pas être confondu avec le `PLATFORM_ADMIN` : ce dernier utilise `/admin/dashboard` et ses indicateurs de plateforme.
- La définition des indicateurs dans l'API et les listes qui alimentent les graphiques doit appliquer le même périmètre d'accès. Les cartes ne doivent jamais mélanger données personnelles d'un propriétaire et données de plusieurs organisations sans contexte explicite.

### Tableau de bord à finaliser — champs et comportements attendus

| Vue | Contenu minimal à afficher |
|---|---|
| Owner `/owner/dashboard` | Sélecteur de période et bien si le portefeuille le justifie ; cartes : biens actifs/en brouillon, baux actifs, paiements/loyers en attente, échéances en retard, approbations en attente, visites à venir, tickets maintenance ouverts. Synthèse financière issue du ledger : loyers encaissés, dépenses approuvées, honoraires, reversements effectués et solde net à reverser (montant + devise + période). |
| Admin agence `/agent/dashboard` lorsque le membre est `ADMIN` | Sélecteur d'organisation active si plusieurs affiliations, période et périmètre ; cartes : biens actifs et sous mandat, mandats à traiter/expirant, visites du jour/à venir, candidatures en attente, paiements espèces à valider, impayés, tickets ouverts/en retard SLA, ventes/réservations à action requise. Synthèse honoraires d'agence par période et activité de l'équipe (visites/dossiers par agent), avec liens filtrés vers les listes existantes. |
| Agent `/agent/dashboard` lorsque le membre est `AGENT` | Cartes limitées aux biens assignés : visites du jour et prochaines (date/heure, bien, statut, client), paiements espèces réellement à valider (bien, montant/devise, payeur masqué, date), tickets assignés/urgents (bien, priorité, ancienneté), candidatures et tâches/dossiers qui lui sont assignés. Ne pas montrer les finances globales de l'agence ou des biens non assignés. |
| Activité récente Owner | Visites futures à venir (triées par `slotStartAt`, pas par date de création), paiements récemment validés/échoués/en attente et échéances à traiter ; titre/référence du bien, statut, montant/devise lorsque pertinent, date métier, CTA vers le détail. |
| Activité récente gérant/agence | File actionnable regroupant demandes de mandat/approbation, paiements cash à valider, visites prochaines, candidatures, maintenance urgente ou hors SLA et litiges. Chaque élément précise ancienneté, agent assigné, bien et lien vers la page de traitement. |
| Graphiques | Remplacer les calculs client sur échantillons par des agrégats API exhaustifs et scoped. Revenus/encaissements séparent montant brut, commissions/frais, dépenses et net ; date de comptabilisation pertinente (ledger/validation) ; devise explicite. Répartition des biens expose le total, la définition du statut compté et le périmètre. Un graphique absent de contrat fiable doit être retiré ou clairement indiqué indisponible, jamais rempli de zéro par défaut. |
| Tendances des cartes | Une sparkline est affichée uniquement si l'API fournit une série temporelle réelle pour la même mesure et périmètre. Inclure période comparée et unité ; sinon présenter la valeur seule sans sparkline. |

### Contrats de données / états UI requis pour fermer le dashboard
- Fournir un contrat de synthèse par rôle/périmètre, avec `generatedAt`, période demandée, fuseau horaire, devise ou liste de devises, compteurs nommés, séries temporelles et `meta` signalant une éventuelle troncature. La page ne doit pas reconstituer un agrégat financier complet à partir de la première page d'une liste.
- Les listes « à traiter » et « prochains » sont paginées/limitées côté API avec un total ou un `hasMore`, triées selon la date métier et le statut d'action ; afficher « Voir tout » vers la bonne page avec filtres correspondant au widget.
- Chaque widget gère indépendamment chargement, valeur, absence, erreur et réessai. Une erreur de source n'est jamais transformée en `[]` ou compteur `0` sans indication visible.
- Les cartes KPI sont accessibles au clavier et leur cible de navigation correspond à leur définition exacte (ex. échéances en retard → impayés/échéances, et non modération).
- Le changement de rôle ou d'organisation invalide les caches et recharge les stats, listes et charts pour le nouveau périmètre. L'organisation sélectionnée est persistée dans l'URL ou le contexte de navigation si plusieurs sont accessibles.

### Spécification de clôture détaillée — dashboards de gestion

Cette définition est basée sur les appels et composants actuellement présents dans `apps/web/app/{owner,agent}/dashboard`, `apps/web/components/dashboard` et les services stats correspondants dans `apps/api/src/{owner,agent}`. Les nouveaux contrats ci-dessous sont des travaux à implémenter, pas des endpoints supposés existants.

#### 1. Définitions stables des indicateurs

| Indicateur | Définition attendue | Destination du clic |
|---|---|---|
| Biens actifs | Nombre de biens du périmètre de l'utilisateur dont `Property.status = ACTIVE`. Ne pas nommer ce compteur « biens mandatés » si la requête inclut aussi des biens possédés ou gérés sans mandat. | Liste de biens avec filtre `status=ACTIVE` et périmètre conservé. |
| Biens sous mandat actif | Biens distincts reliés à un mandat en vigueur dans l'organisation/périmètre courant. C'est un compteur distinct de « biens actifs ». | Liste des mandats ou du portefeuille avec filtre mandat actif. |
| Baux actifs | Baux du périmètre avec statut métier actif ; dédupliquer au niveau bail. | Liste des baux avec `status=ACTIVE`. |
| Paiements à valider | Paiements espèces ayant `status=PENDING_VALIDATION`, liés à un bien du périmètre par allocation ou lien métier confirmé. Le comptage ne doit pas reposer sur un échantillon plafonné de 500 lignes. | Validation des paiements avec statut et méthode préfiltrés. |
| Paiements en attente (Owner) | Garder explicitement le sens actuel si retenu : paiements `INITIATED` ou `PENDING_VALIDATION` reliés à des échéances de loyer du périmètre. Renommer « Loyers en attente de paiement/validation » si ce n'est pas tous les paiements. Les paiements sans allocation ne sont pas comptés comme échéance de loyer. | Échéances/impayés ou paiements selon la définition retenue, avec filtre équivalent. |
| Échéances en retard | Échéances de loyer dues avant l'instant de calcul et toujours non réglées selon les statuts métier retenus. Exclure les échéances annulées/waivées ; ne pas confondre avec paiements échoués. | Liste des impayés/échéances en retard. |
| Visites aujourd'hui | Réservations PENDING ou CONFIRMED dont le créneau `slot.startAt` tombe dans le jour calendaire `Africa/Brazzaville`. L'indicateur et la liste utilisent la même requête et les mêmes statuts. | Agenda filtré sur aujourd'hui et le périmètre. |
| Tickets maintenance ouverts | Tickets dans les statuts ouverts définis par le domaine (au minimum OPEN et IN_PROGRESS ; documenter l'inclusion d'ASSIGNED). Gérant voit l'organisation ; Agent voit seulement ses tickets assignés ou biens assignés. | Maintenance avec filtres de statut/assignation correspondants. |
| Montants financiers | Toute somme doit préciser nature (brut encaissé, commission, dépense approuvée, reversement, solde), période de comptabilisation et devise. En cas de plusieurs devises, afficher une ligne par devise ; ne pas sommer les devises entre elles. | Finances/relevé avec période, devise et périmètre conservés. |

Chaque carte affiche le libellé métier, la valeur, l'unité/devise si applicable, l'intervalle de période, un texte d'aide décrivant ce qui est compté, et une cible de navigation exacte. `0` ne signifie « aucune donnée » que si la requête a réussi et confirme zéro.

#### 2. Contrat API de synthèse

Faire évoluer `GET /owner/stats` et `GET /agent/stats` ou créer des routes dashboard dédiées, sans que le web télécharge les listes de paiements/biens pour les agréger dans le navigateur.

Paramètres communs :
- `from`, `to` : bornes ISO inclusives/exclusives documentées ; valeur par défaut définie par le produit (période en cours), dates validées côté serveur.
- `propertyId` : filtre facultatif, autorisé seulement si le bien appartient au périmètre opérable.
- `organizationId` : utilisé pour les vues d'organisation ; doit correspondre à une appartenance active et un rôle qui peut lire les indicateurs de l'agence.
- Les dates calendaires sont interprétées en `Africa/Brazzaville`. L'API retourne les bornes effectives afin que l'interface les affiche sans ambiguïté.

Réponse minimale :
```json
{
  "data": {
    "scope": { "role": "OWNER|AGENCY_ADMIN|AGENT", "organizationId": null, "propertyId": null },
    "period": { "from": "ISO-8601", "to": "ISO-8601", "timeZone": "Africa/Brazzaville" },
    "generatedAt": "ISO-8601",
    "metrics": {
      "activeProperties": 0,
      "activeMandatedProperties": 0,
      "activeLeases": 0,
      "pendingRentPayments": 0,
      "overdueRentSchedules": 0,
      "visitsToday": 0,
      "pendingCashValidations": 0,
      "openMaintenanceTickets": 0
    },
    "financials": [
      { "currency": "XAF", "grossCollected": "0", "fees": "0", "approvedExpenses": "0", "paidOut": "0", "netBalance": "0" }
    ],
    "series": [],
    "meta": { "truncated": false }
  }
}
```
- Les métriques non applicables au rôle peuvent être omises selon un schéma typé/versionné ; une métrique absente n'est pas convertie en zéro.
- `series` contient des points agrégés par jour/semaine/mois, avec dates/bornes et définition de mesure ; le serveur applique le même scope et la même devise que les KPI. Si aucune série historique correcte n'est disponible, l'API la laisse absente et le client n'affiche pas de sparkline.
- Aucun total financier ne doit être construit à partir des 100 paiements chargés par `listManagedPayments`. Utiliser le ledger pour les valeurs de comptabilité/revenu net et une date comptable déterministe (`occurredAt`/date de validation conforme au domaine), pas `createdAt` par commodité.
- Les erreurs d'accès à un `organizationId` ou `propertyId` hors périmètre renvoient une erreur autorisation standard, sans retourner une synthèse vide.

#### 3. Contrats API des blocs actionnables

Les listes de dashboard sont des aperçus serveur dédiés (ou des listes métier déjà paginées avec filtres explicites), et jamais un `slice()` sur un échantillon non exhaustif côté client.

| Bloc | Ordre et champs minimaux par ligne | Requête/navigation |
|---|---|---|
| Prochaines visites | `id`, `slotStartAt`, `status`, `property { id, title, addressLabel }`, `visitor { displayNameMasked }`, `assignedAgent { id, name }` | Futures visites non annulées, tri croissant par `slotStartAt`; « Voir tout » ouvre l'agenda sur le même intervalle. |
| Paiements à valider | `id`, `createdAt`, `amount`, `currency`, `property { id, title }`, `payerDisplayNameMasked`, `payerPhoneMasked`, `status`, `method` | `PENDING_VALIDATION` + `CASH`, tri par ancienneté croissante ; destination de validation préfiltrée. |
| Maintenance à traiter | `id`, `title`, `priority`, `status`, `createdAt`, `updatedAt`, `property { id, title }`, `assignee { id, name }`, `slaDueAt` si calculé | Urgents puis SLA dépassé puis plus ancien ; Agent limité à ses objets assignés. |
| Activité Owner | Paiements récents avec `validatedAt` et statut, visites à venir, échéances en retard, approbations en attente ; pour chaque entrée, `id`, date métier, statut, montant/devise si pertinent, bien identifiable et lien relatif sûr. | Trier chaque type selon sa date métier ; afficher des blocs séparés plutôt qu'un mélange de dates/statuts incomparables. |
| Activité agence | Dossiers et tâches en attente d'action : type, référence, date de création/échéance, bien, agent assigné, urgence/statut. | Filtrer selon organisation active, autorisations et files réellement implémentées. Ne pas afficher de catégorie sans source API fonctionnelle. |

Chaque endpoint de bloc retourne `data`, `meta.total` (ou `hasMore` documenté), période et scope. Le dashboard ne demande que les quelques entrées à afficher, mais les compteurs globaux restent exhaustifs. Si une source n'existe pas, le bloc est masqué jusqu'à implémentation ; il n'est pas simulé.

#### 4. Vues, périmètres et sélection de contexte

- **Owner** : utiliser les biens accessibles en propriété/gestion selon les règles API existantes. Si plusieurs biens, un filtre « Tous les biens »/bien individuel s'applique de manière cohérente aux KPI, blocs et graphiques. Ne pas afficher les finances d'une agence comme si elles étaient celles du propriétaire.
- **Admin agence (`OrganizationMember.role=ADMIN`)** : vue de pilotage de l'organisation, distincte de celle Agent. Si plusieurs organisations ADMIN actives, proposer un sélecteur avec nom/type/ville et persister `organizationId` dans l'URL ; sinon sélectionner automatiquement l'unique organisation. Les agrégats sont strictement ceux de cette organisation, pas l'union silencieuse de toutes les appartenances.
- **Agent (`OrganizationMember.role=AGENT`)** : vue de travail individuel. Les biens, visites, paiements et tickets doivent être limités aux objets assignés conformément à `AgencyAccessService` et aux règles propres à chaque domaine. Aucun total financier organisationnel ni donnée d'autres agents.
- **Comptes ayant plusieurs rôles dashboard** : le changement Owner/Agent/Admin plateforme déclenche un nouveau chargement complet. Le rôle Admin plateforme n'est pas l'Admin agence. La navigation et le titre indiquent toujours le rôle/périmètre courant.
- Les écrans d'erreur 403/404 ne doivent pas révéler le nom ou l'existence d'une organisation ou propriété inaccessible.

#### 5. Comportement UI et traitements d'erreur

- Charger chaque widget indépendamment ; afficher un squelette local puis l'état réel. Échec de visites ne bloque pas les stats ni le graphique.
- Un widget en erreur montre une explication courte et une action « Réessayer » ; ne pas effacer une valeur précédente lors d'un refresh en cours sauf si son périmètre a changé.
- Un widget vide explique l'absence (ex. « Aucune visite à venir sur cette période ») et propose une action pertinente si le rôle peut en créer/consulter. Les erreurs HTTP ne sont jamais rendues comme des états vides.
- Ajouter l'actualisation manuelle du dashboard et une date « Mis à jour à … ». Si un rafraîchissement automatique est ajouté, il ne doit pas interrompre une saisie ou une action en cours.
- Un changement de période, de bien ou d'organisation recharge tous les widgets dépendants, remet à zéro les pages/filtres des blocs, met à jour l'URL et empêche l'affichage transitoire de données du scope précédent.
- Pour les événements qui changent l'état (validation paiement, réservation/visite, action maintenance), le dashboard ne préjuge pas du succès ; après navigation retour, actualiser les données depuis le serveur.
- Utiliser des libellés et formats de nombres/dates cohérents en `fr-FR`; toutes dates de visite/activité sont explicitement en `Africa/Brazzaville`.
- Les lignes sont navigables au clavier et indiquent une destination accessible ; les champs sensibles (téléphone/client) sont masqués selon les permissions et ne sont pas inclus dans les sparklines ou exports.

#### 6. Plan de réalisation depuis l'état du code

1. **P0 — enlever les signaux trompeurs** : renommer « Biens mandatés » si le compteur reste celui des biens actifs opérables ; corriger les liens KPI ; retirer les sparklines calculées par répétition d'une valeur actuelle et celles présentées comme tendances historiques sans série complète ; remplacer les références de biens seules par titre et ville via le contrat de bloc.
2. **P0 — erreurs et périmètre** : arrêter les `.catch(() => [])`/compteurs à zéro silencieux sur les chargements dashboard ; ajouter état et retry par widget ; supprimer le plafond métier de 500 dans le comptage cash non alloué ou créer un lien relationnel/agrégat serveur exact.
3. **P1 — agrégats exhaustifs** : faire évoluer les stats Owner/Agent avec périodes et filtres scoped ; calculer les finances à partir des données comptables correspondantes ; fournir au serveur les séries et compteurs exacts. Les listes consommées par le dashboard doivent charger uniquement les lignes d'aperçu nécessaires.
4. **P1 — expérience gérant et tâches** : distinguer `AGENCY_ADMIN` d'`AGENT` dans le rôle UI, ajouter le contexte organisation, les cartes/actions d'équipe au gérant, les tâches assignées à l'agent ; ne montrer que les sources effectivement présentes et autorisées.
5. **P1 — activités utiles** : remplacer visites Owner récentes par prochaines visites, trier par date de créneau ; afficher données contextuelles et statut métier ; conserver filtres dans les destinations.
6. **P2 — enrichissement analytique** : ajouter conversion visites→baux, tendances d'activité et SLA uniquement lorsque le calcul métier, la période, le dénominateur et la couverture historique sont vérifiés et documentés.

#### 7. Critères d'acceptation fonctionnels et de données

1. Pour un jeu de données de test de plus de 100 paiements et plus de 100 biens, les compteurs et graphiques dashboard égalent les agrégats serveur complets et ne sont pas limités à la première page.
2. Les appels sous propriétaire, administrateur d'agence et agent montrent uniquement leurs données autorisées ; deux organisations du même compte ne sont jamais fusionnées si une organisation est sélectionnée.
3. Un utilisateur `ADMIN` d'agence voit un dashboard gérant distinct ; un `AGENT` n'obtient ni KPI financier global ni détails de biens non assignés.
4. Le total « visites aujourd'hui » est égal au nombre de lignes de l'agenda pour le jour `Africa/Brazzaville` avec les mêmes statuts et le même périmètre.
5. Un paiement cash `PENDING_VALIDATION` associé au portefeuille par allocation ou relation canonique est compté même s'il se trouve après les 500 anciens enregistrements non alloués ; un paiement d'un autre portefeuille n'est jamais compté.
6. Les revenus affichés sont calculés depuis l'événement comptable approprié, excluent les statuts non encaissés, séparent brut/frais/net et ne mélangent aucune devise. Le libellé correspond exactement à la mesure.
7. Une panne isolée d'un endpoint produit un widget en erreur avec retry ; elle n'affiche ni « 0 » ni « Aucun élément » à la place des données inconnues.
8. Chaque sparkline affichée contient des points historiques réels pour la même métrique, période et scope que la carte ; sinon aucune sparkline n'est rendue.
9. Les blocs de visites, paiements et maintenance affichent titre du bien, statut et date métier, présentent `Voir tout` avec filtres équivalents et n'utilisent pas un ID court comme unique identification humaine.
10. Changer organisation, période, bien ou rôle n'affiche jamais les résultats du contexte précédent pendant le chargement et recharge tous les widgets concernés.

## User stories
### Mandat
1. En tant que propriétaire, je propose un mandat à une agence. Je choisis le type (LOCATION_LONGUE, SEJOURS, VENTE, ou plusieurs), la durée, l'exclusivité, la commission et les seuils d'approbation.
2. En tant que gérant d'agence, j'accepte, je refuse, ou je contre-propose les conditions (commission, durée).
3. Le mandat accepté génère un PDF de mandat signé électroniquement par les deux parties (OTP de signature).
4. Je vois la liste de mes mandats (en cours, en attente, terminés) et l'historique de chacun.
5. En tant que propriétaire, je résilie un mandat avec préavis, ou immédiatement pour faute (avec motif).
6. En tant qu'agence, je renonce à un mandat avec préavis.
7. À l'échéance d'un mandat à durée déterminée, il est renouvelé tacitement sauf dénonciation 30 jours avant. Les deux parties sont notifiées à J-45 et J-30.
8. En tant que gérant, j'assigne ou je réassigne un agent (route existante) ; l'agent est notifié.

### Approbations
9. En tant qu'agent, je soumets au propriétaire :
   - une signature de bail (LEASE_SIGN) ;
   - une baisse de loyer (RENT_REDUCTION) ;
   - un gros travaux (MAJOR_REPAIR) ;
   - un prix de vente ou une offre (SALE_PRICE, SALE_OFFER_ACCEPT) ;
   - une dépense (EXPENSE).
10. En tant que propriétaire, j'approuve ou je refuse avec un commentaire. L'action est alors appliquée automatiquement : bail activé, loyer modifié, ticket débloqué, offre acceptée, dépense validée.
11. Une approbation non traitée expire après N jours (paramétrable par mandat, 7 par défaut), avec relances à J+2 et J+5.

### Comptabilité
12. En tant que propriétaire, je vois pour chaque bien et chaque période :
    - les loyers appelés et encaissés, et les impayés ;
    - les honoraires de l'agence et les dépenses (travaux, taxes) ;
    - le net à reverser et le déjà reversé.
13. Je télécharge un relevé de gérance mensuel PDF et un récapitulatif annuel pour mes déclarations.
14. En tant qu'agence, j'enregistre une dépense sur un bien (facture jointe). Au-delà du seuil, elle passe par une approbation EXPENSE.
15. En tant qu'agence, je vois mon chiffre d'honoraires par mandat et par période, et j'exporte en CSV.

## Règles métier
- **Statuts de mandat** : `PROPOSED` → `ACTIVE` | `DECLINED` | `COUNTERED` ; `ACTIVE` → `TERMINATING` (préavis) → `TERMINATED` ; `ACTIVE` → `EXPIRED`. `REVOKED` est conservé pour l'existant et migré vers `TERMINATED` avec `terminationReason = OWNER_REVOKED`.
- **Deux axes distincts (ADR-0001)** — ne pas confondre :
  1. **Validation / preuve du mandat** : acceptation authentifiée du propriétaire (mandat virtuel, client lié à un compte) **ou** revue documentaire plateforme du mandat papier (contact externe). La revue a ses propres états : `APPROVED` | `NEEDS_CORRECTION` | `REJECTED` (motif obligatoire). Elle vérifie lisibilité, complétude, cohérence des parties/bien, dates/signatures visibles et justificatif de propriété ou d'autorisation de gestion ; elle **ne certifie pas** l'authenticité juridique de la signature.
  2. **Accès opérationnel provisoire** : pendant l'attente (mandat `PROPOSED` / revue en cours / `NEEDS_CORRECTION`), l'agence peut préparer et modifier le bien, le publier, organiser les visites et gérer les opérations locatives, sous appartenance ACTIVE et assignation agent. Les contrôles d'approbation owner déjà prévus (signature de bail, réparation au-dessus du seuil, etc.) restent. Les ventes et mouvements financiers suivent leurs permissions propres et ne sont pas élargis. Pas de reversement vers un bénéficiaire externe non vérifié.
- **Initiateur et décideur** : représenter clairement qui a proposé le mandat (OWNER → agence, ou agence → client lié) et qui doit décider. Un simple dépôt CRM ou une notification n'est pas un consentement.
- **Fin d'attente négative** :
  - **Refus du mandat virtuel par le propriétaire (`DECLINED`)** : décision terminale pour cette proposition/version. Révoquer immédiatement l'accès opérationnel provisoire de l'agence ; passer le bien en `PAUSED`, le retirer de tous les canaux de diffusion et empêcher tout nouvel engagement. Conserver le refus, l'auteur, la date, la version présentée et le motif éventuel. La même proposition ne peut pas être réactivée ou renvoyée pour contourner le refus. Un nouveau mandat n'est possible qu'après résolution documentée du désaccord et nouvelle action explicite du propriétaire (nouvelle demande ou invitation acceptée).
  - **Rejet définitif du mandat papier (`REJECTED`) par l'admin plateforme** : même révocation immédiate, mise en pause du bien et retrait de tous les canaux ; conserver les versions, pièces, checklist, motif, auteur et dates. La décision est terminale pour ce dossier. L'agence peut demander une nouvelle revue avec de nouvelles pièces et justification, mais l'annonce reste masquée et l'accès provisoire révoqué pendant cette procédure. Cette nouvelle demande crée un dossier/version de revue distincte ; elle ne rouvre pas ni ne réactive le dossier rejeté. Une nouvelle approbation documentaire ne réactive pas automatiquement la publication : un admin d'agence doit republier après vérification des conditions de publication.
  - **Demande de correction (`NEEDS_CORRECTION`)** : état non terminal et corrigeable. L'accès provisoire opérationnel reste en vigueur, mais la diffusion publique est suspendue : le bien passe à `PAUSED` et est retiré de tous les canaux jusqu'à resoumission des pièces et décision `APPROVED`. Après approbation, il reste `PAUSED` jusqu'à republication explicite par un admin d'agence. L'historique de versions et des motifs reste consultable.
  - **Expiration ou révocation avant acceptation** : révoquer l'accès provisoire, mettre le bien en `PAUSED`, retirer les diffusions et empêcher les nouveaux engagements, comme pour un refus définitif.
  - **Engagements antérieurs à la décision** : ne jamais supprimer ni invalider rétroactivement un bail, séjour/réservation confirmé, visite confirmée, offre acceptée, compromis, paiement, dette, remboursement ou écriture comptable. Les visites/candidatures non confirmées et autres demandes sans engagement sont fermées ou annulées avec notification. L'agence conserve uniquement les droits minimaux nécessaires à l'exécution et la clôture des dossiers déjà engagés (dont sécurité, maintenance urgente, perception/régularisation de montants dus et remboursements requis) ; aucun nouveau bail, séjour/réservation, visite, offre ou dépense discrétionnaire ne peut être initié sous ce mandat. Ces droits sont limités aux objets créés avant la décision, audités et révoqués après transfert ou clôture. Le propriétaire ou PLATFORM_ADMIN peut organiser un transfert vers le propriétaire ou une autre agence, sans transfert automatique du mandat.
- **Propriétaire déclaré du bien** : `agencyClientId` (CRM de l'agence) et/ou `ownerId` (User, nullable pour contact externe). Pas de faux compte. Biens auto-déclarés OWNER conservent `ownerId`. Une seule identité propriétaire valide par bien. Voir ADR-0001.
- **Changement de client sur un bien** : AGENT/ADMIN peut remplacer par un autre client de la **même** agence ; changement audité ; n'altère pas silencieusement l'historique des mandats/pièces.
- **Unicité** : un seul mandat ACTIVE par bien et par périmètre (`scope`). Un mandat exclusif bloque tout autre mandat sur le même scope.
- **Commission**
  - Gestion locative : `managementFeeRate`, en % des loyers encaissés (8 % par défaut, modifiable).
  - Mise en location : `lettingFee` (fixe ou en mois de loyer).
  - Vente : `saleCommissionRate`, en % du prix.
  - Séjours : `stayCommissionRate`, en % du montant hors frais.
  - Les honoraires sont calculés automatiquement à chaque validation de paiement alloué à un bien sous mandat (`LedgerEntry` de type FEE).
- **Seuils d'approbation, par mandat**
  - `repairApprovalThreshold` en XAF (remplace la seule règle de priorité) ;
  - `rentChangeRequiresApproval` (true par défaut) ;
  - `leaseSignRequiresApproval` (true par défaut) ;
  - `minSalePrice`.
- **Effets d'une approbation APPROVED**
  - `LEASE_SIGN` : le bail DRAFT passe en ACTIVE (04).
  - `RENT_REDUCTION` : `payload { leaseId, newMonthlyRent, effectiveFrom }`. Les échéances PENDING à partir de `effectiveFrom` sont recalculées et un avenant est généré (04).
  - `MAJOR_REPAIR` : le ticket est débloqué (`requiresOwnerApproval` levé, statut ASSIGNED possible, voir 09).
  - `SALE_PRICE` : le prix du bien est mis à jour.
  - `SALE_OFFER_ACCEPT` : l'offre passe en ACCEPTED (08).
  - `EXPENSE` : la dépense passe en APPROVED et est imputée.
- **Effets d'un refus REJECTED** : l'objet source repasse dans l'état antérieur, avec le motif visible par l'agent.
- **Événements** :
  - `MANDATE_PROPOSED`, `MANDATE_ACCEPTED`, `MANDATE_DECLINED`, `MANDATE_TERMINATED`, `MANDATE_EXPIRING` ;
  - dépôt, resoumission, `NEEDS_CORRECTION`, `APPROVED` et `REJECTED` de document émettent des événements idempotents avec `mandateId`, `propertyId`, `organizationId`, version et acteur ; notifier l'agence et le propriétaire/compte lié selon le destinataire. Un rejet/refus publie aussi le changement de listing/canaux et le périmètre de clôture, sans divulguer les notes internes ;
  - `MANDATE_ACTION_PENDING` (handler à créer) et `MANDATE_ACTION_DECIDED`.
- **Fin de mandat**
  - Les baux en cours restent valides. Le bien bascule en gestion directe par le propriétaire (son org).
  - L'agent assigné perd l'accès à J+0 (fin de préavis).
- **Grand livre (`LedgerEntry`)** : écriture immuable par bien et par org propriétaire.
  - Types : `RENT_IN`, `DEPOSIT_IN`, `DEPOSIT_OUT`, `FEE`, `EXPENSE`, `PAYOUT`, `ADJUSTMENT`, `REFUND`.
  - Une correction se fait par écriture inverse, jamais par modification.
- **Solde à reverser** = Σ RENT_IN − Σ FEE − Σ EXPENSE(APPROVED) − Σ PAYOUT, par mandat. Les reversements eux-mêmes sont traités en 05.
- **Relevés** : PDF mensuel généré le 5 du mois (cron) pour chaque mandat actif et envoyé au propriétaire par push et e-mail ; régénération possible à la demande.

## Modèle de données
```prisma
enum MandateStatus { PROPOSED COUNTERED ACTIVE TERMINATING TERMINATED EXPIRED DECLINED REVOKED }
enum MandateScope { LONG_TERM_RENTAL SHORT_STAY SALE }
enum MandateActionType { LEASE_SIGN RENT_REDUCTION MAJOR_REPAIR SALE_PRICE SALE_OFFER_ACCEPT EXPENSE }
enum ApprovalStatus { PENDING APPROVED REJECTED EXPIRED CANCELLED }
enum LedgerEntryType { RENT_IN DEPOSIT_IN DEPOSIT_OUT FEE EXPENSE PAYOUT ADJUSTMENT REFUND STAY_IN SALE_IN }
enum ExpenseStatus { DRAFT PENDING_APPROVAL APPROVED REJECTED PAID }

model Mandate {
  // + champs
  scopes                     MandateScope[]
  exclusive                  Boolean   @default(false)
  managementFeeRate          Decimal?  // ex. 0.08
  lettingFee                 Decimal?
  lettingFeeMonths           Decimal?
  saleCommissionRate         Decimal?
  stayCommissionRate         Decimal?
  repairApprovalThreshold    Decimal?
  rentChangeRequiresApproval Boolean   @default(true)
  leaseSignRequiresApproval  Boolean   @default(true)
  minSalePrice               Decimal?
  approvalTtlDays            Int       @default(7)
  noticeDays                 Int       @default(30)
  tacitRenewal               Boolean   @default(true)
  proposedById               String
  acceptedById               String?
  acceptedAt                 DateTime?
  terminationRequestedAt     DateTime?
  terminationEffectiveAt     DateTime?
  terminationReason          String?
  terminatedById             String?
  signedDocumentKey          String?
  ownerSignedAt              DateTime?
  agencySignedAt             DateTime?
  versions                   MandateVersion[]
}

model MandateVersion {
  id         String   @id @default(cuid())
  mandateId  String
  terms      Json     // snapshot des conditions proposées
  proposedBy String
  createdAt  DateTime @default(now())
}

model MandateApproval {
  // + champs
  requestedById String
  sourceType    String?   // LEASE | MAINTENANCE_TICKET | SALE_OFFER | EXPENSE | PROPERTY
  sourceId      String?
  comment       String?
  expiresAt     DateTime
  appliedAt     DateTime?
}

model Expense {
  id          String        @id @default(cuid())
  propertyId  String
  mandateId   String?
  ticketId    String?
  category    String        // REPAIR | TAX | INSURANCE | UTILITIES | OTHER
  label       String
  amount      Decimal
  currency    String
  invoiceKey  String?
  status      ExpenseStatus @default(DRAFT)
  createdById String
  incurredAt  DateTime
  createdAt   DateTime      @default(now())
}

model LedgerEntry {
  id             String          @id @default(cuid())
  propertyId     String
  mandateId      String?
  ownerOrgId     String
  agencyOrgId    String?
  type           LedgerEntryType
  amount         Decimal         // signé : + crédit propriétaire / − débit
  currency       String
  sourceType     String          // PAYMENT | EXPENSE | PAYOUT | REFUND | MANUAL
  sourceId       String
  reversesId     String?
  label          String
  occurredAt     DateTime
  createdAt      DateTime        @default(now())
  @@index([ownerOrgId, occurredAt])
  @@index([mandateId, occurredAt])
}

model OwnerStatement {
  id          String   @id @default(cuid())
  mandateId   String?
  ownerOrgId  String
  periodStart DateTime
  periodEnd   DateTime
  totals      Json
  fileKey     String
  generatedAt DateTime @default(now())
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `mandates` | OWNER | **Modifié** : crée en PROPOSED avec conditions |
| GET | `mandates/mine` | OWNER | Mandats de mes biens |
| GET | `mandates/managed` | MANAGER/AGENT | Existant ; ajouter filtres `status`, `scope`, pagination |
| GET | `mandates/:id` | parties | Détail, versions, approbations |
| POST | `mandates/:id/accept` | MANAGER | Accepte la dernière version |
| POST | `mandates/:id/decline` | MANAGER | `{ reason }` |
| POST | `mandates/:id/counter` | MANAGER/OWNER | Nouvelle version des conditions |
| POST | `mandates/:id/sign` | parties | Signature OTP (`{ code }`) |
| POST | `mandates/:id/terminate` | OWNER/MANAGER | `{ reason, immediate? }` : préavis ou fin immédiate pour faute |
| PATCH | `mandates/:id/assign` | MANAGER | Existant ; ajouter la notification |
| POST | `mandates/:id/approvals` | AGENT/MANAGER | `{ actionType, sourceType, sourceId, payload }` |
| GET | `mandates/pending-approvals` | OWNER | Existant ; ajouter la pagination |
| PATCH | `mandates/approvals/:id` | OWNER | **Modifié** : `{ decision, comment }` ; applique l'effet de manière transactionnelle |
| DELETE | `mandates/approvals/:id` | demandeur | Annule une demande PENDING |
| POST | `properties/:id/expenses` | MANAGER/AGENT/OWNER | Crée une dépense (+ facture) |
| GET | `properties/:id/expenses` | parties | Liste |
| PATCH | `expenses/:id` | créateur | Modifie un DRAFT, soumet |
| GET | `accounting/owner/summary` | OWNER | `?from&to&propertyId` : totaux par type |
| GET | `accounting/owner/ledger` | OWNER | Écritures paginées |
| GET | `accounting/owner/statements` | OWNER | Relevés |
| POST | `accounting/owner/statements` | OWNER | Génère un relevé `{ mandateId?, periodStart, periodEnd }` |
| GET | `accounting/agency/fees` | MANAGER | Honoraires par mandat et période |
| GET | `accounting/export.csv` | OWNER/MANAGER | Export CSV du ledger |

## Écrans
- **Web, owner**
  - `/owner/mandate` : remplacer la seule liste d'approbations par des onglets « Mandats » (cartes : statut, agence, scope, commission) et « Approbations » (avec effet prévisualisé : « Le loyer passera de 150 000 à 130 000 XAF à partir du 01/11 »).
  - `/owner/mandate/[id]` : conditions, versions, PDF, résiliation.
  - `/owner/mandate/add` : ajouter la sélection de l'agence (recherche par zone), les scopes, la commission et les seuils.
  - `/owner/finances` (nouveau) : synthèse, ledger, relevés, export.
- **Web, agent**
  - `/agent/mandates` (nouveau) : propositions reçues (accepter, refuser, contre-proposer), mandats actifs, assignation.
  - `/agent/mandates/[id]`.
  - `/agent/expenses`.
  - `/agent/finances` (ADMIN uniquement) : honoraires.
- **Mobile** (espace propriétaire, voir 14) : approbations avec push actionnable (Approuver / Refuser), relevés PDF.

## Critères d'acceptation
- Les KPI et listes visibles au dashboard correspondent au périmètre réellement autorisé : propriétaire, gérant d'agence ou agent assigné ; aucun agrégat n'est tronqué par la première page d'une liste.
- Pour un compte membre `ADMIN` d'agence, le dashboard affiche explicitement l'organisation/périmètre actif et les indicateurs d'équipe ; pour un `AGENT`, il ne divulgue pas les finances globales ou biens non assignés.
- Une panne d'une seule source du dashboard affiche l'erreur sur le widget concerné avec un retry, sans remplacer la valeur par zéro ou une liste vide présentée comme réelle.
- Les graphiques financiers utilisent la date de comptabilisation pertinente, une définition et une devise explicites ; aucune sparkline n'est calculée en répétant la valeur actuelle sur des dates passées.
- Les raccourcis des cartes et des listes ouvrent la page métier correspondante avec les filtres/période applicables.
- Un mandat en `PROPOSED` (ou dossier en revue documentaire / `NEEDS_CORRECTION`) **n'est pas** un mandat accepté/signé ; l'UI et les exports ne doivent pas l'étiqueter comme ACTIVE. L'accès opérationnel provisoire est autorisé selon la matrice ci-dessous et ADR-0001, indépendamment du label de consentement.
- Refus propriétaire ou rejet définitif documentaire révoque l'accès provisoire et passe l'annonce en `PAUSED`.
- `NEEDS_CORRECTION` garde les droits opérationnels provisoires mais met le bien en `PAUSED` et retire la diffusion publique ; après `APPROVED`, une republication explicite par un admin d'agence est requise.
- Après `DECLINED` ou `REJECTED`, aucune nouvelle opération d'agence n'est autorisée ; les engagements déjà créés restent intacts et l'accès de clôture ne permet que de les honorer/transférer. Aucun nouvel engagement n'est créé.
- Un nouveau dossier ou une acceptation/revue ultérieure ne réactive pas automatiquement le mandat ni le bien après un refus définitif ; le mandat et la publication suivent des transitions explicites et auditées.
- Chaque changement d'état post-décision émet au plus une notification par destinataire/canal ; les notes internes de revue restent réservées à la plateforme et ne sont pas incluses dans les notifications destinées à l'agence ou au propriétaire.
- Deux mandats ACTIVE exclusifs sur le même bien et le même scope sont impossibles (409 `MANDATE_CONFLICT`).
- Un contact externe n'apparaît pas dans les surfaces OWNER comme s'il avait un compte ; après rattachement confirmé, les biens/documents liés deviennent visibles avec leur état réel (sans accepter le mandat automatiquement).
- Approuver un `RENT_REDUCTION` met à jour `Lease.monthlyRent` et les `RentSchedule` PENDING concernées dans la même transaction, et crée un avenant (test).
- Approuver un `MAJOR_REPAIR` permet au ticket de passer en ASSIGNED. Avant approbation, la transition renvoie 409 `OWNER_APPROVAL_REQUIRED`.
- Chaque `MANDATE_ACTION_PENDING` produit une notification au propriétaire (11).
- Une approbation passe en EXPIRED après `approvalTtlDays`, et l'objet source revient à son état antérieur.
- Le paiement validé d'un loyer sous mandat à 8 % crée `RENT_IN +100 %` et `FEE −8 %` (test).
- La somme du ledger d'un mandat sur une période égale le « net » affiché dans le relevé PDF.
- Après `terminate`, l'agent assigné reçoit 403 sur le bien dès la date d'effet.

## Priorité
- **P0** : route de résiliation, effets réels des approbations, listener `MANDATE_ACTION_PENDING`, flux `RENT_REDUCTION`.
- **P1** : acceptation par l'agence, commissions, ledger, dépenses, relevés, pages mandats côté agent.
- **P2** : contre-proposition versionnée, signature électronique, renouvellement tacite, export CSV.

## Delta d'implémentation
| ID | Priorité | Delta | État |
|---|---|---|---|
| 03.1 | P0 | Compléter le cycle du mandat, ses autorisations, la résiliation et les effets transactionnels des approbations. | **Partiel.** Proposition, acceptation/refus, résiliation, expiration, affectation d'agent et contrôles d'accès existent. Les membres désactivés n'accèdent plus aux portefeuilles, détails, affectations, approbations, comptes de reversement ou exports financiers ; les rôles de gestion et agents affectés sont filtrés sur les surfaces sensibles. Courses accept/terminate couvertes (`mandate-lifecycle.spec.ts`) ; gaps restants (decline croisé, create concurrent, counter) listés dans [audit concurrence/idempotence](../qa/03-concurrency-idempotence-audit.md) (G-P0-3, G-P1-1, G-P1-5) — **non clos**. |
| 03.2 | P0 | Garantir que toute approbation validée applique son effet métier et que les transitions associées sont idempotentes et auditées. | **Partiel.** Décisions et effets sont transactionnels pour plusieurs actions (bail, loyer, réparation, prix/offre de vente, dépense) ; l'expiration des demandes est implémentée. Course APPROVE\|REJECT sur `RENT_REDUCTION` prouvée ; manquent courses EXPENSE/LEASE_SIGN, cancel∥decide et contrainte DB ledger — voir [audit](../qa/03-concurrency-idempotence-audit.md) (G-P0-1, G-P0-2, G-P1-2…G-P1-3) — **non clos**. |
| 03.3 | P1 | Finaliser commissions, ledger immuable, dépenses, reversements calculés et relevés propriétaires. | **Partiel.** Dépenses approuvées, écritures de paiement/remboursement, calcul de solde et relevés existent localement. Idempotence ledger **séquentielle** OK ; unicité sous concurrence absente (pas de `@@unique` sur `LedgerEntry`) — voir [audit](../qa/03-concurrency-idempotence-audit.md) (G-P0-1) ; commissions/rapprochement reversements réels restent à vérifier — **non clos**. |
| 03.4 | P2 | Ajouter contre-propositions versionnées, signature électronique, renouvellement tacite et export CSV. | **Partiel.** Avenants et prolongation de bail sont produits lors de certaines approbations. Contre-propositions versionnées, signature électronique du mandat, renouvellement tacite et export CSV restent à compléter/confirmer. |
| 03.5 | P1 | Fiabiliser et différencier les dashboards Owner, gérant d'agence et Agent à partir de données complètes, temporelles et scoped. | **Partiel côté UI.** Les vues Owner et Agent affichent des KPI et tableaux réels, mais les charts/sparklines sont construits à partir de listes limitées ou de valeurs répétées ; le dashboard gérant d'agence n'est pas distinct de celui Agent ; les erreurs de chargement partielles sont parfois converties en listes vides. Implémenter les agrégats complets, séparer les responsabilités gérant/agent et couvrir les états widgets. |
| 03.6 | P0 | Accès provisoire orthogonal au consentement ; mandats virtuels agence→propriétaire ; dépôt/revue documentaire hors plateforme ; refus/correction/révocation et clôture des engagements ; propriétaire via `AgencyClient`. | **À faire.** Contrat figé (cette section + ADR-0001) ; implémentation lots 3–4 du plan agency-clients. L'ancien critère « PROPOSED = aucun accès » est **retiré**. |

## Matrice rôle × action × état (clients / mandats / accès)

Légende : ✅ autorisé · ⛔ refusé · — non applicable. « Attente » = mandat `PROPOSED` ou revue initiale en cours. « Correction » = `NEEDS_CORRECTION`. « Après refus » = `DECLINED`, `REJECTED`, expiration ou révocation, accès provisoire révoqué et listing `PAUSED`.

| Action | ADMIN agence | AGENT assigné | OWNER (compte) | PLATFORM_ADMIN | Attente | Correction | Après refus |
|---|---|---|---|---|---|---|---|
| CRM créer / éditer / archiver / lier compte | ✅ | ⛔ | — | — (sauf résolution assistée) | ✅ | ✅ | ✅ (CRM inchangé) |
| CRM consulter / sélectionner pour un nouveau bien | ✅ | ✅ | — | — | ✅ | ✅ | ⛔ pour le bien concerné |
| Créer / modifier le bien concerné | ✅ | ✅ (assigné) | ✅ (ses biens) | — | ✅ provisoire | ✅ provisoire | ⛔ nouvelle opération |
| Publier / diffuser / réactiver le listing | ✅* | ✅* | ✅ | ✅ modération | ✅ provisoire | ⛔ ; listing `PAUSED` | ⛔ ; listing `PAUSED` |
| Visites, créneaux et gestion locative | ✅* | ✅* | selon bien | — | ✅ provisoire | ✅ (sans diffusion publique) | ⛔ nouveau ; clôture existante seulement |
| Honorer/transférer engagements déjà créés | ✅ accès borné | ✅ accès borné si assigné | ✅ | supervision/transfert selon 12 | selon objet | selon objet | ✅ accès de clôture borné |
| Approbations owner (bail, réparation seuil…) | demande | demande | décide | — | inchangé | inchangé | aucune nouvelle demande ; traiter celles déjà engagées selon leur état |
| Déposer / remplacer mandat papier | ✅ | ⛔ | — | — | ✅ | ✅ resoumission | nouveau dossier seulement |
| Accepter / refuser mandat virtuel | — | — | ✅ | — | décideur | — | refus terminal pour la proposition |
| Décider revue documentaire | ⛔ | ⛔ | — | ✅ | décideur | décideur | nouveau dossier si autorisé |
| Finance / reversements / ventes | permissions propres (non élargies par l'attente) | idem | idem | selon 12 | pas d'élargissement | pas d'élargissement | pas d'élargissement ; clôture des objets engagés seulement |

\* Sous appartenance ACTIVE, périmètre org/assignation et règles d'org APPROVED pour publication. Pendant l'attente initiale, listing `ACTIVE` et mandat non encore validé peuvent coexister ; ne pas étiqueter le mandat comme signé. En cas de correction ou de refus, la règle de pause s'applique. L'accès de clôture après refus est borné aux objets créés avant la décision, chaque action est auditée et le droit est retiré au transfert/clôture.
