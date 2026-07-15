export type DateFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function DateField({
  invalid = false,
  className = '',
  ...rest
}: DateFieldProps): React.JSX.Element {
  return (
    <input
      type="date"
      className={[
        'block w-full rounded-lg border bg-search px-3 py-2.5 text-sm text-foreground',
        'focus:ring-2 focus:outline-none',
        invalid
          ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-input-border focus:border-input-focus-border focus:ring-accent/30',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
