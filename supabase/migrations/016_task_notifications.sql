-- Benachrichtigungen für Aufgaben-Ereignisse
create table if not exists public.task_notifications (
  id          bigserial primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  task_id     bigint      not null references public.tasks(id) on delete cascade,
  actor_id    uuid        references auth.users(id) on delete set null,
  actor_name  text,
  type        text        not null check (type in ('note_added', 'task_changed', 'assigned')),
  message     text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists task_notifications_user_id_idx on public.task_notifications(user_id, created_at desc);
create index if not exists task_notifications_task_id_idx on public.task_notifications(task_id);

alter table public.task_notifications enable row level security;

create policy "Users see own notifications"
  on public.task_notifications for select
  using (auth.uid() = user_id);

create policy "Authenticated users can insert notifications"
  on public.task_notifications for insert
  with check (auth.role() = 'authenticated');

create policy "Users can mark own notifications as read"
  on public.task_notifications for update
  using (auth.uid() = user_id);
