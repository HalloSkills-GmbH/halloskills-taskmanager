import type { DepartmentBoardColumn } from "@/types/departments";

/** Kanban-Spalten für leeres / neues Board (`parseBoardColumnConfig`-Fallback). */
export const DEFAULT_BOARD_COLUMNS: DepartmentBoardColumn[] = [
  { id: "c1", title: "Not started" },
  { id: "c2", title: "Planned" },
  { id: "c3", title: "In Progress" },
  { id: "c4", title: "Complete" },
];

/**
 * Standard-`column_config` beim Anlegen von Abteilungs-Boards (INSERT).
 * `title` muss zu `tasks.status`-Werten passen, sonst landen Karten in der ersten Spalte.
 */
export const DEFAULT_DEPARTMENT_BOARD_KANBAN_COLUMNS: DepartmentBoardColumn[] = [...DEFAULT_BOARD_COLUMNS];

export function parseBoardColumnConfig(raw: unknown): DepartmentBoardColumn[] {
  if (!Array.isArray(raw)) return DEFAULT_BOARD_COLUMNS;
  const out: DepartmentBoardColumn[] = [];
  let i = 0;
  for (const x of raw) {
    if (x && typeof x === "object" && "title" in x) {
      const title = String((x as { title: unknown }).title || "").trim();
      if (!title) continue;
      const idRaw = (x as { id: unknown }).id;
      const id =
        typeof idRaw === "string" && idRaw.trim()
          ? idRaw.trim().slice(0, 64)
          : `c-${i}`;
      out.push({ id, title });
      i += 1;
    }
  }
  return out.length ? out : DEFAULT_BOARD_COLUMNS;
}
