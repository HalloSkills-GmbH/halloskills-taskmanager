"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSetPageTitle } from "@/components/layout/PageTitleContext";

const tabs = [
  {
    href: "/tasks",
    label: "Tabelle",
    match: (p: string) => p === "/tasks",
  },
  {
    href: "/tasks/kanban",
    label: "Kanban",
    match: (p: string) => p.startsWith("/tasks/kanban"),
  },
  {
    href: "/tasks/gantt",
    label: "Zeitleiste",
    match: (p: string) => p.startsWith("/tasks/gantt"),
  },
  {
    href: "/tasks/calendar",
    label: "Kalender",
    match: (p: string) => p.startsWith("/tasks/calendar"),
  },
] as const;

export function TasksShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  useSetPageTitle("Aufgaben");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] px-[var(--pad-x)] py-3">
        <div className="mx-auto flex max-w-[1680px] items-center gap-4">
          <nav
            className="hs-tabs inline-flex flex-wrap gap-y-1"
            aria-label="Aufgaben-Ansichten"
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
