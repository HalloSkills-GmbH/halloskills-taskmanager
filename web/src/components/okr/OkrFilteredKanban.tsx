"use client";

import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { filterRowsByDepartmentId, filterRowsForOkrView } from "@/lib/okr/queries";
import { useOkrFiltersFromUrl } from "@/lib/okr/useOkrFiltersFromUrl";
import type { TaskRow } from "@/types/tasks";
import { useCallback, useMemo } from "react";

/** Kanban für die aktuellen OKR-URL-Filter (inkl. Abteilung). */
export function OkrFilteredKanban({
  initialAll,
  departmentId = null,
}: {
  initialAll: TaskRow[];
  departmentId?: string | null;
}) {
  const filters = useOkrFiltersFromUrl();
  const apply = useCallback(
    (rows: TaskRow[]) => {
      let r = filterRowsForOkrView(rows, filters);
      if (departmentId) r = filterRowsByDepartmentId(r, departmentId);
      return r;
    },
    [filters, departmentId],
  );
  const initialFiltered = useMemo(() => apply(initialAll), [initialAll, apply]);
  const rowProjection = useCallback((all: TaskRow[]) => apply(all), [apply]);

  return (
    <TaskBoardView
      initialRows={initialFiltered}
      rowProjection={rowProjection}
      variant="all"
      enableRealtime
    />
  );
}
