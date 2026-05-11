"use client";

import { filterRowsByBoardProjects, filterRowsByDepartmentId } from "@/lib/okr/queries";
import { filterTaskListRows, parseTaskListFilters } from "@/lib/tasks/filters";
import type { TaskRow } from "@/types/tasks";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { TaskCalendarView } from "./TaskCalendarView";
import { TaskGanttView } from "./TaskGanttView";

function applyTaskListAndDept(
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

/** Gantt mit URL-Filtern der Aufgabenliste (`q`, `status`, `topic`). Optional Abteilungsfilter für Realtime. */
export function TaskListFilteredGantt({
  initialRows,
  departmentId = null,
  restrictProjectIds,
}: {
  initialRows: TaskRow[];
  departmentId?: string | null;
  /** Gesetzt: nur Aufgaben mit diesem project_id (Board-Ansicht). */
  restrictProjectIds?: string[];
}) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseTaskListFilters(searchParams), [searchParams]);
  const initialFiltered = useMemo(
    () => applyTaskListAndDept(initialRows, filters, departmentId, restrictProjectIds),
    [initialRows, filters, departmentId, restrictProjectIds],
  );
  const project = useCallback(
    (all: TaskRow[]) => applyTaskListAndDept(all, filters, departmentId, restrictProjectIds),
    [filters, departmentId, restrictProjectIds],
  );
  return <TaskGanttView initialRows={initialFiltered} project={project} variant="operational" />;
}

/** Kalender mit denselben URL-Filtern. */
export function TaskListFilteredCalendar({
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
    () => applyTaskListAndDept(initialRows, filters, departmentId, restrictProjectIds),
    [initialRows, filters, departmentId, restrictProjectIds],
  );
  const project = useCallback(
    (all: TaskRow[]) => applyTaskListAndDept(all, filters, departmentId, restrictProjectIds),
    [filters, departmentId, restrictProjectIds],
  );
  return <TaskCalendarView initialRows={initialFiltered} project={project} variant="operational" />;
}
