# Court séjour — règles de séjour (P2-12 V1) — Design

> Statut : validé (brainstorming 3 sept. 2026). Phase marketplace P2-12, V1.
> Hors V1 : couchages / capacité, check-in opérationnel.

## Objectif

Compléter le parcours **RENT_SHORT** déjà couvert par `Booking` (dates,
prix/nuit, overlap) avec des **règles de séjour** au niveau du bien :
durée min/max et horaires check-in / check-out informatifs. La réservation
est **refusée** si la durée sort des bornes.

## Décisions produit

| Question | Décision |
|----------|----------|
| Scope V1 | Règles de séjour seulement |
| Capacité / couchages | **Hors scope** (surcharge inutile) |
| Check-in ops | **Hors scope** (phase ultérieure) |
| Stockage | Colonnes sur `Property` |
| `minNights` | Obligatoire si `mode = RENT_SHORT`, ≥ 1 |
| `maxNights` | Optionnel ; si présent ≥ `minNights` |
| `checkInTime` / `checkOutTime` | Optionnels, format `HH:mm`, **affichage seul** |
| Autres modes | Champs `null` ; ignorés à l’écriture |

## Parcours

1. Owner crée / édite un bien `RENT_SHORT` → saisit au moins `minNights` ;
   optionnellement `maxNights`, heures check-in/out.
2. Fiche publique / mobile affiche un bloc **Conditions** (nuits + horaires
   si renseignés).
3. Voyageur (ou owner) crée un `Booking` sur le calendrier existant.
4. API calcule `nights` (jours calendaires `endDate − startDate`, même
   convention que le pricing actuel) :
   - `nights < minNights` (défaut 1 si null legacy) → 400 `STAY_TOO_SHORT`
   - `maxNights` défini et `nights > maxNights` → 400 `STAY_TOO_LONG`
5. Horaires **ne** bloquent **pas** la réservation.

## Modèle de données

```prisma
model Property {
  // ... existing fields ...
  minNights     Int?     // required when mode = RENT_SHORT (app-level)
  maxNights     Int?
  checkInTime   String?  // "14:00"
  checkOutTime  String?  // "11:00"
}
```

### Migration

- Ajouter les 4 colonnes nullable.
- Backfill : `UPDATE "Property" SET "minNights" = 1 WHERE mode = 'RENT_SHORT' AND "minNights" IS NULL`.

### Règles d’écriture (create / update)

- Si `mode = RENT_SHORT` (après résolution create/update) :
  - `minNights` requis, entier ≥ 1 → sinon 400 `MIN_NIGHTS_REQUIRED` /
    `INVALID_MIN_NIGHTS`.
  - Si `maxNights` fourni : entier ≥ `minNights` → sinon 400
    `INVALID_MAX_NIGHTS`.
  - Si `checkInTime` / `checkOutTime` fournis : match `/^([01]\d|2[0-3]):[0-5]\d$/`
    → sinon 400 `INVALID_CHECK_TIME`.
- Si mode ≠ `RENT_SHORT` : forcer les 4 champs à `null` (clear on mode change).

## API

### Properties

- Étendre DTOs create/update + réponses publiques (`PublicProperty`) avec
  `minNights`, `maxNights`, `checkInTime`, `checkOutTime`.
- Pas de nouvel endpoint.

### Bookings

- `POST /bookings` : après contrôles mode / prix existants, appliquer
  `STAY_TOO_SHORT` / `STAY_TOO_LONG`.
- Réponses booking **inchangées** (pas besoin d’embarquer les règles ;
  le client les lit depuis le bien).

## Clients

### Web owner — add / edit property

- Si mode `RENT_SHORT` : champs **Nuits min** (requis), **Nuits max**
  (optionnel), **Check-in**, **Check-out** (time inputs ou texte `HH:mm`).
- Masquer / vider ces champs pour les autres modes.

### Fiche publique + mobile détail

- Bloc **Conditions** visible si `mode = RENT_SHORT` :
  - « Séjour min. X nuit(s) » · « max. Y nuits » si `maxNights`
  - « Arrivée à partir de HH:mm » / « Départ avant HH:mm » si présents

### Réservation (mobile book + owner create booking)

- Sur erreur API : messages FR
  - `STAY_TOO_SHORT` → « Séjour trop court (minimum X nuits) »
  - `STAY_TOO_LONG` → « Séjour trop long (maximum Y nuits) »
  - Préférer afficher X/Y depuis le bien déjà chargé (message local) ou
    depuis le body d’erreur si l’API inclut `minNights` / `maxNights` dans
    le payload d’erreur (recommandé).

## Droits

Inchangés : création/édition bien = owner/manager existant ; booking =
règles actuelles `BookingsService`.

## Hors scope

- Capacité / `maxGuests` / détail lits.
- Check-in opérationnel (instructions, code, statut « arrivé »).
- Règles au niveau organisation.
- Contrainte horaire sur le calendrier / fuseaux.
- Frais ménage / caution court séjour (déjà partiellement ailleurs si
  listing fees — ne pas lier ici).

## Tests (API)

- Create `RENT_SHORT` sans `minNights` → 400.
- Create `RENT_SHORT` avec `minNights: 2`, `maxNights: 1` → 400.
- Create `RENT_SHORT` avec `checkInTime: "25:00"` → 400.
- Create `RENT_LONG` ignore / nullifie les champs short-stay.
- Booking 1 nuit vs `minNights: 2` → `STAY_TOO_SHORT`.
- Booking 10 nuits vs `maxNights: 7` → `STAY_TOO_LONG`.
- Booking dans les bornes → 201 (comportement existant + overlap).
- Heures présentes n’affectent pas l’acceptation du booking.

## Roadmap TODOS

P2-12 V1 (cette spec) → P2-12.1 check-in ops (plus tard) → couchages si
besoin métier réaffirmé.
