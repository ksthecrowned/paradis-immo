import { Icon } from '@iconify/react';

export type FormStepperStep = {
  id: string;
  label: string;
};

export type FormStepperProps = {
  steps: FormStepperStep[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
};

export function FormStepper({
  steps,
  currentStep,
  onStepClick,
}: FormStepperProps): React.JSX.Element {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return (
    <ol className="flex w-full items-center gap-2 overflow-x-auto py-2">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isActive = index === currentIndex;
        const handleClick = () => {
          if (index <= currentIndex) onStepClick?.(step.id);
        };
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={handleClick}
              disabled={index > currentIndex}
              className={[
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-white'
                  : isComplete
                    ? 'bg-accent/15 text-accent'
                    : 'bg-card-hover text-muted',
                index > currentIndex ? 'cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                {isComplete ? (
                  <Icon icon="mdi:check" className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <div
                aria-hidden
                className={[
                  'h-px flex-1',
                  isComplete ? 'bg-accent/50' : 'bg-border',
                ].join(' ')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
