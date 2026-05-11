-- Anzeigenamen und Sichtbarkeit fester Aufgaben-Spalten (workspace-weit, view_key = tasks)

alter table public.main_table_layout
  add column if not exists builtin_column_labels jsonb not null default '{}'::jsonb;

alter table public.main_table_layout
  add column if not exists builtin_columns_hidden text[] not null default array[]::text[];

comment on column public.main_table_layout.builtin_column_labels is 'optionale Überschriften: Spalten-Schlüssel (person, topic, …) → Anzeigename';
comment on column public.main_table_layout.builtin_columns_hidden is 'ausgeblendete feste Spalten (Schlüssel wie person, topic, …)';
