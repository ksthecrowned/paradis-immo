# Fiche publique — confiance & contact (design)

Date : 2026-07-17
Statut : validé en brainstorm, en attente de plan d'implémentation

## Contexte

La fiche publique mobile affiche actuellement les informations principales du
bien et garde l'agent principalement dans la popup d'actions ("more"). Pour
renforcer la confiance et éviter de cacher les informations de contact, la
fiche doit afficher explicitement les détails de l'agence et de l'agent dans
le corps de page, tout en gardant le rappel agent dans la popup.

Ce sous-chantier est volontairement limité aux données déjà disponibles via
`GET /properties/:id` et aux enrichissements locaux existants (`getAgency`,
`getAgent`). Les profils agents enrichis côté API feront l'objet d'un
chantier séparé.

## Décisions

- Approche retenue : **UI seule + API existante**.
- La fiche publique affiche une section riche Agence + Agent.
- La popup "more" conserve l'agent existant et ajoute la date de dernière mise
  à jour en tête.
- Les champs absents sont masqués proprement, sans placeholder visible.
- Les données de spécialité, expérience, couleur/logo, note ou nombre d'avis
  peuvent venir des helpers locaux existants. Quand elles sont absentes, le
  composant garde une présentation compacte et crédible.

## Données

### Source API

`GET /properties/:id` fournit déjà :

- `organization` ou `ownerOrg` : `id`, `name`, `type`
- `agent` : `id`, `name`, `phone`
- `updatedAt`

### Données à mapper côté mobile

`mapPublicProperty` doit exposer sur `Property` :

- `updatedAt?: string`
- `agencyName?: string` déjà présent
- `agentName?: string`
- `agentPhone?: string | null`

Les informations enrichies suivantes restent optionnelles et viennent des
helpers locaux si disponibles :

- agence : couleur/logo, adresse, téléphone, note, nombre d'avis
- agent : avatar/initiales, rôle, spécialité, années d'expérience, nombre
  d'annonces

## UI mobile

### Placement

Dans `PropertyDetailBody`, ajouter une section contact après "Détails du bien"
et avant "Voisinage".

### Nouveau composant

Créer un composant dédié :

`apps/mobile/components/property/detail/PropertyDetailContact.tsx`

Responsabilité : afficher deux cartes dans une même section :

1. **Agence**
2. **Agent**

### Carte Agence

Afficher si une agence est disponible :

- pastille logo/couleur
- nom de l'agence
- lien vers `/agency/:id`
- adresse si disponible
- téléphone si disponible, avec action `tel:`
- note et nombre d'avis si disponibles

Les champs absents sont omis.

### Carte Agent

Afficher si un agent ou un fallback agent est disponible :

- avatar/initiales
- nom
- rôle
- spécialité + années d'expérience si disponibles
- téléphone si disponible, avec action `tel:`
- nombre d'annonces si disponible
- ligne discrète : `Mis à jour le <date>`

La date utilise `updatedAt`, formatée en français court (ex. `15 juil. 2026`).

### Popup "more"

Dans `PropertyDetailActionsSheet` :

- ajouter `Mis à jour le <date>` au-dessus du bloc agent
- conserver le bloc `AgentRow` existant
- ne pas déplacer les actions existantes

## Fichiers touchés

| Zone | Fichiers |
|---|---|
| Mobile types | `apps/mobile/types/property.ts` |
| Mobile mapping | `apps/mobile/lib/map-property.ts` |
| Mobile fiche | `apps/mobile/components/property/detail/PropertyDetailBody.tsx` |
| Mobile nouveau composant | `apps/mobile/components/property/detail/PropertyDetailContact.tsx` |
| Mobile popup | `apps/mobile/components/property/detail/PropertyDetailActionsSheet.tsx` |
| Mobile écran | `apps/mobile/app/property/[id]/index.tsx` |

## Tests & vérification

- Typecheck mobile : `cd apps/mobile && bunx tsc --noEmit`
- Fiche publique avec agent complet : carte agence + carte agent affichées
- Fiche publique avec agent partiel : champs absents masqués, pas de `—`
- Popup "more" : date de mise à jour visible au-dessus de l'agent
- Actions existantes : appeler agent/agence, favori, partage et CTA restent
  fonctionnels

## Hors scope

- Ajout de colonnes API pour spécialité agent / années d'expérience
- Calcul fiable du nombre d'annonces agent côté API
- Reviews réelles agence/agent
- Signalement, vues, favoris actifs, frais listing et Reels
