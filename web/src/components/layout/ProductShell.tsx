"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { TopbarSearch } from "@/components/layout/TopbarSearch";
import { PageTitleProvider, usePageTitle } from "@/components/layout/PageTitleContext";
import { SidebarItemMenu, SidebarIcon } from "@/components/layout/SidebarItemMenu";
import {
  DEFAULT_DEPARTMENT_LABELS,
  DEFAULT_DEPARTMENT_SLUGS_ORDER,
} from "@/lib/navigation/default-departments";
import {
  createDepartmentBoard,
  reorderSidebarBoards,
  updateBoardParent,
  updateDepartment,
  deleteDepartment,
  updateDepartmentBoard,
  deleteDepartmentBoard,
} from "@/lib/workspace/actions";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type DepartmentNavItem = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
};

/** Ein Abteilungs-Board oder eine Gruppe für die Sidebar. */
export type DeptBoardNavItem = {
  id: string;
  name: string;
  isGroup: boolean;
  parentId: string | null;
  icon?: string;
  color?: string;
};

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

function isBoardListId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

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

function SubLinkMenu({ deptId, deptSlug, linkType }: { deptId: string; deptSlug: string; linkType: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const getHref = () => {
    switch (linkType) {
      case "Übersicht":
        return `/d/${deptSlug}`;
      case "OKRs":
        return `/d/${deptSlug}/okrs/table`;
      case "Aufgaben":
        return `/d/${deptSlug}/tasks`;
      default:
        return `/d/${deptSlug}`;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(!open);
        }}
        className="flex h-5 w-5 items-center justify-center rounded text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--sidebar-ink)]"
        title="Optionen"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-[180px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-pop">
            <button
              type="button"
              onClick={() => {
                window.open(getHref(), "_blank");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--ink)] transition hover:bg-[var(--hover)]"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              In neuem Tab öffnen
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + getHref());
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--ink)] transition hover:bg-[var(--hover)]"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Link kopieren
            </button>
            <div className="my-1 h-px bg-[var(--border)]" />
            <div className="px-2 py-1.5 text-[10px] text-[var(--muted)]">
              System-Link (nicht editierbar)
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SortableBoardItem({
  board,
  slug,
  pathname,
  indent,
  onUpdate,
  onDelete,
}: {
  board: DeptBoardNavItem;
  slug: string;
  pathname: string;
  indent: number;
  onUpdate: (data: { name?: string; icon?: string; color?: string }) => Promise<{ ok: boolean }>;
  onDelete: () => Promise<{ ok: boolean }>;
}) {
  /** DnD aria-IDs: erst nach Mount auf den Link legen (Hydration). */
  const [dragReady, setDragReady] = useState(false);
  useEffect(() => {
    setDragReady(true);
  }, []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: board.id,
    data: { type: "board", board },
    disabled: !dragReady,
  });
  const href = `/d/${slug}/boards/${board.id}`;
  const active = pathname === href;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.55 } : {}),
  };

  return (
    <div ref={setNodeRef} className={`group/sidebar-board flex items-center`} style={style}>
      <Link
        href={href}
        className={`hs-nav-item flex-1 !py-1.5 !pr-1 !text-[12px] ${active ? "active" : ""}`}
        style={{ paddingLeft: `${indent * 4}px` }}
        title={board.name}
        {...(dragReady ? { ...attributes, ...listeners } : {})}
      >
        <span
          className="ico flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
          style={{ background: board.color || "var(--surface-2)", color: board.color ? "white" : "var(--ink-2)" }}
        >
          <SidebarIcon icon={board.icon || "board"} className="h-3.5 w-3.5" />
        </span>
        <span className="hs-nav-label truncate">{board.name}</span>
      </Link>
      <SidebarItemMenu
        itemId={board.id}
        itemType={board.isGroup ? "group" : "board"}
        currentName={board.name}
        currentIcon={board.icon || "board"}
        currentColor={board.color || "#579bfc"}
        onUpdate={onUpdate}
        onDelete={onDelete}
        hoverGroup="sidebar-board"
      />
    </div>
  );
}

