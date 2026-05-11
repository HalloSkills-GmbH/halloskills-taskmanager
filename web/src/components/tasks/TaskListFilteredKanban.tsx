"use client";

import { filterRowsByBoardProjects, filterRowsByDepartmentId } from "@/lib/okr/queries";
import { filterTaskListRows, parseTaskListFilters } from "@/lib/tasks/filters";
import type { TaskRow } from "@/types/tasks";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { TaskBoardView } from "./TaskBoardView";

function applyFilters(
  rows: TaskRow[],
  filters: ReturnType<typeof parseTaskListFilters>,
  departmentId: string | null | undefined,
  restrictProjectIds?: string[],
): TaskRow[] {
  let r = filterTaskListRows(rows, filters);
  if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
  if (restrictProjectIds !== undefined) {
    r = filterRowsByBoardProjects(r, restrictProjectIds);
  }
  return r;
}

/** Kanban mit URL-Filtern der Aufgabenliste; optional Abteilung. */
export function TaskListFilteredKanban({
  initialRows,
  departmentId = null,
  restrictProjectIds,
}: {
  initialRows: TaskRow[];
  departmentId?: string | null;
  restrictProjectIds?: string[];
}) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseTaskListFilters(searchParams), [searchParams]);
  const initialFiltered = useMemo(
    () => applyFilters(initialRows, filters, departmentId, restrictProjectIds),
    [initialRows, filters, departmentId, restrictProjectIds],
  );
  const rowProjection = useCallback(
    (all: TaskRow[]) => applyFilters(all, filters, departmentId, restrictProjectIds),
    [filters, departmentId, restrictProjectIds],
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
