"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { insertTaskRow } from "@/app/(app)/okrs/actions";
import type { MainTableGroupBy, MainTableTaskSort } from "@/components/tasks/MainTableView";
import { COL, customColWidthKey } from "@/lib/tasks/main-table-columns";
import type { TaskListFilters } from "@/lib/tasks/filters";
import type { TaskCustomColumnRow } from "@/types/main-table";

function IconFunnel({ className }: { className?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M4 5h16M8.5 12h7M11 19h2M6 8.5L4 5h16l-2 3.5M10 12v7l2 2 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildViewTabs(base: string) {
  return [
    { href: base, label: "Tabelle", match: (p: string) => p === base },
    { href: `${base}/kanban`, label: "Kanban", match: (p: string) => p.startsWith(`${base}/kanban`) },
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
}

export function TasksMonoToolbar({
  tasksPathPrefix,
  initialTasksForNextId,
  departmentId,
  draft,
  setDraft,
  applyFilters,
  pending,
  filtersOpen,
  onFiltersOpenChange,
  filtersActive,
  groupBy,
  onGroupByChange,
  taskSort,
  onTaskSortChange,
  hiddenColumnKeys,
  onHiddenColumnKeysChange,
  initialCustomColumns,
}: {
  tasksPathPrefix: string;
  initialTasksForNextId: { id: number }[];
  departmentId?: string | null;
  draft: TaskListFilters;
  setDraft: React.Dispatch<React.SetStateAction<TaskListFilters>>;
  applyFilters: () => void;
  pending: boolean;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  filtersActive: boolean;
  groupBy: MainTableGroupBy;
  onGroupByChange: (g: MainTableGroupBy) => void;
  taskSort: MainTableTaskSort;
  onTaskSortChange: (s: MainTableTaskSort) => void;
  hiddenColumnKeys: string[];
  onHiddenColumnKeysChange: (keys: string[]) => void;
  initialCustomColumns: TaskCustomColumnRow[];
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [creating, setCreating] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);

  const nextId = useMemo(
    () =>
      initialTasksForNextId.length
        ? Math.max(...initialTasksForNextId.map((t) => t.id)) + 1
        : 1,
    [initialTasksForNextId],
  );

  const viewTabs = useMemo(() => buildViewTabs(tasksPathPrefix), [tasksPathPrefix]);

  const hideableBuiltins = useMemo(
    () => [
      { key: COL.grab, label: "Griff" },
      { key: COL.person, label: "Person" },
      { key: COL.link, label: "OKR" },
      { key: COL.topic, label: "Thema" },
      { key: COL.status, label: "Status" },
      { key: COL.start, label: "Start" },
      { key: COL.end, label: "Ende" },
      { key: COL.prog, label: "Fortschritt" },
      { key: COL.attach, label: "Anhänge" },
    ],
    [],
  );

  const hideableCustom = useMemo(
    () =>
      initialCustomColumns.map((c) => ({
        key: customColWidthKey(c.col_key),
        label: c.label,
      })),
    [initialCustomColumns],
  );

  const toggleHidden = useCallback(
    (key: string) => {
      onHiddenColumnKeysChange(
        hiddenColumnKeys.includes(key)
          ? hiddenColumnKeys.filter((k) => k !== key)
          : [...hiddenColumnKeys, key],
      );
    },
    [hiddenColumnKeys, onHiddenColumnKeysChange],
  );

  const applySearchFromToolbar = useCallback(() => {
    applyFilters();
  }, [applyFilters]);

  const onCreateTask = useCallback(async () => {
    setCreating(true);
    try {
      const res = await insertTaskRow({
        id: nextId,
        name: "Neue Aufgabe",
        item_kind: "task",
        department_id: departmentId ?? null,
        parent_id: null,
        okr_objective_id: null,
        okr_key_result_id: null,
        start_date: null,
        end_date: null,
        topic: null,
        assigned: null,
        notes: null,
        dependencies: [],
        attachments: [],
        custom_fields: {},
      });
      if (res.ok) router.refresh();
    } finally {
      setCreating(false);
    }
  }, [nextId, departmentId, router]);

  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 rounded-hs border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-card sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">
          Ansicht
        </span>
        {viewTabs.map((t) => {
          const active = t.match(pathname);
          const href = qs ? `${t.href}?${qs}` : t.href;
          return (
            <Link
              key={t.href}
              href={href}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--ink-2)] hover:bg-[var(--hover)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" aria-hidden />

      <button
        type="button"
        disabled={creating}
        onClick={() => void onCreateTask()}
        className="hs-btn hs-btn-primary !py-1.5 !text-[12px] disabled:pointer-events-none disabled:opacity-50"
      >
        {creating ? "…" : "Neue Aufgabe"}
      </button>

      <form
        className="flex min-w-[140px] flex-1 items-center gap-1 sm:max-w-[220px]"
        onSubmit={(e) => {
          e.preventDefault();
          applySearchFromToolbar();
        }}
      >
        <input
          value={draft.q}
          onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
          placeholder="Suche…"
          className="hs-input !py-1.5 !text-[12px]"
          aria-label="Suche"
        />
        <button type="submit" className="hs-btn hs-btn-ghost !px-2 !py-1.5 !text-[11px]" disabled={pending}>
          OK
        </button>
      </form>

      <form
        className="flex min-w-[120px] items-center gap-1 sm:max-w-[200px]"
        onSubmit={(e) => {
          e.preventDefault();
          applySearchFromToolbar();
        }}
      >
        <input
          value={draft.assignee || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, assignee: e.target.value.trim() || null }))
          }
          placeholder="Person…"
          className="hs-input !py-1.5 !text-[12px]"
          aria-label="Zugewiesen (enthält)"
        />
      </form>

      <button
        type="button"
        onClick={() => onFiltersOpenChange(!filtersOpen)}
        className={`relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition ${
          filtersOpen
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
            : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--border-2)]"
        }`}
        aria-expanded={filtersOpen}
        title="Filter-Panel"
      >
        <IconFunnel className="text-[var(--ink-2)]" />
        Filter
        {filtersActive ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
            ·
          </span>
        ) : null}
      </button>

      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-3)]">
        Sortierung
        <select
          value={taskSort}
          onChange={(e) => onTaskSortChange(e.target.value as MainTableTaskSort)}
          className="hs-select !py-1.5 !text-[12px]"
        >
          <option value="none">Standard (Hierarchie)</option>
          <option value="name">Name</option>
          <option value="start">Start</option>
          <option value="status">Status</option>
        </select>
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setHideOpen((o) => !o)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-2)] hover:border-[var(--border-2)]"
          aria-expanded={hideOpen}
        >
          Ausblenden
        </button>
        {hideOpen ? (
          <div
            className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-card"
            role="listbox"
          >
            <p className="mb-2 text-[11px] font-bold text-[var(--muted)]">Spalten</p>
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {[...hideableBuiltins, ...hideableCustom].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={hiddenColumnKeys.includes(key)}
                    onChange={() => toggleHidden(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-3)]">
        Gruppieren
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as MainTableGroupBy)}
          className="hs-select !py-1.5 !text-[12px]"
        >
          <option value="none">Keine</option>
          <option value="topic">Thema</option>
          <option value="status">Status</option>
        </select>
      </label>
    </div>
  );
}

export { IconFunnel };
