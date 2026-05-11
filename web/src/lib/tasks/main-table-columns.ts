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

/** Feste Spalten, deren Sichtbarkeit workspace-weit in main_table_layout gespeichert wird (nicht Board-lokal). */
export const TASKS_PERSISTABLE_BUILTIN_KEYS: ReadonlySet<string> = new Set([
  COL.grab,
  COL.person,
  COL.link,
  COL.topic,
  COL.status,
  COL.start,
  COL.end,
  COL.prog,
  COL.attach,
]);

/** Untere Grenze für Start/Ende und Custom-Datum, damit native Datumsfelder vollständig lesbar sind. */
export const MIN_WIDTH_DATE_COLUMN = 140;

export const DEFAULT_WIDTHS_TASKS: Record<string, number> = {
  [COL.grab]: 44,
  [COL.name]: 300,
  [COL.person]: 72,
  [COL.link]: 140,
  [COL.topic]: 120,
  [COL.status]: 136,
  [COL.start]: MIN_WIDTH_DATE_COLUMN,
  [COL.end]: MIN_WIDTH_DATE_COLUMN,
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

export function defaultWidthForCustomColType(
  colType: TaskCustomColumnRow["col_type"],
): number {
  switch (colType) {
    case "date":
      return MIN_WIDTH_DATE_COLUMN;
    case "status":
      return DEFAULT_WIDTHS_TASKS[COL.status];
    case "person":
      return DEFAULT_WIDTHS_TASKS[COL.person];
    case "dropdown":
      return 128;
    case "priority":
      return 104;
    case "text":
    default:
      return 110;
  }
}

/** Standard-Spaltenfolge (ohne gespeicherte Permutation). */
export function defaultMainTableColumnKeys(
  mode: "tasks" | "okr",
  customColumns: TaskCustomColumnRow[],
  includeOkrBoardProject: boolean,
): string[] {
  const keys: string[] = [COL.grab, COL.name];
  if (mode === "okr") keys.push(COL.tipo);
  keys.push(COL.person, COL.link);
  if (mode === "okr" && includeOkrBoardProject) keys.push(COL.boardProj);
  keys.push(COL.topic);
  keys.push(COL.status, COL.start, COL.end, COL.prog, COL.attach);
  for (const c of [...customColumns].sort((a, b) => a.sort_order - b.sort_order)) {
    keys.push(customColWidthKey(c.col_key));
  }
  if (mode === "okr") keys.push(COL.actions);
  return keys;
}

/** Wendet gespeicherte `column_order` auf die aktuelle Standardfolge an (fehlende Keys hinten anfügen). */
export function applyStoredColumnOrder(
  defaultKeys: string[],
  stored: string[] | null | undefined,
): string[] {
  if (!stored?.length) return defaultKeys;
  const allowed = new Set(defaultKeys);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of stored) {
    if (allowed.has(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  for (const k of defaultKeys) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
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
    if (base[wk] == null) base[wk] = defaultWidthForCustomColType(c.col_type);
  }

  const floorDate = (key: string) => {
    const w = base[key];
    if (w != null && w < MIN_WIDTH_DATE_COLUMN) base[key] = MIN_WIDTH_DATE_COLUMN;
  };
  floorDate(COL.start);
  floorDate(COL.end);
  for (const c of customColumns) {
    if (c.col_type === "date") floorDate(customColWidthKey(c.col_key));
  }

  return base;
}

export function gridTemplateFromWidths(orderedKeys: string[], widths: Record<string, number>): string {
  return orderedKeys.map((k) => `${widths[k] ?? 80}px`).join(" ");
}
