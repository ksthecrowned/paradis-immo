import Image from 'next/image';

export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/landing/logo.png"
        alt=""
        width={42}
        height={42}
        className="shrink-0"
        style={{ width: 42, height: 42 }}
        priority
      />
      {!compact ? (
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          Paradis Immo
        </span>
      ) : null}
    </div>
  );
}
