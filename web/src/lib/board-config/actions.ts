"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { BoardColumnConfigRow, BoardColumnConfig, StatusOption } from "@/types/profiles";

const DEFAULT_STATUSES: StatusOption[] = [
  { id: "not_started", label: "Not started", color: "#c4c4c4" },
  { id: "planned", label: "Planned", color: "#579bfc" },
  { id: "in_progress", label: "In Progress", color: "#fdab3d" },
  { id: "complete", label: "Complete", color: "#00c875" },
  { id: "blocked", label: "Blocked", color: "#e2445c" },
];

export async function fetchBoardColumnConfig(
  boardId: string,
  columnKey: string
): Promise<BoardColumnConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_column_config")
    .select("config")
    .eq("board_id", boardId)
    .eq("column_key", columnKey)
    .maybeSingle();
  
  if (error || !data) {
    return { statuses: DEFAULT_STATUSES };
  }
  
  const config = data.config as BoardColumnConfig;
  if (!config.statuses || config.statuses.length === 0) {
    config.statuses = DEFAULT_STATUSES;
  }
  return config;
}

export async function fetchAllBoardColumnConfigs(
  boardId: string
): Promise<Record<string, BoardColumnConfig>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_column_config")
    .select("column_key, config")
    .eq("board_id", boardId);
  
  if (error || !data) {
    return {};
  }
  
  const configs: Record<string, BoardColumnConfig> = {};
  for (const row of data as { column_key: string; config: BoardColumnConfig }[]) {
    configs[row.column_key] = row.config;
  }
  return configs;
}

export async function saveBoardColumnConfig(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      board_id: z.string().uuid(),
      column_key: z.string().min(1).max(100),
      config: z.object({
        statuses: z.array(z.object({
          id: z.string(),
          label: z.string(),
          color: z.string(),
        })).optional(),
        dropdownOptions: z.array(z.string()).optional(),
        priorityOptions: z.array(z.object({
          id: z.string(),
          label: z.string(),
          color: z.string(),
        })).optional(),
      }),
    })
    .safeParse(input);
  
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_column_config")
    .upsert(
      {
        board_id: parsed.data.board_id,
        column_key: parsed.data.column_key,
        config: parsed.data.config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board_id,column_key" }
    );
  
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function addStatusOption(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      board_id: z.string().uuid(),
      column_key: z.string(),
      status: z.object({
        id: z.string(),
        label: z.string(),
        color: z.string(),
      }),
    })
    .safeParse(input);
  
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  
  const config = await fetchBoardColumnConfig(parsed.data.board_id, parsed.data.column_key);
  const statuses = config.statuses ?? DEFAULT_STATUSES;
  statuses.push(parsed.data.status);
  
  return saveBoardColumnConfig({
    board_id: parsed.data.board_id,
    column_key: parsed.data.column_key,
    config: { ...config, statuses },
  });
}

export async function updateStatusOption(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      board_id: z.string().uuid(),
      column_key: z.string(),
      status_id: z.string(),
      label: z.string().optional(),
      color: z.string().optional(),
    })
    .safeParse(input);
  
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  
  const config = await fetchBoardColumnConfig(parsed.data.board_id, parsed.data.column_key);
  const statuses = config.statuses ?? DEFAULT_STATUSES;
  const idx = statuses.findIndex((s) => s.id === parsed.data.status_id);
  if (idx === -1) {
    return { ok: false, message: "Status nicht gefunden" };
  }
  
  if (parsed.data.label) statuses[idx].label = parsed.data.label;
  if (parsed.data.color) statuses[idx].color = parsed.data.color;
  
  return saveBoardColumnConfig({
    board_id: parsed.data.board_id,
    column_key: parsed.data.column_key,
    config: { ...config, statuses },
  });
}

export async function deleteStatusOption(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      board_id: z.string().uuid(),
      column_key: z.string(),
      status_id: z.string(),
    })
    .safeParse(input);
  
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  
  const config = await fetchBoardColumnConfig(parsed.data.board_id, parsed.data.column_key);
  const statuses = (config.statuses ?? DEFAULT_STATUSES).filter(
    (s) => s.id !== parsed.data.status_id
  );
  
  if (statuses.length === 0) {
    return { ok: false, message: "Mindestens ein Status muss existieren" };
  }
  
  return saveBoardColumnConfig({
    board_id: parsed.data.board_id,
    column_key: parsed.data.column_key,
    config: { ...config, statuses },
  });
}
