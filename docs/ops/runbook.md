# Runbook de développement et d'exploitation

## Prérequis de développement

- Node.js 18 ou supérieur.
- Bun (versions applicatives indiquées dans les `package.json`) et/ou pnpm selon les scripts racine.
- PostgreSQL ; `docker-compose.yml` fournit PostgreSQL 16 pour le développement local.
- Variables locales dérivées des fichiers `.env.example` applicables. Ne jamais copier des secrets de production.

## Démarrage local

Depuis la racine :

```powershell
docker compose up -d postgres
pnpm install
```

Configurer les variables de l'API et des clients, puis préparer le schéma selon `apps/api/package.json` et le README racine. Pour l'API, le README documente les commandes `prisma:generate`, `prisma:migrate`, `prisma:seed` et `start:dev`. Le seed ne doit être exécuté que sur une base locale dédiée.

Services locaux usuels :

| Service | URL |
|---|---|
| Web | `http://localhost:3000` |
| API | `http://localhost:3001/api/v1` |
| Health | `http://localhost:3001/health` |
| Swagger | `http://localhost:3001/api/v1/docs` |
| PostgreSQL | `localhost:5432` |

Pour le mobile, définir `EXPO_PUBLIC_API_URL` selon le réseau de l'émulateur ou du terminal ; `localhost` dans un appareil n'est pas l'hôte du poste.

## Configuration

- API : `.env.example` racine et/ou `apps/api/.env.example` ; vérifier dans le code quelle configuration est effectivement chargée.
- Web : `apps/web/.env.example` s'il est présent, notamment URL API et configuration Auth.js.
- Mobile : `apps/mobile/.env.example`, notamment l'URL API.
- R2, OTP, push et prestataires de paiement sont optionnels localement selon la fonctionnalité ; les stubs/sandbox ne doivent pas être présentés comme validation réelle.

La valeur d'une variable ne doit jamais être copiée dans une issue ou un document. En cas de rotation, suivre le processus du fournisseur et invalider les credentials compromis.

## Vérifications de base

```powershell
pnpm build
pnpm test
pnpm lint
```

Vérifier les commandes disponibles avant usage dans les manifests concernés. Un résultat de build/test local ne prouve ni le déploiement correct, ni les callbacks fournisseurs, ni les autorisations sur l'environnement réel.

## Déploiement

Le manifeste `render.yaml` décrit le service API Render et `vercel` est présent dans le dépôt pour le web. Avant toute release :

1. Identifier le commit et l'environnement cible ; confirmer que ce n'est pas la production par erreur.
2. Vérifier la compatibilité des migrations, sauvegarde et plan de rollback.
3. Vérifier les variables attendues depuis les manifests et la validation runtime, sans les imprimer.
4. Déployer les composants dans l'ordre compatible avec les contrats API.
5. Vérifier health, logs expurgés, parcours de smoke et version réellement déployée.
6. En cas de régression, désactiver le parcours ou l'intégration affectée si possible et suivre le plan de rollback du responsable.

Ne pas exécuter `migrate deploy`, scripts de migration de fichiers, seeds, paiements réels ou suppressions de données sur la production sans approbation, sauvegarde vérifiée et fenêtre d'intervention.

### URL publiques déclarées aux stores

| URL | Usage |
|---|---|
| `https://<domaine>/privacy` | Politique de confidentialité (fiche Google Play / App Store). |
| `https://<domaine>/account/delete` | Suppression de compte exigée par Google Play : page accessible sans l'application, atteinte depuis le footer du site et depuis la section « Vos droits » de la politique de confidentialité. |
| `https://<domaine>/account/cancel-deletion` | Annulation d'une suppression en cours (compte `DELETED`, écran affiché automatiquement après connexion). |

Vérifier ces trois URL sur l'environnement publié avant de les renseigner dans la console du store : une page non déployée ou protégée par authentification ne satisfait pas l'exigence.

## Diagnostic rapide

| Symptôme | Vérifier |
|---|---|
| API inaccessible | `GET /health`, logs API, port, URL API, CORS et disponibilité DB |
| Web/mobile voit une erreur 401 | Expiration/session, refresh, heure appareil, URL API et statut compte ; ne jamais demander un token en clair |
| Liste vide inattendue | Distinguer erreur réseau, permission refusée, pagination, filtre et absence réelle |
| Upload échoue | Configuration bucket, clés de presign, limites de taille, type de média et accès réseau |
| Paiement en attente | État serveur et référence fournisseur dans l'environnement sandbox ; ne pas marquer payé manuellement sans procédure autorisée |
| Notification manquante | Événement produit, handler, token appareil, permission système, fournisseur et logs expurgés |

## Incident et reprise

- Protéger les personnes et les fonds d'abord : suspendre les mutations ou moyens de paiement concernés lorsque le responsable l'autorise.
- Préserver les identifiants d'incident, request IDs, timestamps, versions et références non sensibles.
- Ne pas inclure payloads, numéros complets, documents, jetons ou clés dans les logs de diagnostic.
- Réconcilier les paiements et écritures avant une reprise de traitement ; toute relance doit être idempotente.
- Documenter l'impact, les données touchées, l'atténuation, la résolution et les actions préventives.

Les procédures de sauvegarde/restauration et de stockage privé doivent être approuvées et répétées dans un environnement isolé avant lancement ; voir la spec 16 et `docs/checklists/`.
