/** Entspricht der Supabase-Tabelle public.tasks (snake_case). */
export type TaskRow = {
  id: number;
  name: string;
  topic: string | null;
  assigned: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  progress: number | null;
  parent_id: number | null;
  dependencies: number[] | null;
  attachments: unknown[] | null;
  notes: string | null;
  item_kind: string | null;
  okr_objective_id: number | null;
  okr_key_result_id: number | null;
  /** Werte für benutzerdefinierte Spalten (col_key → Wert); Spalte nach Migration 003. */
  custom_fields?: Record<string, unknown> | null;
  /** Optional: Abteilung (Migration 004). */
  department_id?: string | null;
  /** Optional: Projekt innerhalb eines Board-Kanban (Migration 007). */
  project_id?: string | null;
  /** Sortierung unter gleichem parent_id (Migration 013). */
  sort_order?: number | null;
};
