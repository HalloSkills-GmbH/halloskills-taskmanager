-- Spaltenreihenfolge, Gruppensortierung, Aufgaben-Reihenfolge

alter table public.main_table_layout
  add column if not exists column_order jsonb;

alter table public.main_table_layout
  add column if not exists group_sort jsonb;

comment on column public.main_table_layout.column_order is 'Reihenfolge der Tabellenspalten (Array von Schlüsseln, z. B. name, custom:…)';
comment on column public.main_table_layout.group_sort is 'optionale Reihenfolge von Gruppen-Keys pro Modus: { "topic"?: string[], "status"?: string[] }';

alter table public.tasks
  add column if not exists sort_order int not null default 0;

comment on column public.tasks.sort_order is 'Sortierung unter gleichem parent_id (aufsteigend)';

create index if not exists idx_tasks_parent_sort on public.tasks (parent_id, sort_order, id);
