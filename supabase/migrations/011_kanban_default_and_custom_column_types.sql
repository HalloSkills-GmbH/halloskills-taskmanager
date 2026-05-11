-- Kanban-Default: gleiche Schwimmbahn-Titel wie in der App (tasks.status muss passen).
-- Zusatzspalten: col_type-Check an die UI/Server-Actions anbinden.

ALTER TABLE public.department_boards
  ALTER COLUMN column_config SET DEFAULT '[
    {"id":"c1","title":"Not started"},
    {"id":"c2","title":"Planned"},
    {"id":"c3","title":"In Progress"},
    {"id":"c4","title":"Complete"}
  ]'::jsonb;

ALTER TABLE public.task_custom_columns
  DROP CONSTRAINT IF EXISTS task_custom_columns_col_type_check;

ALTER TABLE public.task_custom_columns
  ADD CONSTRAINT task_custom_columns_col_type_check
  CHECK (col_type IN ('text', 'date', 'status', 'dropdown', 'person', 'priority'));
