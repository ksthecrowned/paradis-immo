# Checklist — validation manuelle du parcours des visites

À exécuter en préproduction avec des comptes de test et des créneaux dédiés. Conserver les résultats et références non sensibles ; ne pas inclure de tokens, coordonnées réelles ou URL privées.

## Réservation et confirmation

- [ ] Réserver un créneau gratuit : la réservation apparaît comme `CONFIRMED` et le créneau est indisponible aux autres chercheurs.
- [ ] Faire deux réservations concurrentes sur un créneau payant : une seule réservation obtient le hold ; l'autre reçoit `SLOT_NOT_AVAILABLE`.
- [ ] Vérifier que le hold payant dure 15 minutes, qu'un paiement confirmé fixe la réservation, et qu'un hold expiré libère le créneau.
- [ ] Vérifier qu'une réservation impossible à persister n'abandonne pas le créneau en `HELD` ou `BOOKED`.
- [ ] Vérifier les notifications de hold et de confirmation reçues par le bon utilisateur.
- [ ] Affecter une visite à un agent actif de l'agence ; vérifier la notification d'affectation et que propriétaire/gestionnaire non autorisé ou agent d'une autre agence ne peut pas assigner.
- [ ] Vérifier que l'agent affecté peut retrouver la visite dans sa liste, la clôturer et saisir le compte rendu ; un autre agent de la même agence sans affectation ne doit pas accéder à cette visite, sauf droits de gestionnaire.
- [ ] Vérifier que l'agent affecté reçoit la confirmation si la réservation était déjà affectée, puis les rappels J-1/H-2. Vérifier qu'un redémarrage/rejeu du cron ne crée pas de doublon.

## Annulation, clôture et relance

- [ ] Annuler comme chercheur puis comme gestionnaire ; vérifier la libération du créneau et le pourcentage de remboursement retourné selon le délai. La réalisation effective du remboursement reste couverte par les contrôles de paiement (spec 05).
- [ ] Tenter de marquer une visite future comme effectuée ou absence : l'API doit refuser avec `VISIT_NOT_STARTED`.
- [ ] Sur une réservation commencée et confirmée, marquer « effectuée », puis vérifier le statut `COMPLETED` et la notification.
- [ ] Sur une autre réservation commencée et confirmée, marquer « absent », puis vérifier le statut `NO_SHOW` et la notification de gestion.
- [ ] Après une visite `COMPLETED`, enregistrer un compte rendu avec intérêt, notes, prochaine étape et date de relance ; vérifier qu'il est sauvegardé et modifiable par un gestionnaire autorisé.
- [ ] Tenter d'enregistrer un compte rendu avant clôture ou comme utilisateur hors périmètre ; vérifier le refus et l'absence d'écriture.
- [ ] Pour une réservation confirmée depuis plus de 24 h, attendre le cron (cycle de 15 minutes) ou préparer un cas d'essai en préproduction ; vérifier `COMPLETED_UNCONFIRMED` et la notification au propriétaire et à l'agent affecté.
- [ ] Vérifier qu'une réservation déjà clôturée n'est pas traitée ni notifiée une seconde fois par un cron ultérieur.
- [ ] Confirmer que la relance automatique est reçue par le propriétaire et l'agent affecté, sans doublon lorsque le même utilisateur remplit les deux rôles.

## Autorisations et cas négatifs

- [ ] Répéter les appels de clôture avec un utilisateur sans droits sur le bien : refus, sans changement d'état.
- [ ] Confirmer qu'un chercheur ne peut pas clôturer la réservation d'un autre utilisateur.
- [ ] Confirmer qu'un autre gestionnaire/agence ne peut pas modifier les visites hors de son périmètre.
- [ ] Vérifier que les erreurs de notification ou de base sont visibles dans la supervision et traitées selon la procédure d'incident.

## Compte rendu de vérification

- [ ] Noter date, environnement, version déployée, scénario, résultat et référence non sensible.
- [ ] Reporter tout écart dans la spec 06, sans le considérer comme validé sur la seule base des tests unitaires.
