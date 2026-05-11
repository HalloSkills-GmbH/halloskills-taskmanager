/** Benutzer-Profil (verknüpft mit auth.users) */
export type ProfileRow = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
};

/** Benutzer-Gruppe (Team) */
export type UserGroupRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

/** Mitgliedschaft in einer Gruppe */
export type UserGroupMemberRow = {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

/** Thema für Tasks (Gruppen-Titel) */
export type TaskTopicRow = {
  id: string;
  department_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

/** Board-spezifische Spalten-Konfiguration */
export type BoardColumnConfigRow = {
  id: string;
  board_id: string;
  column_key: string;
  config: BoardColumnConfig;
  created_at: string;
  updated_at: string;
};

/** Status-Option für personalisierte Status-Spalten */
export type StatusOption = {
  id: string;
  label: string;
  color: string;
};

/** Konfiguration für eine Spalte */
export type BoardColumnConfig = {
  statuses?: StatusOption[];
  dropdownOptions?: string[];
  priorityOptions?: { id: string; label: string; color: string }[];
};

/** Für PersonPicker: Profil oder Gruppe */
export type AssigneeOption = {
  type: "profile" | "group";
  id: string;
  name: string;
  color?: string;
  avatarUrl?: string | null;
};