function DroppableGroup({
  group,
  slug,
  pathname,
  collapsed,
  onToggle,
  onUpdate,
  onDelete,
  children,
}: {
  group: DeptBoardNavItem;
  slug: string;
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  onUpdate: (data: { name?: string; icon?: string; color?: string }) => Promise<{ ok: boolean }>;
  onDelete: () => Promise<{ ok: boolean }>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group:${group.id}`,
    data: { type: "group", groupId: group.id },
  });

  return (
    <div ref={setNodeRef} className={isOver ? "drop-active" : ""}>
      <div className="group/sidebar-folder flex items-center" style={{ paddingLeft: "44px" }}>
        <button
          type="button"
          onClick={onToggle}
          className={`flex flex-1 items-center gap-1.5 py-1.5 pr-1 text-left text-[11px] font-semibold transition ${
            isOver
              ? "text-[var(--accent-ink)]"
              : "text-[var(--sidebar-muted)] hover:text-[var(--sidebar-ink)]"
          }`}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`}
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded"
            style={{ background: group.color || "var(--surface-2)", color: group.color ? "white" : "currentColor" }}
          >
            <SidebarIcon icon={group.icon || "folder"} className="h-3 w-3" />
          </span>
          <span className="truncate">{group.name}</span>
        </button>
        <SidebarItemMenu
          itemId={group.id}
          itemType="group"
          currentName={group.name}
          currentIcon={group.icon || "folder"}
          currentColor={group.color || "#579bfc"}
          onUpdate={onUpdate}
          onDelete={onDelete}
          hoverGroup="sidebar-folder"
        />
      </div>
      {!collapsed ? children : null}
    </div>
  );
}

