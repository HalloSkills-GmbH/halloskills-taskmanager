-- OKR-Felder für public.tasks (einmal im Supabase SQL Editor ausführen)
-- Semantik siehe Plan: item_kind objective | key_result | task

alter table public.tasks
  add column if not exists item_kind text default 'task';

alter table public.tasks
  add column if not exists okr_objective_id bigint null;

alter table public.tasks
  add column if not exists okr_key_result_id bigint null;

comment on column public.tasks.item_kind is 'task | objective | key_result';
comment on column public.tasks.okr_objective_id is 'Bei key_result: id der Objective-Zeile';
comment on column public.tasks.okr_key_result_id is 'Bei operativer task: optionale id des Key Result';
