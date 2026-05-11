"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useTransition } from "react";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { TopbarSearch } from "@/components/layout/TopbarSearch";
import { PageTitleProvider, usePageTitle } from "@/components/layout/PageTitleContext";
import {
  DEFAULT_DEPARTMENT_LABELS,
  DEFAULT_DEPARTMENT_SLUGS_ORDER,
} from "@/lib/navigation/default-departments";
import { createDepartmentBoard } from "@/lib/workspace/actions";

export type DepartmentNavItem = { id: string; name: string; slug: string };

/** Ein Abteilungs-Board oder eine Gruppe für die Sidebar. */
export type DeptBoardNavItem = {
  id: string;
  name: string;
  isGroup: boolean;
  parentId: string | null;
};

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

function TopHeader() {
  const { title } = usePageTitle();
  return (
    <header className="hs-top">
      {title ? (
        <h1 className="shrink-0 text-[15px] font-bold text-[var(--ink)]">{title}</h1>
      ) : null}
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
  );
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
  const router = useRouter();
  const [collapsedDeptSlugs, setCollapsedDeptSlugs] = useState<Set<string>>(() => new Set());
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [createBoardForDept, setCreateBoardForDept] = useState<{ id: string; slug: string } | null>(null);
  const [createType, setCreateType] = useState<"board" | "group">("board");
  const [newBoardName, setNewBoardName] = useState("");
  const [createBoardPending, startCreateBoard] = useTransition();
  const [createBoardError, setCreateBoardError] = useState<string | null>(null);
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

  const toggleDeptCollapsed = (slug: string) => {
    setCollapsedDeptSlugs((prev) => {
      const n = new Set(prev);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });
  };

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const n = new Set(prev);
      if (n.has(groupId)) n.delete(groupId);
      else n.add(groupId);
      return n;
    });
  };

  const openCreateBoardModal = (dept: { id: string; slug: string }) => {
    setCreateBoardForDept(dept);
    setCreateType("board");
    setNewBoardName("");
    setCreateBoardError(null);
  };

  const closeCreateBoardModal = () => {
    setCreateBoardForDept(null);
    setCreateType("board");
    setNewBoardName("");
    setCreateBoardError(null);
  };

  const handleCreateBoard = () => {
    if (!createBoardForDept || !newBoardName.trim()) return;
    setCreateBoardError(null);
    startCreateBoard(async () => {
      const res = await createDepartmentBoard({
        departmentId: createBoardForDept.id,
        name: newBoardName.trim(),
        isGroup: createType === "group",
      });
      if (!res.ok) {
        setCreateBoardError(res.message);
        return;
      }
      if (!res.isGroup) {
        router.push(`/d/${createBoardForDept.slug}/boards/${res.id}`);
      }
      router.refresh();
      closeCreateBoardModal();
    });
  };

  const deptSubLinkIcon = (label: string, active: boolean) => {
    const cls = active ? "opacity-100" : "opacity-70";
    switch (label) {
      case "Übersicht":
        return (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className={cls}>
            <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "OKRs":
        return (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className={cls}>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
          </svg>
        );
      case "Aufgaben":
        return (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className={cls}>
            <path d="M9 11l2 2 4-4M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return <span className="text-[10px] font-bold">·</span>;
    }
  };

  const deptSubLink = (slug: string, href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={`hs-nav-item !py-1.5 !pl-9 !text-[12px] ${active ? "active" : ""}`}
      >
        <span className="ico flex h-[18px] w-[18px] items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--ink-2)]">
          {deptSubLinkIcon(label, active)}
        </span>
        <span className="hs-nav-label">{label}</span>
      </Link>
    );
  };

  const deptBoardLink = (slug: string, boardId: string, label: string, indent = 11) => {
    const href = `/d/${slug}/boards/${boardId}`;
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={`hs-nav-item !py-1.5 !text-[12px] ${active ? "active" : ""}`}
        style={{ paddingLeft: `${indent * 4}px` }}
        title={label}
      >
        <span className="ico flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--ink-2)]">
          <IconBoard active={active} />
        </span>
        <span className="hs-nav-label truncate">{label}</span>
      </Link>
    );
  };

  const renderBoardsWithGroups = (slug: string, boards: DeptBoardNavItem[]) => {
    const groups = boards.filter((b) => b.isGroup);
    const topLevelBoards = boards.filter((b) => !b.isGroup && !b.parentId);
    const boardsByParent = new Map<string, DeptBoardNavItem[]>();
    for (const b of boards) {
      if (!b.isGroup && b.parentId) {
        const existing = boardsByParent.get(b.parentId) || [];
        existing.push(b);
        boardsByParent.set(b.parentId, existing);
      }
    }

    return (
      <>
        {groups.map((group) => {
          const groupCollapsed = collapsedGroupIds.has(group.id);
          const childBoards = boardsByParent.get(group.id) || [];
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroupCollapsed(group.id)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-semibold text-[var(--sidebar-muted)] transition hover:text-[var(--sidebar-ink)]"
                style={{ paddingLeft: "44px" }}
              >
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`shrink-0 transition-transform ${groupCollapsed ? "" : "rotate-90"}`}
                >
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M3 7v13a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-7l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span className="truncate">{group.name}</span>
              </button>
              {!groupCollapsed && childBoards.length > 0 ? (
                <div className="flex flex-col gap-px">
                  {childBoards.map((b) => deptBoardLink(slug, b.id, b.name, 14))}
                </div>
              ) : null}
            </div>
          );
        })}
        {topLevelBoards.map((b) => deptBoardLink(slug, b.id, b.name, 11))}
      </>
    );
  };

  return (
    <PageTitleProvider>
      <div className="hs-app grid min-h-screen grid-cols-[248px_minmax(0,1fr)] bg-[var(--bg)]">
        <aside className="hs-side w-[248px] max-w-[248px] shrink-0">
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
                const deptCollapsed = collapsedDeptSlugs.has(d.slug);
                return (
                  <div key={d.slug} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleDeptCollapsed(d.slug)}
                      aria-expanded={!deptCollapsed}
                      className={`flex w-full cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide shadow-none outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        inDept ? "text-[var(--sidebar-active-ink)]" : "text-[var(--sidebar-muted)]"
                      }`}
                    >
                      <svg
                        width={14}
                        height={14}
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`shrink-0 transition-transform ${deptCollapsed ? "" : "rotate-90"}`}
                        aria-hidden
                      >
                        <path
                          d="M9 6l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <IconBuilding active={inDept} />
                      <span className="truncate">{d.name}</span>
                    </button>
                    {deptCollapsed ? null : (
                    <div className="flex flex-col gap-px">
                      {deptSubLink(d.slug, base, "Übersicht")}
                      {deptSubLink(d.slug, `${base}/okrs/table`, "OKRs")}
                      {deptSubLink(d.slug, `${base}/tasks`, "Aufgaben")}
                      <div
                        className={`flex items-center justify-between px-3 py-1.5 pl-9 ${
                          inDept ? "text-[var(--sidebar-active-ink)]/80" : "text-[var(--sidebar-muted)]"
                        }`}
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-wide">
                          Boards
                        </span>
                        {d.id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreateBoardModal({ id: d.id, slug: d.slug });
                            }}
                            className="flex h-[18px] w-[18px] items-center justify-center rounded-md bg-transparent text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--sidebar-ink)]"
                            title="Neues Board erstellen"
                            aria-label="Neues Board erstellen"
                          >
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M12 5v14M5 12h14"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      {renderBoardsWithGroups(d.slug, boards)}
                    </div>
                    )}
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

      <div className="hs-main flex min-h-0 min-w-0 flex-1 flex-col">
        <TopHeader />

        <main className="min-h-0 flex-1 overflow-auto bg-[var(--bg)]">{children}</main>
      </div>

      {createBoardForDept ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={closeCreateBoardModal}
        >
          <div
            className="w-full max-w-md rounded-hs border border-[var(--border)] bg-[var(--card)] p-6 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold text-[var(--ink)]">
              {createType === "board" ? "Neues Board erstellen" : "Neue Gruppe erstellen"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateBoard();
              }}
            >
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateType("board")}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                    createType === "board"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--border-2)]"
                  }`}
                >
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="text-[var(--ink)]">
                    <rect x="4" y="5" width="5" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="11" y="5" width="4" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="17" y="5" width="3" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span className="text-[12px] font-semibold text-[var(--ink)]">Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateType("group")}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                    createType === "group"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--border-2)]"
                  }`}
                >
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="text-[var(--ink)]">
                    <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-[12px] font-semibold text-[var(--ink)]">Gruppe</span>
                </button>
              </div>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  {createType === "board" ? "Board-Name" : "Gruppen-Name"}
                </span>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder={createType === "board" ? "z. B. Sprint, Backlog, Projekte…" : "z. B. Projekte, Archiv…"}
                  className="hs-input w-full"
                  maxLength={120}
                  autoFocus
                />
              </label>
              {createType === "group" ? (
                <p className="mb-4 text-[11px] text-[var(--muted)]">
                  Gruppen dienen zur Organisation von Boards. Du kannst Boards später in Gruppen verschieben.
                </p>
              ) : null}
              {createBoardError ? (
                <p className="mb-4 text-sm text-[var(--danger)]">{createBoardError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateBoardModal}
                  className="hs-btn hs-btn-ghost"
                  disabled={createBoardPending}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createBoardPending || !newBoardName.trim()}
                  className="hs-btn hs-btn-primary disabled:opacity-50"
                >
                  {createBoardPending ? "Erstellen…" : "Erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </div>
    </PageTitleProvider>
  );
}
