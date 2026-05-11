-- Projekte innerhalb eines Abteilungs-Boards; Tasks optional einem Projekt zugeordnet
--
-- Voraussetzung: public.department_boards muss existieren (Migration 004_departments_and_boards.sql).
-- Reihenfolge: 001 → 002 → 003 → 004 → (005, 006 optional) → 007
-- Supabase: `supabase db push` oder alle SQL-Dateien in nummerierter Reihenfolge ausführen.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'department_boards'
  ) THEN
    RAISE EXCEPTION
      'public.department_boards fehlt. Zuerst Migration 004_departments_and_boards.sql ausführen, danach 007 erneut.';
  END IF;
END $$;

create table if not exists public.board_projects (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.department_boards (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.board_projects is 'Projekte innerhalb eines Kanban-Boards; Board-Kanban zeigt nur Tasks mit passender project_id';

create index if not exists board_projects_board_id_idx on public.board_projects (board_id);

alter table public.tasks
  add column if not exists project_id uuid null references public.board_projects (id) on delete set null;

create index if not exists tasks_project_id_idx on public.tasks (project_id);

alter table public.board_projects enable row level security;

drop policy if exists "board_projects_select_authenticated" on public.board_projects;
drop policy if exists "board_projects_insert_authenticated" on public.board_projects;
drop policy if exists "board_projects_update_authenticated" on public.board_projects;
drop policy if exists "board_projects_delete_authenticated" on public.board_projects;

create policy "board_projects_select_authenticated"
  on public.board_projects for select to authenticated using (true);

create policy "board_projects_insert_authenticated"
  on public.board_projects for insert to authenticated with check (true);

create policy "board_projects_update_authenticated"
  on public.board_projects for update to authenticated using (true) with check (true);

create policy "board_projects_delete_authenticated"
  on public.board_projects for delete to authenticated using (true);

grant select, insert, update, delete on public.board_projects to authenticated;
