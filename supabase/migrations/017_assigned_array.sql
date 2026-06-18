-- Migrate assigned from single uuid to uuid[] for multi-assignee support
-- Must drop the FK constraint first (uuid ≠ uuid[])
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_fkey;

ALTER TABLE public.tasks
  ALTER COLUMN assigned TYPE uuid[]
  USING CASE WHEN assigned IS NULL THEN NULL ELSE ARRAY[assigned::uuid] END;
