import { createClient } from "@/lib/supabase/server";
import type { BoardColumnConfig, StatusOption } from "@/types/profiles";

export const BOARD_CONFIG_DEFAULT_STATUSES: StatusOption[] = [
  { id: "not_started", label: "Not started", color: "#c4c4c4" },
  { id: "planned", label: "Planned", color: "#579bfc" },
  { id: "in_progress", label: "In Progress", color: "#fdab3d" },
  { id: "complete", label: "Complete", color: "#00c875" },
  { id: "blocked", label: "Blocked", color: "#e2445c" },
];

/** Nur Server (RSC / Route Handlers); kein Client-Import. */
export async function loadBoardColumnConfig(
  boardId: string,
  columnKey: string,
): Promise<BoardColumnConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_column_config")
    .select("config")
    .eq("board_id", boardId)
    .eq("column_key", columnKey)
    .maybeSingle();

  if (error || !data) {
    return { statuses: BOARD_CONFIG_DEFAULT_STATUSES };
  }

  const config = data.config as BoardColumnConfig;
  if (!config.statuses || config.statuses.length === 0) {
    config.statuses = BOARD_CONFIG_DEFAULT_STATUSES;
  }
  return config;
}

export async function loadAllBoardColumnConfigs(
  boardId: string,
): Promise<Record<string, BoardColumnConfig> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_column_config")
    .select("column_key, config")
    .eq("board_id", boardId);

  if (error) {
    console.error("[loadAllBoardColumnConfigs]", error.message);
    return null;
  }

  if (!data) {
    return {};
  }

  const configs: Record<string, BoardColumnConfig> = {};
  for (const row of data as { column_key: string; config: BoardColumnConfig }[]) {
    configs[row.column_key] = row.config;
  }
  return configs;
}

export function boardStatusesRecordFromConfigs(
  configs: Record<string, BoardColumnConfig> | null,
): Record<string, StatusOption[]> {
  if (!configs) return {};
  const next: Record<string, StatusOption[]> = {};
  for (const [colKey, cfg] of Object.entries(configs)) {
    const st = cfg?.statuses;
    if (Array.isArray(st) && st.length > 0) next[colKey] = st;
  }
  return next;
}
