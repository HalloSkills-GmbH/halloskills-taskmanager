-- Benutzerdefinierte Spalten (Metadaten) + Zellenwerte in tasks.custom_fields (JSONB).
-- Tabellenlayout (Spaltenbreiten) workspace-weit, für Realtime-Sync.

alter table public.tasks
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

comment on column public.tasks.custom_fields is 'Werte für task_custom_columns.col_key → beliebiges JSON pro Spalte';

create table if not exists public.task_custom_columns (
  id uuid primary key default gen_random_uuid(),
  col_key text not null unique,
  label text not null,
  col_type text not null check (col_type in ('text', 'date', 'status')),
  status_options text[] null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.task_custom_columns is 'Definiert zusätzliche Spalten in der Haupttabelle (text, date, status)';

create table if not exists public.main_table_layout (
  view_key text primary key,
  column_widths jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.main_table_layout is 'Gespeicherte Spaltenbreiten (px) pro Ansicht: tasks | okr';

alter table public.task_custom_columns enable row level security;
alter table public.main_table_layout enable row level security;

drop policy if exists "task_custom_columns_select" on public.task_custom_columns;
drop policy if exists "task_custom_columns_insert" on public.task_custom_columns;
drop policy if exists "task_custom_columns_update" on public.task_custom_columns;
drop policy if exists "task_custom_columns_delete" on public.task_custom_columns;

create policy "task_custom_columns_select"
  on public.task_custom_columns for select to authenticated using (true);
create policy "task_custom_columns_insert"
  on public.task_custom_columns for insert to authenticated with check (true);
create policy "task_custom_columns_update"
  on public.task_custom_columns for update to authenticated using (true) with check (true);
create policy "task_custom_columns_delete"
  on public.task_custom_columns for delete to authenticated using (true);

drop policy if exists "main_table_layout_select" on public.main_table_layout;
drop policy if exists "main_table_layout_insert" on public.main_table_layout;
drop policy if exists "main_table_layout_update" on public.main_table_layout;
drop policy if exists "main_table_layout_delete" on public.main_table_layout;

create policy "main_table_layout_select"
  on public.main_table_layout for select to authenticated using (true);
create policy "main_table_layout_insert"
  on public.main_table_layout for insert to authenticated with check (true);
create policy "main_table_layout_update"
  on public.main_table_layout for update to authenticated using (true) with check (true);
create policy "main_table_layout_delete"
  on public.main_table_layout for delete to authenticated using (true);

grant select, insert, update, delete on public.task_custom_columns to authenticated;
grant select, insert, update, delete on public.main_table_layout to authenticated;

-- Realtime (Supabase: Publication „supabase_realtime“ muss existieren)
do $$
begin
  alter publication supabase_realtime add table public.main_table_layout;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.task_custom_columns;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
