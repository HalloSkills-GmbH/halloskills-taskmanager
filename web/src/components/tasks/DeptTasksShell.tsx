"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useSetPageTitle } from "@/components/layout/PageTitleContext";

/** Tabs für `/d/:deptSlug/tasks` (Tabelle, Zeitleiste, Kalender). */
export function DeptTasksShell({
  deptSlug,
  children,
}: {
  deptSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const capitalizedSlug = deptSlug.charAt(0).toUpperCase() + deptSlug.slice(1);
  useSetPageTitle(`Deliverables · ${capitalizedSlug}`);

  const tabs = useMemo(() => {
    const base = `/d/${deptSlug}/tasks`;
    return [
      {
        href: base,
        label: "Tabelle",
        match: (p: string) => p === base,
      },
      {
        href: `${base}/kanban`,
        label: "Kanban",
        match: (p: string) => p.startsWith(`${base}/kanban`),
      },
      {
        href: `${base}/gantt`,
        label: "Zeitleiste",
        match: (p: string) => p.startsWith(`${base}/gantt`),
      },
      {
        href: `${base}/calendar`,
        label: "Kalender",
        match: (p: string) => p.startsWith(`${base}/calendar`),
      },
    ] as const;
  }, [deptSlug]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] px-[var(--pad-x)] py-3">
        <div className="mx-auto flex max-w-[1680px] items-center gap-4">
          <nav
            className="hs-tabs inline-flex flex-wrap gap-y-1"
            aria-label={`Aufgaben-Ansichten (${deptSlug})`}
          >
            {tabs.map((t) => {
              const active = t.match(pathname);
              const href = qs ? `${t.href}?${qs}` : t.href;
              return (
                <Link key={t.href} href={href} className={`hs-tab ${active ? "active" : ""}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
