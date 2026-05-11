"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useMemo, type ReactNode } from "react";
import { useSetPageTitle } from "@/components/layout/PageTitleContext";

function BoardTasksTabBar({
  boardName,
  deptSlug,
  boardId,
}: {
  boardName: string;
  deptSlug: string;
  boardId: string;
}) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const tabs = useMemo(() => {
    const base = `/d/${deptSlug}/boards/${boardId}`;
    return [
      {
        href: base,
        label: "Tabelle",
        match: (p: string) => p === base || p === `${base}/`,
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
  }, [deptSlug, boardId]);

  return (
    <nav
      className="hs-tabs inline-flex flex-wrap gap-y-1"
      aria-label={`Board-Ansichten (${boardName})`}
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
  );
}

function BoardTasksTabBarFallback({
  boardName,
  deptSlug,
  boardId,
}: {
  boardName: string;
  deptSlug: string;
  boardId: string;
}) {
  const base = `/d/${deptSlug}/boards/${boardId}`;
  const tabs = [
    { href: base, label: "Tabelle" },
    { href: `${base}/kanban`, label: "Kanban" },
    { href: `${base}/gantt`, label: "Zeitleiste" },
    { href: `${base}/calendar`, label: "Kalender" },
  ] as const;
  return (
    <nav
      className="hs-tabs inline-flex flex-wrap gap-y-1"
      aria-label={`Board-Ansichten (${boardName})`}
    >
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="hs-tab">
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Tabs für `/d/:deptSlug/boards/:boardId` (Tabelle, Kanban, Zeitleiste, Kalender). */
export default function BoardTasksShell({
  boardName,
  deptDisplayName,
  deptSlug,
  boardId,
  children,
}: {
  boardName: string;
  deptDisplayName: string;
  deptSlug: string;
  boardId: string;
  children: ReactNode;
}) {
  useSetPageTitle(`${boardName} · ${deptDisplayName}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] px-[var(--pad-x)] py-3">
        <div className="mx-auto flex max-w-[1680px] items-center gap-4">
          <Suspense
            fallback={<BoardTasksTabBarFallback boardName={boardName} deptSlug={deptSlug} boardId={boardId} />}
          >
            <BoardTasksTabBar boardName={boardName} deptSlug={deptSlug} boardId={boardId} />
          </Suspense>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
