-- board_column_config: sicher anlegen, falls z. B. Migration 008 auf der Umgebung fehlte.
-- Referenz: department_boards muss existieren (Migration 004/009).

CREATE TABLE IF NOT EXISTS public.board_column_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.department_boards(id) ON DELETE CASCADE,
  column_key TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, column_key)
);

CREATE INDEX IF NOT EXISTS idx_board_column_config_board ON public.board_column_config(board_id);

ALTER TABLE public.board_column_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board column config ist für authentifizierte Benutzer sichtbar" ON public.board_column_config;
DROP POLICY IF EXISTS "Board column config kann von authentifizierten Benutzern verwaltet werden" ON public.board_column_config;

CREATE POLICY "Board column config ist für authentifizierte Benutzer sichtbar"
  ON public.board_column_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Board column config kann von authentifizierten Benutzern verwaltet werden"
  ON public.board_column_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_column_config TO authenticated;
