export type SwitcherProps = {
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function Switcher({
  name,
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}: SwitcherProps): React.JSX.Element {
  return (
    <label
      className={[
        'inline-flex cursor-pointer items-center gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        className,
      ].join(' ')}
    >
      <input
        type="hidden"
        name={name}
        value={checked ? 'true' : 'false'}
      />
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={[
          'relative inline-block h-6 w-11 flex-shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      {label ? (
        <span className="text-sm text-foreground">{label}</span>
      ) : null}
    </label>
  );
}
