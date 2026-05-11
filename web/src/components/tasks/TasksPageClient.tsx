"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  setTasksBuiltinColumnsHidden,
} from "@/app/(app)/main-table/actions";
import {
  parseTaskListFilters,
  serializeTaskListFilters,
  taskListFiltersActive,
  type TaskListFilters,
} from "@/lib/tasks/filters";
import { TASKS_PERSISTABLE_BUILTIN_KEYS } from "@/lib/tasks/main-table-columns";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { StatusOption } from "@/types/profiles";
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
  boardId = null,
  allowedProjectIds,
  defaultHiddenColumnKeys,
  hiddenColumnsStorageKey: hiddenColumnsStorageKeyProp,
  serverBuiltinColumnsHidden,
  serverBuiltinColumnLabels,
  departmentDefaultBoardId = null,
  initialColumnOrder = null,
  initialGroupSort = null,
  /** Board-Status-Paletten (Server), wenn ein Board für die Status-Konfiguration gilt. */
  initialBoardStatuses,
}: {
  initialTasks: TaskRow[];
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  layoutSyncKey: string;
  departmentId?: string | null;
  /** Basis-Pfad für Filter-Navigation (z. B. `/d/slug/tasks` oder Board-URL). */
  tasksPathPrefix?: string;
  /** Setzt `tableStorageScopeSuffix` auf der Tabelle (Board-ID). */
  boardId?: string | null;
  /** Nur Zeilen mit project_id in dieser Liste (Board). */
  allowedProjectIds?: string[];
  /** Wenn kein localStorage-Eintrag: diese Spalten ausblenden. */
  defaultHiddenColumnKeys?: string[];
  /** Eigener Schlüssel für Spalten-Sichtbarkeit (z. B. pro Board). */
  hiddenColumnsStorageKey?: string;
  /** Workspace-weit gespeicherte ausgeblendete feste Spalten (ohne Board-Ansicht). */
  serverBuiltinColumnsHidden?: string[];
  /** Gespeicherte Überschriften fester Spalten. */
  serverBuiltinColumnLabels?: Record<string, string>;
  /** Erstes Department-Board (`department_boards.id`) für Status-Konfiguration auf der Abteilungs-Aufgaben-Seite. */
  departmentDefaultBoardId?: string | null;
  /** Aus main_table_layout (Spaltenreihenfolge). */
  initialColumnOrder?: string[] | null;
  /** Aus main_table_layout (Gruppen-Reihenfolge). */
  initialGroupSort?: { topic?: string[]; status?: string[] } | null;
  /** Aus board_column_config (Status-Optionen pro Spalte), serverseitig geladen. */
  initialBoardStatuses?: Record<string, StatusOption[]>;
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

  const hideColStorageKey =
    hiddenColumnsStorageKeyProp ?? `main-tasks-hidden-${departmentId ?? "all"}`;
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>(() =>
    boardId ? defaultHiddenColumnKeys ?? [] : serverBuiltinColumnsHidden ?? [],
  );

  useEffect(() => {
    if (boardId) {
      try {
        const raw = localStorage.getItem(hideColStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
            setHiddenColumnKeys(parsed);
            return;
          }
        }
        setHiddenColumnKeys(defaultHiddenColumnKeys ?? []);
      } catch {
        setHiddenColumnKeys(defaultHiddenColumnKeys ?? []);
      }
      return;
    }

    try {
      const raw = localStorage.getItem(hideColStorageKey);
      let customHidden: string[] = [];
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          customHidden = parsed.filter((x) => x.startsWith("custom:"));
        }
      }
      const builtins = serverBuiltinColumnsHidden ?? [];
      setHiddenColumnKeys([...new Set([...builtins, ...customHidden])]);
    } catch {
      setHiddenColumnKeys([...(serverBuiltinColumnsHidden ?? [])]);
    }
  }, [boardId, hideColStorageKey, serverBuiltinColumnsHidden, defaultHiddenColumnKeys]);

  useEffect(() => {
    try {
      if (boardId) {
        localStorage.setItem(hideColStorageKey, JSON.stringify(hiddenColumnKeys));
      } else {
        const customOnly = hiddenColumnKeys.filter((k) => k.startsWith("custom:"));
        localStorage.setItem(hideColStorageKey, JSON.stringify(customOnly));
      }
    } catch {
      /* ignore */
    }
  }, [boardId, hideColStorageKey, hiddenColumnKeys]);

  const builtinSignature = useCallback(
    (keys: string[]) =>
      [...new Set(keys.filter((k) => TASKS_PERSISTABLE_BUILTIN_KEYS.has(k)))].sort().join("|"),
    [],
  );

  const handleHiddenColumnKeysChange = useCallback(
    (next: string[]) => {
      if (boardId) {
        setHiddenColumnKeys(next);
        return;
      }
      setHiddenColumnKeys((prev) => {
        if (builtinSignature(prev) !== builtinSignature(next)) {
          void setTasksBuiltinColumnsHidden({
            hiddenKeys: [...new Set(next.filter((k) => TASKS_PERSISTABLE_BUILTIN_KEYS.has(k)))],
          }).then((r) => {
            if (r.ok) router.refresh();
          });
        }
        return next;
      });
    },
    [boardId, builtinSignature, router],
  );

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

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
        defaultProjectIdForNewTasks={allowedProjectIds?.[0] ?? null}
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
        onHiddenColumnKeysChange={handleHiddenColumnKeysChange}
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
          onHiddenColumnKeysChange={handleHiddenColumnKeysChange}
          builtinColumnLabels={serverBuiltinColumnLabels ?? {}}
          taskSort={taskSort}
          suppressBuiltInGroupUi
          restrictProjectIds={allowedProjectIds}
          tableStorageScopeSuffix={boardId ?? undefined}
          defaultProjectIdForNewTasks={allowedProjectIds?.[0] ?? null}
          initialColumnOrder={initialColumnOrder ?? null}
          initialGroupSort={initialGroupSort ?? null}
          statusConfigBoardId={boardId ?? departmentDefaultBoardId ?? null}
          initialBoardStatuses={initialBoardStatuses}
        />
      </div>
    </div>
  );
}
