import type { TaskCustomColumnRow } from "@/types/main-table";

/** Feste Spalten-Schlüssel (Breiten-Persistenz + Resize). */
export const COL = {
  grab: "grab",
  name: "name",
  tipo: "tipo",
  person: "person",
  link: "link",
  topic: "topic",
  /** Abteilungs-OKR: Verknüpfung mit Board-Projekt (Kanban). */
  boardProj: "boardProj",
  status: "status",
  start: "start",
  end: "end",
  prog: "prog",
  attach: "attach",
  actions: "actions",
} as const;

export type BuiltInColKey = (typeof COL)[keyof typeof COL];

export const DEFAULT_WIDTHS_TASKS: Record<string, number> = {
  [COL.grab]: 44,
  [COL.name]: 300,
  [COL.person]: 72,
  [COL.link]: 140,
  [COL.topic]: 120,
  [COL.status]: 136,
  [COL.start]: 88,
  [COL.end]: 88,
  [COL.prog]: 100,
  [COL.attach]: 52,
};

export const DEFAULT_WIDTHS_OKR: Record<string, number> = {
  ...DEFAULT_WIDTHS_TASKS,
  [COL.tipo]: 80,
  [COL.boardProj]: 160,
  [COL.actions]: 72,
};

export function customColWidthKey(colKey: string): string {
  return `custom:${colKey}`;
}

export function mergeLayoutWidths(
  mode: "tasks" | "okr",
  stored: Record<string, number> | null | undefined,
  customColumns: TaskCustomColumnRow[],
): Record<string, number> {
  const base =
    mode === "okr"
      ? { ...DEFAULT_WIDTHS_OKR }
      : { ...DEFAULT_WIDTHS_TASKS };
  if (stored) {
    for (const [k, v] of Object.entries(stored)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 32) {
        base[k] = Math.min(800, v);
      }
    }
  }
  for (const c of customColumns) {
    const wk = customColWidthKey(c.col_key);
    if (base[wk] == null) base[wk] = 110;
  }
  return base;
}

export function gridTemplateFromWidths(orderedKeys: string[], widths: Record<string, number>): string {
  return orderedKeys.map((k) => `${widths[k] ?? 80}px`).join(" ");
}
