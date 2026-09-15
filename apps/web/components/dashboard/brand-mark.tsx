export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="size-8 shrink-0 rounded-full shadow-sm"
        style={{
          background:
            'conic-gradient(from 210deg, #d6b77c 0deg, #8fa9b8 90deg, #f1e6d0 180deg, #171c21 270deg, #d6b77c 360deg)',
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
