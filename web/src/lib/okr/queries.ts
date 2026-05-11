import type { TaskRow } from "@/types/tasks";
import type { OkrFilters } from "./filters";

export function normalizeItemKind(row: TaskRow): string {
  return (row.item_kind || "task").toLowerCase();
}

function inDateRange(row: TaskRow, from?: string | null, to?: string | null): boolean {
  const s = row.start_date;
  const e = row.end_date || row.start_date;
  if (!s) return true;
  if (from && s < from) return false;
  if (to && e && e > to) return false;
  if (to && !e && s > to) return false;
  return true;
}

/** Zeilen für OKR-Ansichten: Objectives, Key Results, optional verknüpfte operative Tasks. */
export function filterRowsForOkrView(rows: TaskRow[], filters: OkrFilters): TaskRow[] {
  const q = filters.q.trim().toLowerCase();
  const matchQ = (r: TaskRow) => {
    if (!q) return true;
    const hay = `${r.name} ${r.notes || ""} ${r.topic || ""} ${r.assigned || ""}`.toLowerCase();
    return hay.includes(q);
  };

  let base: TaskRow[];
  switch (filters.type) {
    case "objective":
      base = rows.filter((r) => normalizeItemKind(r) === "objective");
      break;
    case "key_result":
      base = rows.filter((r) => normalizeItemKind(r) === "key_result");
      break;
    case "task":
      base = rows.filter(
        (r) =>
          (normalizeItemKind(r) === "task" || !r.item_kind) &&
          r.okr_key_result_id != null,
      );
      break;
    default:
      base = rows.filter((r) => {
        const k = normalizeItemKind(r);
        if (k === "objective" || k === "key_result") return true;
        return (k === "task" || !r.item_kind) && r.okr_key_result_id != null;
      });
  }

  return base.filter((r) => {
    if (!matchQ(r)) return false;
    if (filters.team && (r.assigned || "") !== filters.team) return false;
    if (filters.status && (r.status || "") !== filters.status) return false;
    if (!inDateRange(r, filters.from, filters.to)) return false;
    return true;
  });
}

export function isOperationalRow(row: TaskRow): boolean {
  const k = normalizeItemKind(row);
  return !k || k === "task";
}

export function filterOperationalRows(rows: TaskRow[]): TaskRow[] {
  return rows.filter(isOperationalRow);
}

/** Strikte Filterung nach Abteilung (UUID). */
export function filterRowsByDepartmentId(rows: TaskRow[], departmentId: string): TaskRow[] {
  return rows.filter((r) => r.department_id === departmentId);
}

/** Operative Aufgaben, deren project_id zu einem Board-Projekt gehört (leeres Array → keine Zeilen). */
export function filterRowsByBoardProjects(rows: TaskRow[], projectIds: string[]): TaskRow[] {
  if (!projectIds.length) return [];
  const set = new Set(projectIds);
  return filterOperationalRows(rows).filter(
    (r) => r.project_id != null && set.has(r.project_id),
  );
}
