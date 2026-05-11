-- RLS Phase 1: Nur authentifizierte Nutzer (JWT role authenticated) dürfen tasks lesen/schreiben.
-- Anonyme Requests (anon) ohne gültige Session erhalten keine Zeilen mehr.
-- Später: Policies auf org_id / owner_id verschärfen, wenn euer Rechte-Tool angebunden ist.

alter table public.tasks enable row level security;

-- Bestehende Policies idempotent entfernen (Namenskonvention)
drop policy if exists "tasks_select_authenticated" on public.tasks;
drop policy if exists "tasks_insert_authenticated" on public.tasks;
drop policy if exists "tasks_update_authenticated" on public.tasks;
drop policy if exists "tasks_delete_authenticated" on public.tasks;

create policy "tasks_select_authenticated"
  on public.tasks for select
  to authenticated
  using (true);

create policy "tasks_insert_authenticated"
  on public.tasks for insert
  to authenticated
  with check (true);

create policy "tasks_update_authenticated"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

create policy "tasks_delete_authenticated"
  on public.tasks for delete
  to authenticated
  using (true);

-- Sicherstellen, dass die App-Rolle die Tabelle nutzen darf (Supabase-Projekte haben das oft schon)
grant select, insert, update, delete on public.tasks to authenticated;
