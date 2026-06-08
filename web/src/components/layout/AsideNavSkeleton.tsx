/** Platzhalter-Sidebar während AppSidebarLoader lädt (Suspense fallback). */
export function AsideNavSkeleton() {
  return (
    <aside
      className="hs-side w-[232px] max-w-[232px] shrink-0 animate-pulse border-r border-[var(--border)]/40 bg-[var(--surface-2)]/70"
      aria-hidden
    />
  );
}
