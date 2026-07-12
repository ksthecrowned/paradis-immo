import {
  emptySeekerDraft,
  type SeekerExperience,
  type SeekerIntent,
  type SeekerSetupDraft,
} from '@/lib/seeker-setup';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SetupStepIndex = 0 | 1 | 2 | 3;

export const SETUP_STEP_COUNT = 4;

export const SETUP_STEP_META: Array<{
  index: SetupStepIndex;
  title: string;
  subtitle?: string;
}> = [
  { index: 0, title: 'Quel est votre objectif ?' },
  { index: 1, title: 'Où en êtes-vous dans votre recherche ?' },
  {
    index: 2,
    title: 'Activer la localisation ?',
    subtitle:
      'Pour afficher les biens près de vous et personnaliser la carte.',
  },
  {
    index: 3,
    title: 'Recevoir des notifications ?',
    subtitle:
      'Visites, paiements et rappels de loyer — vous pourrez changer d’avis plus tard.',
  },
];

type Ctx = {
  draft: SeekerSetupDraft;
  stepIndex: SetupStepIndex;
  isFirstStep: boolean;
  isLastStep: boolean;
  setIntent: (v: SeekerIntent | null) => void;
  setExperience: (v: SeekerExperience | null) => void;
  setBudget: (min: number | null, max: number | null) => void;
  setQuartiers: (ids: string[]) => void;
  goToStep: (step: SetupStepIndex) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
};

const SeekerSetupContext = createContext<Ctx | null>(null);

function clampStep(step: number): SetupStepIndex {
  if (step <= 0) return 0;
  if (step >= SETUP_STEP_COUNT - 1) return (SETUP_STEP_COUNT - 1) as SetupStepIndex;
  return step as SetupStepIndex;
}

export function SeekerSetupProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [draft, setDraft] = useState<SeekerSetupDraft>(emptySeekerDraft);
  const [stepIndex, setStepIndex] = useState<SetupStepIndex>(0);

  const goToStep = useCallback((step: SetupStepIndex): void => {
    setStepIndex(clampStep(step));
  }, []);

  const nextStep = useCallback((): void => {
    setStepIndex((current) => clampStep(current + 1));
  }, []);

  const prevStep = useCallback((): void => {
    setStepIndex((current) => clampStep(current - 1));
  }, []);

  const reset = useCallback((): void => {
    setDraft(emptySeekerDraft());
    setStepIndex(0);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      stepIndex,
      isFirstStep: stepIndex === 0,
      isLastStep: stepIndex === SETUP_STEP_COUNT - 1,
      setIntent: (intent) => setDraft((d) => ({ ...d, intent })),
      setExperience: (experience) => setDraft((d) => ({ ...d, experience })),
      setBudget: (budgetMinXaf, budgetMaxXaf) =>
        setDraft((d) => ({ ...d, budgetMinXaf, budgetMaxXaf })),
      setQuartiers: (preferredQuartierIds) =>
        setDraft((d) => ({
          ...d,
          preferredQuartierIds: preferredQuartierIds.slice(0, 3),
        })),
      goToStep,
      nextStep,
      prevStep,
      reset,
    }),
    [draft, stepIndex, goToStep, nextStep, prevStep, reset],
  );

  return (
    <SeekerSetupContext.Provider value={value}>
      {children}
    </SeekerSetupContext.Provider>
  );
}

export function useSeekerSetup(): Ctx {
  const ctx = useContext(SeekerSetupContext);
  if (!ctx) {
    throw new Error('useSeekerSetup must be used within SeekerSetupProvider');
  }
  return ctx;
}
