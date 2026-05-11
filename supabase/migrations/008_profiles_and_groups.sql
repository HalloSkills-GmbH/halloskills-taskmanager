-- Benutzer-Profile (verknüpft mit auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger für automatische Profil-Erstellung bei User-Registrierung
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Benutzer-Gruppen (Teams)
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#579bfc',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mitgliedschaften in Gruppen
CREATE TABLE IF NOT EXISTS user_group_members (
  group_id UUID REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Themen pro Department (für Gruppen-Titel in der Tabelle)
CREATE TABLE IF NOT EXISTS task_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#00c875',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Board-spezifische Spalten-Konfiguration (Status-Farben, etc.)
CREATE TABLE IF NOT EXISTS board_column_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES department_boards(id) ON DELETE CASCADE,
  column_key TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, column_key)
);

-- RLS für profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles sind für authentifizierte Benutzer sichtbar"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Benutzer können eigenes Profil bearbeiten"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS für user_groups
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User groups sind für authentifizierte Benutzer sichtbar"
  ON user_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "User groups können von authentifizierten Benutzern erstellt werden"
  ON user_groups FOR INSERT TO authenticated WITH CHECK (true);

-- RLS für user_group_members
ALTER TABLE user_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members sind für authentifizierte Benutzer sichtbar"
  ON user_group_members FOR SELECT TO authenticated USING (true);

-- RLS für task_topics
ALTER TABLE task_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Task topics sind für authentifizierte Benutzer sichtbar"
  ON task_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Task topics können von authentifizierten Benutzern verwaltet werden"
  ON task_topics FOR ALL TO authenticated USING (true);

-- RLS für board_column_config
ALTER TABLE board_column_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Board column config ist für authentifizierte Benutzer sichtbar"
  ON board_column_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Board column config kann von authentifizierten Benutzern verwaltet werden"
  ON board_column_config FOR ALL TO authenticated USING (true);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_topics_department ON task_topics(department_id);
CREATE INDEX IF NOT EXISTS idx_board_column_config_board ON board_column_config(board_id);

-- Bestehende Benutzer zu Profilen migrieren
INSERT INTO profiles (id, display_name, email)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), email
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;
