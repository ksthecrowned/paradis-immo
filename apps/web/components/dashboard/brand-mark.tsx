export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="size-8 shrink-0 rounded-full shadow-sm"
        style={{
          background:
            'conic-gradient(from 210deg, #6658dd 0deg, #22c997 90deg, #f5a623 180deg, #ef4444 270deg, #6658dd 360deg)',
        }}
        aria-hidden
      />
      {!compact ? (
        <span className="text-[17px] font-bold tracking-tight text-foreground">
          Paradis Immo
        </span>
      ) : null}
    </div>
  );
}
