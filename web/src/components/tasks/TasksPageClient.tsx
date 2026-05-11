"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { IconFunnel } from "@/components/tasks/TasksMonoToolbar";
import {
  parseTaskListFilters,
  serializeTaskListFilters,
  taskListFiltersActive,
  type TaskListFilters,
} from "@/lib/tasks/filters";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import type { MainTableGroupBy, MainTableTaskSort } from "./MainTableView";
import { MainTableView } from "./MainTableView";
import { TasksMonoToolbar } from "./TasksMonoToolbar";

export function TasksPageClient({
  initialTasks,
  initialCustomColumns,
  initialMergedWidths,
  layoutSyncKey,
  departmentId = null,
  pageTitle,
  tasksPathPrefix = "/tasks",
}: {
  initialTasks: TaskRow[];
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  layoutSyncKey: string;
  departmentId?: string | null;
  /** Optional: z. B. „Aufgaben · Marketing“ für Abteilungsrouten */
  pageTitle?: string;
  /** Basis-Pfad für Filter-Navigation (z. B. `/d/slug/tasks`). */
  tasksPathPrefix?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const qsKey = searchParams.toString();

  const applied = useMemo(() => parseTaskListFilters(new URLSearchParams(qsKey)), [qsKey]);
  const [draft, setDraft] = useState<TaskListFilters>(applied);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<MainTableGroupBy>("topic");
  const [taskSort, setTaskSort] = useState<MainTableTaskSort>("none");

  const hideColStorageKey = `main-tasks-hidden-${departmentId ?? "all"}`;
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(hideColStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          setHiddenColumnKeys(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, [hideColStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(hideColStorageKey, JSON.stringify(hiddenColumnKeys));
    } catch {
      /* ignore */
    }
  }, [hideColStorageKey, hiddenColumnKeys]);

  const activeFilters = useMemo(() => taskListFiltersActive(applied), [applied]);

  const applyFilters = useCallback(() => {
    const qs = serializeTaskListFilters(draft);
    startTransition(() => {
      router.push(qs ? `${tasksPathPrefix}?${qs}` : tasksPathPrefix);
    });
  }, [draft, router, tasksPathPrefix]);

  const resetFilters = useCallback(() => {
    startTransition(() => {
      router.push(tasksPathPrefix);
    });
    setDraft(parseTaskListFilters({}));
  }, [router, tasksPathPrefix]);

  return (
    <div className="hs-page mx-auto max-w-[1680px]">
      <div className="hs-page-head mb-4">
        <div className="hs-page-title min-w-0 max-w-3xl">
          <h1>{pageTitle ?? "Aufgaben"}</h1>
          <p className="sub">
            Haupttabelle mit Hierarchie und Realtime. Schnellfilter in der Toolbar; detaillierte
            Filter in der URL (
            <code className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px]">
              q
            </code>
            ,{" "}
            <code className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px]">
              assignee
            </code>
            , …).
          </p>
        </div>
      </div>

      <TasksMonoToolbar
        tasksPathPrefix={tasksPathPrefix}
        initialTasksForNextId={initialTasks}
        departmentId={departmentId}
        draft={draft}
        setDraft={setDraft}
        applyFilters={applyFilters}
        pending={pending}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        filtersActive={activeFilters}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        taskSort={taskSort}
        onTaskSortChange={setTaskSort}
        hiddenColumnKeys={hiddenColumnKeys}
        onHiddenColumnKeysChange={setHiddenColumnKeys}
        initialCustomColumns={initialCustomColumns}
      />

      <section className="mb-6 border-b border-[var(--border)] pb-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex w-full max-w-xl items-center justify-between rounded-hs border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left shadow-card transition hover:border-[var(--border-2)]"
          aria-expanded={filtersOpen}
        >
          <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--ink)]">
            <IconFunnel className="text-[var(--ink-2)]" />
            Filter-Details
            {activeFilters ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--accent-ink)]">
                Aktiv
              </span>
            ) : null}
          </span>
          <span className="text-[12px] font-semibold text-[var(--muted)]">
            {filtersOpen ? "Einklappen" : "Aufklappen"}
          </span>
        </button>
        <div
          className={`grid max-w-xl transition-[grid-template-rows] duration-200 ease-out ${
            filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-3 rounded-hs border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
              <div className="flex flex-col gap-3">
                <label className="hs-field">
                  <span className="hs-field-label">Suche</span>
                  <input
                    value={draft.q}
                    onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                    placeholder="Name, Notizen, Thema…"
                    className="hs-input w-full"
                  />
                </label>
                <label className="hs-field">
                  <span className="hs-field-label">Status (exakt)</span>
                  <input
                    value={draft.status || ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, status: e.target.value || null }))
                    }
                    placeholder="z. B. In Progress"
                    className="hs-input w-full"
                  />
                </label>
                <label className="hs-field">
                  <span className="hs-field-label">Thema enthält</span>
                  <input
                    value={draft.topic || ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, topic: e.target.value || null }))
                    }
                    placeholder="z. B. Ops"
                    className="hs-input w-full"
                  />
                </label>
                <label className="hs-field">
                  <span className="hs-field-label">Person (Zugewiesen, enthält)</span>
                  <input
                    value={draft.assignee || ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, assignee: e.target.value.trim() || null }))
                    }
                    placeholder="z. B. Anna"
                    className="hs-input w-full"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={applyFilters}
                    disabled={pending}
                    className="hs-btn hs-btn-primary disabled:pointer-events-none disabled:opacity-50"
                  >
                    {pending ? "Wird angewendet…" : "Filter anwenden"}
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={pending}
                    className="hs-btn hs-btn-ghost disabled:pointer-events-none disabled:opacity-50"
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-2 min-w-0">
        <MainTableView
          mode="tasks"
          initialTasks={initialTasks}
          enableRealtime
          taskFilters={applied}
          initialCustomColumns={initialCustomColumns}
          initialMergedWidths={initialMergedWidths}
          layoutSyncKey={layoutSyncKey}
          departmentId={departmentId}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          hiddenColumnKeys={hiddenColumnKeys}
          taskSort={taskSort}
          suppressBuiltInGroupUi
        />
      </div>
    </div>
  );
}
