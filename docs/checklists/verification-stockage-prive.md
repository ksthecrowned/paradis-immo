# Checklist — validation du stockage privé

À exécuter après la migration des fichiers, sur un environnement de préproduction avant production. Ne pas inscrire de secrets, données personnelles ou URL signées dans les preuves conservées.

## 1. Configuration et prérequis

- [ ] Confirmer que `R2_PRIVATE_BUCKET` désigne un bucket différent de `R2_BUCKET`.
- [ ] Confirmer que l'accès public, le domaine public et toute publication automatique sont désactivés sur le bucket privé.
- [ ] Confirmer que l'API déployée utilise les identifiants R2 attendus et peut lire/écrire dans le bucket privé ; ne pas afficher ni copier les clés secrètes dans les logs.
- [ ] Confirmer que développement, préproduction et production utilisent chacun leurs propres base de données, buckets et identifiants.
- [ ] Confirmer qu'une sauvegarde récente de la base et des fichiers existe et que la procédure de restauration est connue.
- [ ] Vérifier que `bunx prisma migrate status` indique que le schéma est à jour.

## 2. Migration des références historiques

Depuis `apps/api`, après sauvegarde :

- [ ] Exécuter `bunx prisma migrate deploy` et vérifier qu'aucune migration n'échoue.
- [ ] Exécuter `bun run storage:migrate-documents` et conserver sa sortie (sans secrets).
- [ ] Vérifier que le script se termine avec le code 0, `skipped 0` et `unresolved missing public objects 0`.
- [ ] Vérifier que les références de documents de biens, locataires, baux, KYC, mandats, dépenses, relevés propriétaires, rapprochements, exports et quittances ont été prises en compte. Les références déjà privées doivent être comptées comme telles.
- [ ] Pour les quatre anciennes quittances recréées pendant la migration, vérifier dans l'application que les numéros et données du reçu sont cohérents avec les échéances et paiements enregistrés.
- [ ] Examiner chaque avertissement d'objet public conservé. Confirmer que la référence restante est légitime (média public ou pièce jointe de messagerie) et qu'elle n'expose pas un document privé.
- [ ] Si le script signale une référence ignorée ou un objet source manquant, arrêter le déploiement et résoudre le cas avant de poursuivre.
- [ ] Relancer une fois `bun run storage:migrate-documents` pour vérifier l'idempotence : aucune nouvelle copie/régénération, aucune référence non résolue et aucune erreur.

## 3. Vérifications de confidentialité R2

- [ ] Depuis une session déconnectée, essayer d'ouvrir directement l'URL publique ou l'URL R2 de chacun des échantillons de documents privés migrés : aucun contenu ne doit être servi.
- [ ] Vérifier qu'un média destiné à être public reste consultable depuis son URL publique.
- [ ] Vérifier qu'aucune réponse API de document privé ne contient une ancienne URL publique permanente ni une clé de bucket utilisable sans autorisation.
- [ ] Vérifier que les URL signées sont temporaires (durée configurée : cinq minutes), donnent accès au seul fichier demandé et cessent de fonctionner après expiration.
- [ ] Ne pas copier les URL signées dans les tickets, captures d'écran, journaux ou outils de suivi.

## 4. Contrôles d'accès aux téléchargements

Pour chaque catégorie de document privé et chaque type d'utilisateur pris en charge :

- [ ] Avec le compte autorisé lié au document, demander le téléchargement depuis l'API et vérifier que l'URL signée permet de lire le bon fichier.
- [ ] Répéter avec un compte non lié au document.
- [ ] Répéter avec un utilisateur d'une autre agence, d'un autre bail ou d'un autre dossier KYC.
- [ ] Vérifier que les deux derniers cas sont refusés (`403` ou `404` selon le contrat de l'API), sans URL signée ni fuite de métadonnées sensibles.
- [ ] Vérifier les rôles attendus séparément : locataire, propriétaire/agent autorisé, équipe KYC ou finance autorisée, selon le document.
- [ ] Vérifier qu'un utilisateur ne peut pas remplacer l'identifiant du document dans la requête pour obtenir celui d'un autre utilisateur ou d'une autre agence.

- Les quittances de loyer ont des routes dédiées : `GET /api/v1/leases/my/quittances` pour la liste du locataire, et `GET /api/v1/rent-schedules/:id/quittance` pour l'URL signée. Elles sont distinctes de `GET /api/v1/receipts/:id` et `GET /api/v1/payments/:paymentId/receipt`, qui concernent les reçus de paiement.

## 5. Parcours fonctionnels après déploiement API

- [ ] Créer ou utiliser un nouveau document privé de chaque type pris en charge ; vérifier son dépôt dans le bucket privé, sa référence en base et son téléchargement autorisé.
- [ ] Émettre une nouvelle quittance après paiement complet ; vérifier que son PDF est écrit dans le bucket privé et que le téléchargement autorisé fonctionne.
- [ ] Vérifier qu'une échéance partiellement payée ne produit pas de quittance.
- [ ] Vérifier qu'une quittance existante reste récupérable après un nouvel appel d'émission, sans nouveau numéro ni doublon.
- [ ] Simuler en préproduction un échec d'upload R2, puis son rétablissement ; vérifier que l'échec remonte clairement et que la reprise réutilise le même numéro et répare le PDF.
- [ ] Vérifier les journaux de déploiement et d'exécution : aucune donnée de document, URL signée, clé secrète ou donnée personnelle superflue n'y apparaît.

## 6. Décision de mise en production

- [ ] Confirmer qu'aucune erreur, référence privée non migrée ou exposition publique de document privé ne subsiste.
- [ ] Confirmer qu'une personne autorisée peut télécharger les documents requis et qu'un utilisateur hors périmètre en est systématiquement empêché.
- [ ] Enregistrer la date, l'environnement, les catégories testées, le résultat et les références non sensibles des cas de test.
- [ ] Ne promouvoir en production qu'après validation de tous les contrôles applicables.
