"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BOARD_CONFIG_DEFAULT_STATUSES, loadBoardColumnConfig } from "@/lib/board-config/queries";
import type { BoardColumnConfig } from "@/types/profiles";

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
  revalidatePath("/tasks");
  revalidatePath("/d", "layout");
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

  const config: BoardColumnConfig = await loadBoardColumnConfig(
    parsed.data.board_id,
    parsed.data.column_key,
  );
  const statuses = config.statuses ?? BOARD_CONFIG_DEFAULT_STATUSES;
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

  const config: BoardColumnConfig = await loadBoardColumnConfig(
    parsed.data.board_id,
    parsed.data.column_key,
  );
  const statuses = config.statuses ?? BOARD_CONFIG_DEFAULT_STATUSES;
  const idx = statuses.findIndex((s) => s.id === parsed.data.status_id);
  if (idx === -1) {
    return { ok: false, message: "Status nicht gefunden" };
  }

  if (parsed.data.label) statuses[idx]!.label = parsed.data.label;
  if (parsed.data.color) statuses[idx]!.color = parsed.data.color;

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

  const config: BoardColumnConfig = await loadBoardColumnConfig(
    parsed.data.board_id,
    parsed.data.column_key,
  );
  const statuses = (config.statuses ?? BOARD_CONFIG_DEFAULT_STATUSES).filter(
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
