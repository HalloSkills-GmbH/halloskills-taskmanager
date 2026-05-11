-- Jedes Abteilung erhält mindestens ein Standard-Board, falls noch keins existiert.

insert into public.department_boards (department_id, name, sort_order)
select d.id, 'Hauptboard', 0
from public.departments d
where not exists (
  select 1 from public.department_boards b where b.department_id = d.id
);
