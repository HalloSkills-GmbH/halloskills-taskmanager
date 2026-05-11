-- Standard-Abteilungen (Sidebar-Reihenfolge). ON CONFLICT: keine Überschreibung bestehender Namen.
insert into public.departments (name, slug, sort_order)
values
  ('Marketing', 'marketing', 0),
  ('Sales', 'sales', 1),
  ('Customer Success', 'customer-success', 2),
  ('Produkt', 'produkt', 3),
  ('Zertifizierung', 'zertifizierung', 4),
  ('IT', 'it', 5)
on conflict (slug) do nothing;
