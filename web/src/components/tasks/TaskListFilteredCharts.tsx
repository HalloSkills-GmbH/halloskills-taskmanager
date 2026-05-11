"use client";

import { filterRowsByDepartmentId } from "@/lib/okr/queries";
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
): TaskRow[] {
  let r = filterTaskListRows(rows, filters);
  if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
  return r;
}

/** Gantt mit URL-Filtern der Aufgabenliste (`q`, `status`, `topic`). Optional Abteilungsfilter für Realtime. */
export function TaskListFilteredGantt({
  initialRows,
  departmentId = null,
}: {
  initialRows: TaskRow[];
  departmentId?: string | null;
}) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseTaskListFilters(searchParams), [searchParams]);
  const initialFiltered = useMemo(
    () => applyTaskListAndDept(initialRows, filters, departmentId),
    [initialRows, filters, departmentId],
  );
  const project = useCallback(
    (all: TaskRow[]) => applyTaskListAndDept(all, filters, departmentId),
    [filters, departmentId],
  );
  return <TaskGanttView initialRows={initialFiltered} project={project} variant="operational" />;
}

/** Kalender mit denselben URL-Filtern. */
export function TaskListFilteredCalendar({
  initialRows,
  departmentId = null,
}: {
  initialRows: TaskRow[];
  departmentId?: string | null;
}) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseTaskListFilters(searchParams), [searchParams]);
  const initialFiltered = useMemo(
    () => applyTaskListAndDept(initialRows, filters, departmentId),
    [initialRows, filters, departmentId],
  );
  const project = useCallback(
    (all: TaskRow[]) => applyTaskListAndDept(all, filters, departmentId),
    [filters, departmentId],
  );
  return <TaskCalendarView initialRows={initialFiltered} project={project} variant="operational" />;
}
