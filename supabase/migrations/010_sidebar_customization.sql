-- Anpassbare Icons und Farben für Sidebar-Elemente

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'building',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#579bfc';

ALTER TABLE department_boards
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'board',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#579bfc';

CREATE INDEX IF NOT EXISTS idx_departments_sort ON departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_department_boards_sort ON department_boards(sort_order);
