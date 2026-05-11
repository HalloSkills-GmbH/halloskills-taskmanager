"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { TopbarSearch } from "@/components/layout/TopbarSearch";
import {
  DEFAULT_DEPARTMENT_LABELS,
  DEFAULT_DEPARTMENT_SLUGS_ORDER,
} from "@/lib/navigation/default-departments";

export type DepartmentNavItem = { id: string; name: string; slug: string };

/** Ein Abteilungs-Board für die Sidebar. */
export type DeptBoardNavItem = { id: string; name: string };

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={active ? "opacity-100" : "opacity-80"}
      aria-hidden
    >
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTasks({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={active ? "opacity-100" : "opacity-80"}
      aria-hidden
    >
      <path
        d="M9 11l2 2 4-4M8 6h11M8 12h11M8 18h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconOkr({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={active ? "opacity-100" : "opacity-80"}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 5v2M12 17v2M5 12h2M17 12h2M7.05 7.05l1.41 1.41M15.54 15.54l1.41 1.41M7.05 16.95l1.41-1.41M15.54 8.46l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBoard({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={active ? "opacity-100" : "opacity-80"}
      aria-hidden
    >
      <rect x="4" y="5" width="5" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="5" width="4" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="5" width="3" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconBuilding({ active }: { active: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      className={active ? "opacity-100" : "opacity-80"}
      aria-hidden
    >
      <path
        d="M4 21h16M6 21V8l6-4 6 4v13M10 21v-4h4v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const overviewNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p === "/dashboard",
  },
  {
    href: "/okrs/table",
    label: "OKRs",
    match: (p) => p.startsWith("/okrs") && !p.startsWith("/d/"),
  },
];

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  switch (item.href) {
    case "/dashboard":
      return <IconDashboard active={active} />;
    case "/tasks":
      return <IconTasks active={active} />;
    case "/okrs/table":
      return <IconOkr active={active} />;
    case "/board":
      return <IconBoard active={active} />;
    default:
      return null;
  }
}

export function ProductShell({
  userEmail,
  departments = [],
  departmentBoardsByDeptId = {},
  children,
}: {
  userEmail: string | undefined;
  departments?: DepartmentNavItem[];
  /** Boards pro Abteilungs-ID (Sidebar). */
  departmentBoardsByDeptId?: Record<string, DeptBoardNavItem[]>;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const initial = userEmail?.trim().charAt(0).toUpperCase() || "?";
  const displayName = userEmail?.split("@")[0]?.replace(/\./g, " ") || "Angemeldet";

  const defaultSlugSet = useMemo(() => new Set<string>(DEFAULT_DEPARTMENT_SLUGS_ORDER), []);
  const orderedDepartments = useMemo(() => {
    const extras = departments.filter((d) => !defaultSlugSet.has(d.slug));
    extras.sort((a, b) => a.name.localeCompare(b.name, "de"));
    const core = DEFAULT_DEPARTMENT_SLUGS_ORDER.map((slug) => {
      const d = departments.find((x) => x.slug === slug);
      return (
        d ?? {
          id: "",
          name: DEFAULT_DEPARTMENT_LABELS[slug] ?? slug,
          slug,
        }
      );
    });
    return [...core, ...extras];
  }, [departments, defaultSlugSet]);

  const deptSubLink = (slug: string, href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={`hs-nav-item !py-1.5 !pl-9 !text-[12px] ${active ? "active" : ""}`}
      >
        <span className="ico flex h-[18px] w-[18px] items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--ink-2)] opacity-70">
          <span className="text-[10px] font-bold text-[var(--sidebar-muted)]">·</span>
        </span>
        <span className="hs-nav-label">{label}</span>
      </Link>
    );
  };

  const deptBoardLink = (slug: string, boardId: string, label: string) => {
    const href = `/d/${slug}/boards/${boardId}`;
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={`hs-nav-item !py-1.5 !pl-11 !text-[12px] ${active ? "active" : ""}`}
        title={label}
      >
        <span className="ico flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--ink-2)]">
          <IconBoard active={active} />
        </span>
        <span className="hs-nav-label truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="hs-app min-h-screen">
      <aside className="hs-side">
        <div className="flex flex-col border-b border-[var(--border)]/40">
          <div className="flex items-center gap-2.5 px-[18px] pt-[18px]">
            <Link href="/dashboard" className="hs-logo" title="HalloSkills">
              <span className="l font-display italic">H</span>
            </Link>
            <div className="hs-brand min-w-0">
              <span className="b1">HalloSkills</span>
              <span className="b2">Workspace</span>
            </div>
          </div>
          <div className="px-[10px] pb-3 pt-2">
            <Suspense
              fallback={
                <div
                  className="h-[40px] rounded-xl bg-[var(--hover)]/30 animate-pulse"
                  aria-hidden
                />
              }
            >
              <TopbarSearch variant="sidebar" />
            </Suspense>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="hs-side-section">Übersicht</div>
          <nav className="hs-nav" aria-label="Übersicht">
            {overviewNav.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`hs-nav-item ${active ? "active" : ""}`}
                >
                  <span className="ico flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[var(--surface-2)] text-[var(--ink-2)]">
                    <NavIcon item={item} active={active} />
                  </span>
                  <span className="hs-nav-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hs-side-section">Abteilungen</div>
          <div className="hs-side-groups pb-2">
            {orderedDepartments.map((d) => {
                const base = `/d/${d.slug}`;
                const inDept = pathname.startsWith(base);
                const boards = d.id ? departmentBoardsByDeptId[d.id] ?? [] : [];
                return (
                  <div key={d.slug} className="mb-1">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                        inDept ? "text-[var(--sidebar-active-ink)]" : "text-[var(--sidebar-muted)]"
                      }`}
                    >
                      <IconBuilding active={inDept} />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <div className="flex flex-col gap-px">
                      {deptSubLink(d.slug, base, "Übersicht")}
                      {deptSubLink(d.slug, `${base}/tasks`, "Aufgaben")}
                      {deptSubLink(d.slug, `${base}/okrs/table`, "OKRs")}
                      {deptSubLink(d.slug, `${base}/boards`, "Board-Übersicht")}
                      {boards.length > 0 ? (
                        <>
                          <div
                            className={`px-3 py-1.5 pl-9 text-[10px] font-extrabold uppercase tracking-wide ${
                              inDept ? "text-[var(--sidebar-active-ink)]/80" : "text-[var(--sidebar-muted)]"
                            }`}
                          >
                            Boards
                          </div>
                          {boards.map((b) => deptBoardLink(d.slug, b.id, b.name))}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="hs-side-foot mt-auto shrink-0 border-t border-[var(--border)]/40 pt-2">
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-[11px] font-bold text-white shadow-[0_4px_12px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
            title={userEmail || ""}
          >
            {initial}
          </span>
          <div className="hs-side-foot-name min-w-0">
            <span className="n1 truncate">{displayName}</span>
            <span className="n2 truncate">{userEmail || "—"}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="hs-main">
        <header className="hs-top">
          <div className="min-w-[12px] shrink" style={{ flex: 1 }} />
          <button
            type="button"
            className="hs-iconbtn"
            title="Benachrichtigungen"
            aria-label="Benachrichtigungen"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 22a2 2 0 002-2H10a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <span className="badge" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[var(--bg)]">{children}</main>
      </div>
    </div>
  );
}
