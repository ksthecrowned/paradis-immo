import {
  emptySeekerDraft,
  type SeekerExperience,
  type SeekerIntent,
  type SeekerSetupDraft,
} from '@/lib/seeker-setup';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Ctx = {
  draft: SeekerSetupDraft;
  setIntent: (v: SeekerIntent | null) => void;
  setExperience: (v: SeekerExperience | null) => void;
  setBudget: (min: number | null, max: number | null) => void;
  setQuartiers: (ids: string[]) => void;
  reset: () => void;
};

const SeekerSetupContext = createContext<Ctx | null>(null);

export function SeekerSetupProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [draft, setDraft] = useState<SeekerSetupDraft>(emptySeekerDraft);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      setIntent: (intent) => setDraft((d) => ({ ...d, intent })),
      setExperience: (experience) => setDraft((d) => ({ ...d, experience })),
      setBudget: (budgetMinXaf, budgetMaxXaf) =>
        setDraft((d) => ({ ...d, budgetMinXaf, budgetMaxXaf })),
      setQuartiers: (preferredQuartierIds) =>
        setDraft((d) => ({
          ...d,
          preferredQuartierIds: preferredQuartierIds.slice(0, 3),
        })),
      reset: () => setDraft(emptySeekerDraft()),
    }),
    [draft],
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
