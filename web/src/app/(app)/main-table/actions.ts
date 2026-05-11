"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const widthsSchema = z.record(z.string(), z.number().min(32).max(800));

const COLUMN_TYPES = [
  "text",
  "date",
  "status",
  "dropdown",
  "person",
  "number",
  "file",
  "checkbox",
  "formula",
  "timeline",
  "priority",
] as const;

const addColumnSchema = z.object({
  label: z.string().min(1).max(80),
  col_type: z.enum(COLUMN_TYPES),
  status_options: z.array(z.string().min(1).max(80)).max(20).optional(),
  dropdown_options: z.array(z.string().min(1).max(80)).max(20).optional(),
  priority_options: z.array(z.string().min(1).max(80)).max(10).optional(),
});

function slugFromLabel(label: string): string {
  const s = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, 36);
  return s || "spalte";
}

export async function saveMainTableColumnWidths(
  viewKey: unknown,
  widths: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const vk = z.enum(["tasks", "okr"]).safeParse(viewKey);
  if (!vk.success) return { ok: false, message: "Ungültige Ansicht" };
  const w = widthsSchema.safeParse(widths);
  if (!w.success) return { ok: false, message: w.error.message };

  const supabase = await createClient();
  const { error } = await supabase.from("main_table_layout").upsert(
    {
      view_key: vk.data,
      column_widths: w.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "view_key" },
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/tasks");
  revalidatePath("/okrs/table");
  return { ok: true };
}

export async function addTaskCustomColumn(
  input: unknown,
): Promise<{ ok: true; col_key: string } | { ok: false; message: string }> {
  const parsed = addColumnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { label, col_type, status_options, dropdown_options, priority_options } = parsed.data;
  if (col_type === "status" && (!status_options || status_options.length === 0)) {
    return { ok: false, message: "Status-Spalte braucht mindestens eine Option" };
  }
  if (col_type === "dropdown" && (!dropdown_options || dropdown_options.length === 0)) {
    return { ok: false, message: "Dropdown-Spalte braucht mindestens eine Option" };
  }
  if (col_type === "priority" && (!priority_options || priority_options.length === 0)) {
    return { ok: false, message: "Priorität-Spalte braucht mindestens eine Option" };
  }

  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("task_custom_columns")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const baseKey = slugFromLabel(label);
  const col_key = `${baseKey}_${Math.random().toString(36).slice(2, 7)}`;

  const optionsField = (() => {
    if (col_type === "status") return status_options ?? [];
    if (col_type === "dropdown") return dropdown_options ?? [];
    if (col_type === "priority") return priority_options ?? ["Niedrig", "Mittel", "Hoch", "Kritisch"];
    return null;
  })();

  const { error } = await supabase.from("task_custom_columns").insert({
    col_key,
    label: label.trim(),
    col_type,
    status_options: optionsField,
    sort_order: nextOrder,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/tasks");
  revalidatePath("/okrs/table");
  return { ok: true, col_key };
}
