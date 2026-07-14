# Refactor design — Dashboard Owner (formulaires + pages détails)

**Date** : 2026-07-14
**Statut** : Brouillon — en attente de revue utilisateur
**Auteur** : Claude
**Périmètre** : Dashboard Owner (apps/web/app/owner/**)
**Hors scope** : Dashboard Admin, Dashboard Agent, app Mobile, API

---

## 1. Contexte et problème

Le dashboard Owner a atteint un stade où :

1. **Les formulaires sont visuellement vieillissants et incohérents** : couleurs dures, pas d'arrondis harmonieux, pas d'espacement régulier, hiérarchie typographique faible.
2. **Les pages détails mélangent affichage read-only et édition inline** dans un même composant (ex: `owner-property-detail.tsx` fait 350+ lignes avec un `editing` toggle, ce qui rend la lecture difficile et le code fragile).
3. **Le code est dupliqué** : `inputClass`/`labelClass` recopiés dans chaque page formulaire, pas de design system partagé.
4. **Les composants partagés existants sont sous-utilisés** : `components/dashboard/` contient déjà `page-header`, `stat-card`, `data-table`, mais aucun composant Form ou Detail réutilisable.

**Inspiration** : TimeGate dashboard (D:\TimeGate\dashboard) — utilise Preline + Tailwind 4 avec un pattern propre `FormCard` / `DetailCard` / `FormField`, ainsi que l'app mobile Paradis Immo (apps/mobile) qui a des arrondis généreux et un design system dark/light bien défini.

**Source de vérité structurelle** : les 4 captures d'écran fournies (`C:\Users\pc\Pictures\Screenshots\Capture d'écran 2026-07-13 232051.png` et 2026-07-14 084339/084349/084418.png) — définissent le layout cible (header + sections groupées, footer avec actions, onglets, champs alignés).

**Source de vérité stylistique** : app mobile Paradis Immo (couleurs, arrondis, typographie).

## 2. Objectifs et non-objectifs

### 2.1 Objectifs

- Créer un **design system partagé** pour les formulaires et pages détails du dashboard Owner
- **Migrer toutes les entités Owner** vers ce design system (Propriétés, Visites, Baux, Maintenance, Paiements, Mandat, Bookings, Dashboard)
- **Séparer la lecture (page détail) de l'édition (page edit dédiée)** pour réduire la complexité
- **Aligner le style web avec l'app mobile** (mêmes couleurs primary `#7065F0`, rayons, dark/light)
- **Garder 100% des fonctionnalités existantes** (pas de régression)
- Supporter le **dark mode par défaut, light opt-in** (suit la préférence système)

### 2.2 Non-objectifs

- Pas de refactor des dashboards Admin ou Agent (sprint ultérieur)
- Pas de refactor de l'app Mobile (déjà OK)
- Pas de changement d'API / backend
- Pas de nouvelle feature fonctionnelle
- Pas de migration vers un nouveau framework UI (on garde Preline + Tailwind 4)

## 3. Décisions de design

### 3.1 Stack technique

| Choix | Valeur | Raison |
|-------|--------|--------|
| Framework UI | **Preline 4.1** (déjà installé) | Style moderne, déjà intégré via `preline-boot.tsx` |
| CSS | **Tailwind 4** (déjà installé) | Variables CSS custom, alignement avec mobile |
| Icônes | **lucide-react** | Cohérent avec mobile |
| Formulaires | **Custom natif** (useState) | Pattern TimeGate, contrôle total |
| Validation | **Custom native** (helpers) | Pas de dépendance, suffisant |
| Layout longs | **Onglets (FormTabs)** | Préférence utilisateur, scale bien |
| Soumission | **Pages new + edit dédiées** | Pas d'édition inline, plus simple |
| Thème | **Suit préférence système** | UX naturelle |

### 3.2 Structure des dossiers

```
apps/web/
  components/
    dashboard/                  # existant — composants transverses
      shell.tsx, sidebar-nav.tsx, page-header.tsx, data-table.tsx, ...  # gardés
    forms/                      # NOUVEAU — design system formulaires
      FormCard.tsx
      FormField.tsx             # Input, Textarea, Select, NumberInput, Switcher, DateField
      FormTabs.tsx
      FormStepper.tsx
      FormFooter.tsx
      ApiErrorBanner.tsx
      FileUpload.tsx
      Gallery.tsx
      SelectSearch.tsx
      index.ts                  # barrel
    detail/                     # NOUVEAU — design system pages détails
      DetailCard.tsx
      DetailRow.tsx
      DetailHeader.tsx
      DetailSection.tsx
      index.ts
    primitives/                 # NOUVEAU — wrappers Preline génériques
      Button.tsx
      Card.tsx
      index.ts
    owner/                      # existant
      property-media-uploader.tsx  # refactorisé en <FileUpload/> + <Gallery/>

  app/owner/
    properties/
      page.tsx                  # liste (refactor)
      [id]/page.tsx             # détail (refactor)
      [id]/edit/page.tsx        # NOUVEAU — édition dédiée
      add/page.tsx              # création (refactor)
      owner-properties.tsx      # liste (refactor)
      owner-property-form.tsx   # formulaire partagé
      [id]/owner-property-detail.tsx  # SUPPRIMÉ après migration
    visits/, leases/, maintenance/, payments/, mandate/, bookings/, dashboard/  # idem

  hooks/
    use-resource-form.ts        # NOUVEAU
    use-resource-detail.ts      # NOUVEAU
    use-require-session.ts      # existant (gardé)

  lib/
    owner/                      # existant (lib API)
    validation/                 # NOUVEAU
      required.ts, numeric.ts, currency.ts, date.ts, email.ts, phone.ts
      index.ts
```

### 3.3 Tokens visuels (existants, à respecter)

- **Primary** : `#7065F0` (variable CSS `--accent`, alias Tailwind `bg-accent`)
- **Primary hover** : `#5A50D6`
- **Primary soft** : `rgba(112, 101, 240, 0.15)`
- **Sémantiques** : `success` (`#22c997` dark / `#1abc9c` light), `warning` (`#f5a623`), `danger` (`#ef4444` dark / `#f1556c` light)
- **Surfaces** : `card`, `card-hover`, `border`, `search`, `topbar`, `sidebar`, `background`
- **Texte** : `foreground` (principal), `muted` (secondaire), `heading` (titres), `active` (état)
- **Police** : Poppins (déjà chargée)
- **Radii** : `rounded-lg` (8px) / `rounded-xl` (12px) / `rounded-2xl` (16px) / `rounded-full`
- **Ombres** : douces, inspirées mobile (`shadows.card` dans theme.ts mobile)

### 3.4 Pattern d'un formulaire (exemple : création de propriété)

```tsx
// app/owner/properties/add/page.tsx
'use client';
import { OwnerPropertyForm } from '../owner-property-form';
import { createProperty } from '@/lib/owner/properties';
import { useRouter } from 'next/navigation';

export default function NewPropertyPage() {
  const router = useRouter();
  return (
    <OwnerPropertyForm
      submitLabel="Créer le bien"
      onCancel={() => router.back()}
      onSubmit={async (values) => {
        const created = await createProperty(values);
        router.push(`/owner/properties/${created.id}`);
      }}
    />
  );
}
```

```tsx
// app/owner/properties/owner-property-form.tsx
'use client';
import { FormCard, FormTabs, FormFooter, ApiErrorBanner } from '@/components/forms';
import { useResourceForm } from '@/hooks/use-resource-form';

export function OwnerPropertyForm({ initial, onSubmit, onCancel, submitLabel }) {
  const form = useResourceForm({
    initial: initial ?? defaultPropertyValues,
    validate: validateProperty,
    onSubmit,
  });

  return (
    <FormCard title="Bien immobilier" hint="...">
      <ApiErrorBanner message={form.submitError} />

      <FormTabs
        tabs={[
          { id: 'general',   label: 'Général',       content: <GeneralTab   form={form} /> },
          { id: 'location',  label: 'Localisation',  content: <LocationTab  form={form} /> },
          { id: 'visit',     label: 'Visite',        content: <VisitTab     form={form} /> },
          { id: 'media',     label: 'Médias',        content: <MediaTab     form={form} /> },
        ]}
      />

      <FormFooter
        saving={form.saving}
        submitLabel={submitLabel}
        onCancel={onCancel}
      />
    </FormCard>
  );
}
```

### 3.5 Pattern d'une page détail (read-only)

```tsx
// app/owner/properties/[id]/page.tsx
'use client';
import { DetailHeader, DetailCard, DetailRow, DetailSection } from '@/components/detail';
import { StatusBadge } from '@/components/dashboard';
import { useResourceDetail } from '@/hooks/use-resource-detail';
import { getProperty, archiveProperty, publishProperty, pauseProperty } from '@/lib/owner/properties';
import Link from 'next/link';

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { data: property, loading, error, reload } = useResourceDetail(
    () => getProperty(params.id)
  );

  if (loading) return <Skeleton />;
  if (error) return <ApiErrorBanner message={error} />;
  if (!property) return null;

  return (
    <div className="space-y-6">
      <DetailHeader
        title={property.title}
        subtitle={`${propertyTypeLabel(property.type)} · ${propertyModeLabel(property.mode)}`}
        meta={propertyStatusLabel(property.status)}
        avatar={property.coverImage}
        actions={
          <>
            <Link href={`/owner/properties/${property.id}/edit`} className="btn-primary">
              Modifier
            </Link>
            <ActionMenu onArchive={...} onPause={...} onPublish={...} />
          </>
        }
      />

      <DetailSection>
        <DetailCard title="Informations générales">
          <DetailRow label="Description" value={property.description} />
          <DetailRow label="Prix" value={formatPropertyPrice(property)} />
          <DetailRow label="Chambres" value={property.bedrooms ?? '—'} />
          <DetailRow label="Salles de bain" value={property.bathrooms ?? '—'} />
          <DetailRow label="Surface" value={property.surface ? `${property.surface} m²` : '—'} />
        </DetailCard>

        <DetailCard title="Localisation">
          <DetailRow label="Adresse" value={property.address} />
          <DetailRow label="Ville" value={property.city.name} />
          <DetailRow label="Quartier" value={property.quartier.name} />
        </DetailCard>
      </DetailSection>

      <DetailCard title="Visite">
        <DetailRow label="Visite activée" value={property.visitEnabled ? 'Oui' : 'Non'} />
        {property.visitEnabled && (
          <>
            <DetailRow label="Type" value={property.visitType} />
            <DetailRow label="Durée" value={`${property.visitDuration} min`} />
            <DetailRow label="Tarif" value={property.visitPrice ? `${property.visitPrice} XAF` : 'Gratuit'} />
          </>
        )}
      </DetailCard>

      <DetailCard title="Médias">
        <Gallery items={property.media} />
      </DetailCard>
    </div>
  );
}
```

### 3.6 Composants partagés à créer

| Composant | Rôle | Inspiré de |
|-----------|------|------------|
| `FormCard` | Carte avec `border-t-4 border-t-primary`, header titre + hint, body, footer | TimeGate `FormCard` |
| `FormField` | Label + Input + erreur, prop `required` | TimeGate `FormField` |
| `FormTabs` | Onglets Preline (1 onglet / section) | TimeGate `FormTabs` |
| `FormStepper` | Stepper horizontal numéroté (optionnel, formulaires > 4 sections) | Mobile booking flow |
| `FormFooter` | Boutons Enregistrer / Annuler + état saving | TimeGate `ActionButtons` |
| `ApiErrorBanner` | Bandeau rouge | TimeGate `ApiErrorBanner` |
| `DetailCard` | Carte pour pages détails | TimeGate `DetailCard` |
| `DetailRow` | Ligne label/valeur | TimeGate `DetailRow` |
| `DetailHeader` | Photo + nom + actions | TimeGate `ResourceProfileHeader` |
| `DetailSection` | Grille 2 colonnes de DetailCard | TimeGate (grille manuelle) |
| `SelectSearch` | Select avec recherche | TimeGate `SelectSearch` |
| `DateField` | Input date stylé | TimeGate `DateField` |
| `Switcher` | Toggle Preline | TimeGate `Switcher` |
| `NumberInput` | Input numérique | TimeGate `NumberInput` |
| `FileUpload` | Dropzone Preline | Mobile `FileUpload` |
| `Gallery` | Visualiseur de médias | Mobile `Gallery` |
| `Button` | Wrapper bouton Preline | — |
| `Card` | Wrapper card Preline | — |

### 3.7 Hooks

**`useResourceForm<T>`** (dans `hooks/use-resource-form.ts`) :

```ts
type UseResourceFormOptions<T> = {
  initial: T;
  onSubmit: (values: T) => Promise<void>;
  validate?: (values: T) => Record<string, string>;
};

type UseResourceFormResult<T> = {
  values: T;
  errors: Record<string, string>;
  saving: boolean;
  submitError: string | null;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setValues: (values: T) => void;
  handleSubmit: (e: FormEvent) => Promise<void>;
  reset: () => void;
};
```

Comportement :
- `setField` efface l'erreur du champ touché
- `handleSubmit` valide, bloque si erreurs, catch les `ApiError`
- `setValues` permet d'initialiser depuis le serveur (edit page)

**`useResourceDetail<T>`** (dans `hooks/use-resource-detail.ts`) :

```ts
function useResourceDetail<T>(loader: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (data: T) => void;
};
```

### 3.8 Helpers de validation

Dans `lib/validation/` :
- `required(value, label?)` → erreur si vide
- `minLength(value, n)`, `maxLength(value, n)`
- `numeric(value, opts: { min?, max? })` → parse + check
- `positiveNumber(value)`
- `currency(value)` → format XAF/EUR/USD
- `date(value)`, `dateAfter(startKey, endKey, values)`
- `email(value)`, `phone(value)`

Chaque helper retourne un `string | null` (null = valide).

**Pas de framework de validation** (Zod, Yup). Suffisant pour les besoins actuels.

## 4. Plan de migration par entité

### 4.1 Ordre d'attaque

1. **Propriétés** (entité la plus riche — vitrine du design system)
2. **Visites & créneaux** (déjà bien avancé, plus simple)
3. **Baux (leases)** (formulaire complexe, bon test des onglets)
4. **Maintenance** (formulaire moyen)
5. **Paiements** (lecture seule principalement)
6. **Mandat** (lecture seule)
7. **Bookings** (formulaire moyen)
8. **Dashboard** (refactor stats, KPIs)

### 4.2 Étapes par entité (template)

1. **Étape 0 — Préparation** (uniquement pour la première entité)
   - Créer `hooks/use-resource-form.ts`
   - Créer `hooks/use-resource-detail.ts`
   - Créer `lib/validation/` + helpers
   - Créer `components/forms/` (FormCard, FormField, FormTabs, FormFooter, ApiErrorBanner)
   - Créer `components/detail/` (DetailCard, DetailRow, DetailHeader, DetailSection)
   - Créer `components/primitives/` (Button, Card)
   - Créer composants spécialisés communs (SelectSearch, DateField, Switcher, NumberInput, FileUpload, Gallery)

2. **Étape 1 — Migration du formulaire**
   - Créer `<EntityName>Form` (composant partagé entre add et edit)
   - Refactor `add/page.tsx` pour utiliser le nouveau formulaire
   - Créer `[id]/edit/page.tsx` (nouvelle page édition)
   - Supprimer l'édition inline de la page détail
   - Vérifier que toutes les fonctionnalités sont préservées

3. **Étape 2 — Migration de la page détail**
   - Refactor `[id]/page.tsx` pour utiliser DetailCard/DetailRow/DetailHeader
   - Garder les actions (publier/pauser/archiver) dans le header
   - Garder le lien "Modifier" vers `/[id]/edit`

4. **Étape 3 — Migration de la liste**
   - Refactor `page.tsx` (liste) pour utiliser le nouveau design
   - Uniformiser le bouton "Ajouter"
   - Garder la pagination / filtres existants

5. **Étape 4 — Nettoyage**
   - Supprimer `[id]/owner-property-detail.tsx` (ancien composant inline)
   - Supprimer code mort (édition inline, états inutilisés)

6. **Étape 5 — Vérification**
   - Tests visuels (dark + light)
   - Tests fonctionnels (créer / éditer / supprimer / publier / pauser)
   - Validation utilisateur

### 4.3 Critères de "validé" pour une entité

- ✅ Page de liste lisible, design cohérent
- ✅ Page de création (`add`) avec onglets, design cohérent
- ✅ Page d'édition (`[id]/edit`) avec onglets, design cohérent
- ✅ Page de détail (`[id]`) read-only, sections groupées, header avec actions
- ✅ Médias fonctionnels (FileUpload + Gallery)
- ✅ Dark mode OK
- ✅ Pas de régression : mêmes fonctionnalités qu'avant
- ✅ Validation manuelle par navigation

## 5. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Régression fonctionnelle pendant la migration | Élevé | Refactor par entité, pas de "big bang" ; tests visuels à chaque étape |
| Incohérence visuelle entre entités | Moyen | Design system partagé + composants centralisés |
| Fuite de mémoire dans FileUpload | Faible | Cleanup dans useEffect |
| Performance si trop d'onglets | Faible | Lazy-load contenu onglets non actif |
| Validation client insuffisante | Moyen | Double validation (client + serveur déjà OK) |
| Ancien code mort qui traîne | Faible | Suppression explicite à l'étape 4 |

## 6. Alternatives considérées

| Alternative | Pourquoi écartée |
|-------------|------------------|
| Refactor par couche (data → forms → details) | Plus complexe à coordonner, pas de valeur visuelle incrémentale |
| Design system complet d'abord puis refactor en bloc | Risque de désalignement avec la réalité, pas de validation incrémentale |
| shadcn/ui | Préférence utilisateur pour Preline (cohérence avec TimeGate et mobile) |
| React Hook Form + Zod | Préférence utilisateur pour custom (style TimeGate) |
| Édition inline sur page détail | Plus complexe, risque de perte de données, page surchargée |
| Wizard avec steps au lieu d'onglets | Préférence utilisateur pour les onglets, plus simple |

## 7. Hors scope explicite

- Dashboards Admin et Agent (refactor ultérieur avec le même design system)
- App Mobile (déjà OK)
- Backend / API
- Internationalisation (on garde le français)
- Authentification / autorisation
- Tests unitaires automatisés (pas demandés — vérification manuelle)

## 8. Fichiers de référence

- **Captures écran** (source de vérité structurelle) :
  - `C:\Users\pc\Pictures\Screenshots\Capture d'écran 2026-07-13 232051.png`
  - `C:\Users\pc\Pictures\Screenshots\Capture d'écran 2026-07-14 084339.png`
  - `C:\Users\pc\Pictures\Screenshots\Capture d'écran 2026-07-14 084349.png`
  - `C:\Users\pc\Pictures\Screenshots\Capture d'écran 2026-07-14 084418.png`
- **Inspiration TimeGate** : `D:\TimeGate\dashboard\components\timegate\ui.tsx`, `D:\TimeGate\dashboard\components\ui\FormField.tsx`, `D:\TimeGate\dashboard\components\timegate\EmployeeForm.tsx`
- **Inspiration Mobile** : `apps\mobile\constants\theme.ts` (couleurs, radii, shadows)
- **Code actuel à refactor** :
  - `apps\web\app\owner\properties\owner-property-form.tsx`
  - `apps\web\app\owner\properties\[id]\owner-property-detail.tsx`
  - Idem pour les autres entités
