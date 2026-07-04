export function DashboardDecorations(): React.JSX.Element {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden"
      aria-hidden
    >
      <div className="absolute start-1/3 top-4 h-px w-32 -rotate-[35deg] bg-gradient-to-r from-transparent via-sky-400/70 to-transparent blur-[0.5px]" />
      <div className="absolute start-1/2 top-8 h-px w-24 -rotate-[30deg] bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
      <div className="absolute end-1/4 top-2 h-px w-20 -rotate-[40deg] bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
    </div>
  );
}
