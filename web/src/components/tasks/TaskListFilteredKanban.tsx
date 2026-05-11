"use client";

import { filterRowsByDepartmentId } from "@/lib/okr/queries";
import { filterTaskListRows, parseTaskListFilters } from "@/lib/tasks/filters";
import type { TaskRow } from "@/types/tasks";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { TaskBoardView } from "./TaskBoardView";

function applyFilters(
  rows: TaskRow[],
  filters: ReturnType<typeof parseTaskListFilters>,
  departmentId: string | null | undefined,
): TaskRow[] {
  let r = filterTaskListRows(rows, filters);
  if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
  return r;
}

/** Kanban mit URL-Filtern der Aufgabenliste; optional Abteilung. */
export function TaskListFilteredKanban({
  initialRows,
  departmentId = null,
}: {
  initialRows: TaskRow[];
  departmentId?: string | null;
}) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseTaskListFilters(searchParams), [searchParams]);
  const initialFiltered = useMemo(
    () => applyFilters(initialRows, filters, departmentId),
    [initialRows, filters, departmentId],
  );
  const rowProjection = useCallback(
    (all: TaskRow[]) => applyFilters(all, filters, departmentId),
    [filters, departmentId],
  );
  return (
    <TaskBoardView
      initialRows={initialFiltered}
      rowProjection={rowProjection}
      variant="all"
      enableRealtime
    />
  );
}
