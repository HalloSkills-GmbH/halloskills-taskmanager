/** Zeile in public.task_custom_columns */
export type TaskCustomColumnRow = {
  id: string;
  col_key: string;
  label: string;
  col_type: "text" | "date" | "status" | "dropdown" | "person" | "priority";
  status_options: string[] | null;
  sort_order: number;
  created_at: string;
};

/** Zeile in public.main_table_layout */
export type MainTableLayoutRow = {
  view_key: string;
  column_widths: Record<string, number>;
  updated_at: string;
  /** Optionale Kopfzeilen für feste Spalten (Aufgaben-Ansicht). */
  builtin_column_labels?: Record<string, string> | null;
  builtin_columns_hidden?: string[] | null;
  column_order?: string[] | null;
  group_sort?: { topic?: string[]; status?: string[] } | null;
};
