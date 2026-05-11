"use client";

import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { TaskGanttView } from "@/components/tasks/TaskGanttView";
import { filterRowsByDepartmentId, filterRowsForOkrView } from "@/lib/okr/queries";
import { useOkrFiltersFromUrl } from "@/lib/okr/useOkrFiltersFromUrl";
import type { TaskRow } from "@/types/tasks";
import { useCallback, useMemo } from "react";

/** Gantt mit URL-Filtern; Realtime wendet dieselbe `filterRowsForOkrView`-Logik auf die volle Tabelle an. */
export function OkrFilteredGantt({
  initialAll,
  departmentId = null,
}: {
  initialAll: TaskRow[];
  departmentId?: string | null;
}) {
  const filters = useOkrFiltersFromUrl();
  const initialFiltered = useMemo(() => {
    let r = filterRowsForOkrView(initialAll, filters);
    if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
    return r;
  }, [initialAll, filters, departmentId]);
  const project = useCallback(
    (all: TaskRow[]) => {
      let r = filterRowsForOkrView(all, filters);
      if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
      return r;
    },
    [filters, departmentId],
  );
  return <TaskGanttView initialRows={initialFiltered} project={project} />;
}

export function OkrFilteredCalendar({
  initialAll,
  departmentId = null,
}: {
  initialAll: TaskRow[];
  departmentId?: string | null;
}) {
  const filters = useOkrFiltersFromUrl();
  const initialFiltered = useMemo(() => {
    let r = filterRowsForOkrView(initialAll, filters);
    if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
    return r;
  }, [initialAll, filters, departmentId]);
  const project = useCallback(
    (all: TaskRow[]) => {
      let r = filterRowsForOkrView(all, filters);
      if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
      return r;
    },
    [filters, departmentId],
  );
  return <TaskCalendarView initialRows={initialFiltered} project={project} />;
}
