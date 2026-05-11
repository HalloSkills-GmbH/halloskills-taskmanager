-- Abteilungen, abteilungsspezifische Boards, optionale Zuordnung von Aufgaben

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.departments is 'Organisationseinheiten für gefilterte Ansichten und Boards';

create table if not exists public.department_boards (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  column_config jsonb not null default '[
    {"id":"col-1","title":"Not started"},
    {"id":"col-2","title":"Planned"},
    {"id":"col-3","title":"In Progress"},
    {"id":"col-4","title":"Complete"}
  ]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.department_boards is 'Pro Abteilung mehrere Kanban-Boards mit konfigurierbaren Spalten (title = Task-Status)';
comment on column public.department_boards.column_config is 'JSON-Array: [{ "id": string, "title": string }]';

alter table public.tasks
  add column if not exists department_id uuid null references public.departments (id) on delete set null;

create index if not exists tasks_department_id_idx on public.tasks (department_id);

-- RLS (analog authenticated open workspace)
alter table public.departments enable row level security;
alter table public.department_boards enable row level security;

drop policy if exists "departments_select_authenticated" on public.departments;
drop policy if exists "departments_insert_authenticated" on public.departments;
drop policy if exists "departments_update_authenticated" on public.departments;
drop policy if exists "departments_delete_authenticated" on public.departments;

create policy "departments_select_authenticated"
  on public.departments for select to authenticated using (true);
create policy "departments_insert_authenticated"
  on public.departments for insert to authenticated with check (true);
create policy "departments_update_authenticated"
  on public.departments for update to authenticated using (true) with check (true);
create policy "departments_delete_authenticated"
  on public.departments for delete to authenticated using (true);

drop policy if exists "department_boards_select_authenticated" on public.department_boards;
drop policy if exists "department_boards_insert_authenticated" on public.department_boards;
drop policy if exists "department_boards_update_authenticated" on public.department_boards;
drop policy if exists "department_boards_delete_authenticated" on public.department_boards;

create policy "department_boards_select_authenticated"
  on public.department_boards for select to authenticated using (true);
create policy "department_boards_insert_authenticated"
  on public.department_boards for insert to authenticated with check (true);
create policy "department_boards_update_authenticated"
  on public.department_boards for update to authenticated using (true) with check (true);
create policy "department_boards_delete_authenticated"
  on public.department_boards for delete to authenticated using (true);

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.department_boards to authenticated;
