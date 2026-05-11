"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
  tasksPathPrefix = "/tasks",
}: {
  initialTasks: TaskRow[];
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  layoutSyncKey: string;
  departmentId?: string | null;
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

  return (
    <div className="hs-page mx-auto max-w-[1680px]">
      <TasksMonoToolbar
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

      <div className="min-w-0">
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
