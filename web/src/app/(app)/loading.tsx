/** Sofortiges Feedback bei Client-Navigation, bis RSC + Layout fertig sind (Skeleton entspricht grob der App-Shell). */
export default function AppSegmentLoading() {
  return (
    <div
      className="hs-app grid min-h-screen grid-cols-[232px_minmax(0,1fr)] bg-[var(--bg)]"
      aria-busy="true"
      aria-label="Seite wird geladen"
    >
      <aside
        className="hs-side w-[232px] max-w-[232px] shrink-0 animate-pulse border-r border-[var(--border)]/40 bg-[var(--surface-2)]/70"
        aria-hidden
      />
      <main className="min-h-0 min-w-0 p-6 md:px-8 md:pb-14 md:pt-8">
        <div className="mx-auto max-w-[1680px] space-y-4">
          <div className="h-9 max-w-md animate-pulse rounded-lg bg-[var(--surface-2)]" />
          <div className="h-4 max-w-2xl animate-pulse rounded bg-[var(--hover)]/50" />
          <div className="h-4 max-w-xl animate-pulse rounded bg-[var(--hover)]/40" />
          <div className="mt-8 min-h-[240px] animate-pulse rounded-2xl bg-[var(--surface-2)]/60" />
        </div>
      </main>
    </div>
  );
}