function DroppableRoot({ children, deptId }: { children: React.ReactNode; deptId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `root:${deptId}`,
    data: { type: "root", deptId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-px transition ${isOver ? "bg-[var(--accent-soft)]/30" : ""}`}
    >
      {children}
    </div>
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

/** DndContext nur um die Board-Liste einer Abteilung — Abteilungsköpfe/Sublinks bleiben außerhalb (SSR + Hydration stabil). */
function DepartmentBoardsDnd({
  deptId,
  boards,
  children,
}: {
  deptId: string;
  boards: DeptBoardNavItem[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startDndTransition] = useTransition();
  const [draggingBoard, setDraggingBoard] = useState<DeptBoardNavItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === "board") {
      setDraggingBoard(active.data.current.board as DeptBoardNavItem);
    }
  };

  const siblingBoardIds = (parentId: string | null) =>
    boards
      .filter((b) => !b.isGroup && (b.parentId ?? null) === parentId)
      .map((b) => b.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingBoard(null);

    if (!over) return;

    const boardId = active.id as string;
    if (!isBoardListId(boardId)) return;

    const currentBoard = active.data.current?.board as DeptBoardNavItem | undefined;
    if (!currentBoard || currentBoard.isGroup) return;

    const overId = over.id as string;

    if (overId.startsWith("group:") || overId.startsWith("root:")) {
      let newParentId: string | null = null;
      if (overId.startsWith("group:")) {
        newParentId = overId.replace("group:", "");
      } else if (overId.startsWith("root:")) {
        newParentId = null;
      }

      if (currentBoard.parentId === newParentId) return;

      startDndTransition(async () => {
        const res = await updateBoardParent({ boardId, parentId: newParentId });
        if (res.ok) router.refresh();
      });
      return;
    }

    if (!isBoardListId(overId)) return;

    const overBoard = boards.find((b) => b.id === overId);
    if (!overBoard || overBoard.isGroup) return;
    if (overBoard.id === boardId) return;

    const targetParentId = overBoard.parentId ?? null;
    const currentParentId = currentBoard.parentId ?? null;

    if (currentParentId === targetParentId) {
      const sibs = siblingBoardIds(currentParentId);
      const oldIndex = sibs.indexOf(boardId);
      const newIndex = sibs.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const orderedIds = arrayMove(sibs, oldIndex, newIndex);
      startDndTransition(async () => {
        const res = await reorderSidebarBoards({ departmentId: deptId, parentId: currentParentId, orderedIds });
        if (res.ok) router.refresh();
      });
      return;
    }

    startDndTransition(async () => {
      const moveRes = await updateBoardParent({ boardId, parentId: targetParentId });
      if (!moveRes.ok) return;
      const without = siblingBoardIds(targetParentId).filter((id) => id !== boardId);
      const overIdx = without.indexOf(overId);
      const insertAt = overIdx === -1 ? without.length : overIdx;
      const orderedIds = [...without.slice(0, insertAt), boardId, ...without.slice(insertAt)];
      const reRes = await reorderSidebarBoards({ departmentId: deptId, parentId: targetParentId, orderedIds });
      if (reRes.ok) router.refresh();
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {draggingBoard ? (
          <div className="hs-nav-item !py-1.5 !text-[12px] rounded-lg bg-[var(--card)] shadow-pop">
            <span className="ico flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--ink-2)]">
              <IconBoard active={false} />
            </span>
            <span className="hs-nav-label truncate">{draggingBoard.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
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
  const [collapsedBoardsDeptIds, setCollapsedBoardsDeptIds] = useState<Set<string>>(() => new Set());
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

  const toggleBoardsCollapsed = (deptId: string) => {
    setCollapsedBoardsDeptIds((prev) => {
      const n = new Set(prev);
      if (n.has(deptId)) n.delete(deptId);
      else n.add(deptId);
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

  const deptSubLink = (deptId: string, slug: string, href: string, label: string) => {
    const active = label === "Übersicht" 
      ? pathname === href 
      : (pathname === href || pathname.startsWith(`${href}/`));
    return (
      <div key={href} className="group/sublink relative flex items-center">
        <Link
          href={href}
          className={`hs-nav-item flex-1 !py-1.5 !pl-9 !pr-8 !text-[12px] ${active ? "active" : ""}`}
        >
          <span className="ico flex h-[18px] w-[18px] items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--ink-2)]">
            {deptSubLinkIcon(label, active)}
          </span>
          <span className="hs-nav-label">{label}</span>
        </Link>
        <div className="absolute right-1 opacity-0 transition-opacity group-hover/sublink:opacity-100">
          <SubLinkMenu deptId={deptId} deptSlug={slug} linkType={label} />
        </div>
      </div>
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

  const renderBoardsWithGroups = (slug: string, boards: DeptBoardNavItem[], deptId: string) => {
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

    const handleBoardUpdate = async (boardId: string, data: { name?: string; icon?: string; color?: string }) => {
      const res = await updateDepartmentBoard({ id: boardId, ...data });
      if (res.ok) router.refresh();
      return res;
    };

    const handleBoardDelete = async (boardId: string) => {
      const res = await deleteDepartmentBoard({ id: boardId });
      if (res.ok) router.refresh();
      return res;
    };

    return (
      <DroppableRoot deptId={deptId}>
        {groups.map((group) => {
          const groupCollapsed = collapsedGroupIds.has(group.id);
          const childBoards = boardsByParent.get(group.id) || [];
          return (
            <DroppableGroup
              key={group.id}
              group={group}
              slug={slug}
              pathname={pathname}
              collapsed={groupCollapsed}
              onToggle={() => toggleGroupCollapsed(group.id)}
              onUpdate={(data) => handleBoardUpdate(group.id, data)}
              onDelete={() => handleBoardDelete(group.id)}
            >
              {childBoards.length > 0 ? (
                <SortableContext items={childBoards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-px">
                    {childBoards.map((b) => (
                      <SortableBoardItem
                        key={b.id}
                        board={b}
                        slug={slug}
                        pathname={pathname}
                        indent={14}
                        onUpdate={(data) => handleBoardUpdate(b.id, data)}
                        onDelete={() => handleBoardDelete(b.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              ) : null}
            </DroppableGroup>
          );
        })}
        {topLevelBoards.length > 0 ? (
          <SortableContext items={topLevelBoards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {topLevelBoards.map((b) => (
              <SortableBoardItem
                key={b.id}
                board={b}
                slug={slug}
                pathname={pathname}
                indent={11}
                onUpdate={(data) => handleBoardUpdate(b.id, data)}
                onDelete={() => handleBoardDelete(b.id)}
              />
            ))}
          </SortableContext>
        ) : null}
      </DroppableRoot>
    );
  };

  return (
    <PageTitleProvider>
      <div className="hs-app grid min-h-screen grid-cols-[232px_minmax(0,1fr)] bg-[var(--bg)]">
        <aside className="hs-side w-[232px] max-w-[232px] shrink-0">
        <div className="flex flex-col border-b border-[var(--border)]/40">
          <div className="flex flex-col items-center px-[18px] pt-[16px]">
            <Link href="/dashboard" title="HalloSkills">
              <img 
                src="/logo.png" 
                alt="HalloSkills" 
                className="h-8 w-auto" 
                style={{ background: "transparent" }}
              />
            </Link>
            <span className="mt-1 text-[11px] font-semibold tracking-wide text-[var(--sidebar-muted)]">
              Taskmanagement
            </span>
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
                  const boardsSectionCollapsed = d.id ? collapsedBoardsDeptIds.has(d.id) : false;

                  const handleDeptUpdate = async (data: { name?: string; icon?: string; color?: string }) => {
                    if (!d.id) return { ok: false, message: "Keine ID" };
                    const res = await updateDepartment({ id: d.id, ...data });
                    if (res.ok) router.refresh();
                    return res;
                  };

                  const handleDeptDelete = async () => {
                    if (!d.id) return { ok: false, message: "Keine ID" };
                    const res = await deleteDepartment({ id: d.id });
                    if (res.ok) router.refresh();
                    return res;
                  };

                  return (
                    <div key={d.slug} className="mb-1">
                      <div className="group/sidebar-dept flex items-center px-3">
                        <button
                          type="button"
                          onClick={() => toggleDeptCollapsed(d.slug)}
                          aria-expanded={!deptCollapsed}
                          className={`flex flex-1 cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent py-1.5 pr-1 text-left text-[11px] font-bold uppercase tracking-wide shadow-none outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
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
                          <span
                            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
                            style={{ background: d.color || "var(--surface-2)", color: d.color ? "white" : "currentColor" }}
                          >
                            <SidebarIcon icon={d.icon || "building"} className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate">{d.name}</span>
                        </button>
                        {d.id ? (
                          <SidebarItemMenu
                            itemId={d.id}
                            itemType="department"
                            currentName={d.name}
                            currentIcon={d.icon || "building"}
                            currentColor={d.color || "#579bfc"}
                            onUpdate={handleDeptUpdate}
                            onDelete={handleDeptDelete}
                            hoverGroup="sidebar-dept"
                          />
                        ) : null}
                      </div>
                      {deptCollapsed ? null : (
                      <div className="flex flex-col gap-px">
                        {deptSubLink(d.id, d.slug, base, "Übersicht")}
                        {deptSubLink(d.id, d.slug, `${base}/okrs/table`, "OKRs")}
                        {deptSubLink(d.id, d.slug, `${base}/tasks`, "Aufgaben")}
                        <div
                          className={`flex items-center gap-1.5 py-1.5 pr-3 pl-9 ${
                            inDept ? "text-[var(--sidebar-active-ink)]/80" : "text-[var(--sidebar-muted)]"
                          }`}
                        >
                          {d.id ? (
                            <button
                              type="button"
                              onClick={() => toggleBoardsCollapsed(d.id)}
                              aria-expanded={!boardsSectionCollapsed}
                              className={`flex min-w-0 flex-1 cursor-pointer appearance-none items-center gap-1.5 border-0 bg-transparent py-0 text-left shadow-none outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                                inDept ? "text-[var(--sidebar-active-ink)]/80" : "text-[var(--sidebar-muted)]"
                              }`}
                            >
                              <svg
                                width={14}
                                height={14}
                                viewBox="0 0 24 24"
                                fill="none"
                                className={`shrink-0 transition-transform ${boardsSectionCollapsed ? "" : "rotate-90"}`}
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
                              <span className="text-[10px] font-extrabold uppercase tracking-wide">
                                Boards
                              </span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase tracking-wide">
                              Boards
                            </span>
                          )}
                          {d.id ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreateBoardModal({ id: d.id, slug: d.slug });
                              }}
                              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-transparent text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--sidebar-ink)]"
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
                        {d.id && !boardsSectionCollapsed ? (
                          <DepartmentBoardsDnd key={`dnd-${d.id}`} deptId={d.id} boards={boards}>
                            {renderBoardsWithGroups(d.slug, boards, d.id)}
                          </DepartmentBoardsDnd>
                        ) : null}
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
