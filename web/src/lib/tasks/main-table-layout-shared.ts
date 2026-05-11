import { COL } from "@/lib/tasks/main-table-columns";

/** Sichtbare Kernspalten für neue Boards: Aufgabe, Person, Status, Ende (ohne OKR, Thema, Start, Fortschritt, Anhang). */
export const BOARD_TASKS_DEFAULT_HIDDEN_COLUMNS: string[] = [
  COL.link,
  COL.topic,
  COL.start,
  COL.prog,
  COL.attach,
];

export function normalizeLayoutLabels(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export function normalizeLayoutHidden(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}
