-- Spalten für Board-Gruppen in department_boards
ALTER TABLE department_boards
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES department_boards(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_department_boards_parent ON department_boards(parent_id);
