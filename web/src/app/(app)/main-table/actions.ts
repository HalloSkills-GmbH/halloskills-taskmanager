"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  COL,
  TASKS_PERSISTABLE_BUILTIN_KEYS,
  customColWidthKey,
  defaultMainTableColumnKeys,
  defaultWidthForCustomColType,
} from "@/lib/tasks/main-table-columns";

const widthsSchema = z.record(z.string(), z.number().min(32).max(800));

/** Muss mit task_custom_columns_col_type_check (Migration 011) übereinstimmen. */
const COLUMN_TYPES = ["text", "date", "status", "dropdown", "person", "priority"] as const;

const addColumnSchema = z.object({
  label: z.string().min(1).max(80),
  col_type: z.enum(COLUMN_TYPES),
  status_options: z.array(z.string().min(1).max(80)).max(20).optional(),
  dropdown_options: z.array(z.string().min(1).max(80)).max(20).optional(),
  priority_options: z.array(z.string().min(1).max(80)).max(10).optional(),
});

function revalidateMainTableViews() {
  revalidatePath("/tasks");
  revalidatePath("/okrs/table");
  revalidatePath("/d", "layout");
}

type LayoutRowNormalized = {
  column_widths: Record<string, number>;
  builtin_column_labels: Record<string, string>;
  builtin_columns_hidden: string[];
  column_order: string[] | null;
  group_sort: { topic?: string[]; status?: string[] } | null;
};

function normalizeLayoutRowData(data: Record<string, unknown> | null | undefined): LayoutRowNormalized {
  const cw = data?.column_widths;
  const labels = data?.builtin_column_labels;
  const hidden = data?.builtin_columns_hidden;
  const co = data?.column_order;
  const gs = data?.group_sort;
  let group_sort: { topic?: string[]; status?: string[] } | null = null;
  if (gs && typeof gs === "object" && !Array.isArray(gs)) {
    const o = gs as Record<string, unknown>;
    const topic = Array.isArray(o.topic)
      ? o.topic.filter((x): x is string => typeof x === "string")
      : undefined;
    const status = Array.isArray(o.status)
      ? o.status.filter((x): x is string => typeof x === "string")
      : undefined;
    if ((topic?.length ?? 0) > 0 || (status?.length ?? 0) > 0) {
      group_sort = {};
      if (topic?.length) group_sort.topic = topic;
      if (status?.length) group_sort.status = status;
    }
  }
  return {
    column_widths:
      cw && typeof cw === "object" && !Array.isArray(cw) ? (cw as Record<string, number>) : {},
    builtin_column_labels:
      labels && typeof labels === "object" && !Array.isArray(labels)
        ? (labels as Record<string, string>)
        : {},
    builtin_columns_hidden: Array.isArray(hidden)
      ? hidden.filter((x): x is string => typeof x === "string")
      : [],
    column_order:
      Array.isArray(co) && co.every((x): x is string => typeof x === "string") ? co : null,
    group_sort,
  };
}

async function loadMainTableLayoutForView(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewKey: string,
): Promise<LayoutRowNormalized> {
  const { data } = await supabase
    .from("main_table_layout")
    .select("*")
    .eq("view_key", viewKey)
    .maybeSingle();
  return normalizeLayoutRowData(data as Record<string, unknown> | null | undefined);
}

async function upsertMainTableLayoutRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewKey: string,
  row: LayoutRowNormalized,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("main_table_layout").upsert(
    {
      view_key: viewKey,
      column_widths: row.column_widths,
      builtin_column_labels: row.builtin_column_labels,
      builtin_columns_hidden: row.builtin_columns_hidden,
      column_order: row.column_order,
      group_sort: row.group_sort,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "view_key" },
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

type TasksLayoutPatchRow = LayoutRowNormalized;

async function loadTasksMainLayout(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<TasksLayoutPatchRow> {
  return loadMainTableLayoutForView(supabase, "tasks");
}

async function upsertTasksMainLayoutPatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patch: Partial<LayoutRowNormalized>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cur = await loadTasksMainLayout(supabase);
  const next: LayoutRowNormalized = {
    column_widths: patch.column_widths ?? cur.column_widths,
    builtin_column_labels: patch.builtin_column_labels ?? cur.builtin_column_labels,
    builtin_columns_hidden: patch.builtin_columns_hidden ?? cur.builtin_columns_hidden,
    column_order: patch.column_order !== undefined ? patch.column_order : cur.column_order,
    group_sort: patch.group_sort !== undefined ? patch.group_sort : cur.group_sort,
  };
  return upsertMainTableLayoutRow(supabase, "tasks", next);
}

export async function setTasksBuiltinColumnLabel(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({ colKey: z.string(), label: z.string().max(80) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { colKey, label } = parsed.data;
  if (
    colKey === COL.grab ||
    colKey === COL.name ||
    !TASKS_PERSISTABLE_BUILTIN_KEYS.has(colKey)
  ) {
    return { ok: false, message: "Diese Spalte kann nicht umbenannt werden" };
  }
  const supabase = await createClient();
  const cur = await loadTasksMainLayout(supabase);
  const next = { ...cur.builtin_column_labels };
  const t = label.trim();
  if (!t) delete next[colKey];
  else next[colKey] = t;
  const res = await upsertTasksMainLayoutPatch(supabase, { builtin_column_labels: next });
  if (!res.ok) return res;
  revalidateMainTableViews();
  return { ok: true };
}

export async function setTasksBuiltinColumnsHidden(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z.object({ hiddenKeys: z.array(z.string()) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  for (const k of parsed.data.hiddenKeys) {
    if (!TASKS_PERSISTABLE_BUILTIN_KEYS.has(k)) {
      return { ok: false, message: "Ungültige oder nicht ausblendbare Spalte" };
    }
  }
  const dedup = [...new Set(parsed.data.hiddenKeys)];
  const supabase = await createClient();
  const res = await upsertTasksMainLayoutPatch(supabase, { builtin_columns_hidden: dedup });
  if (!res.ok) return res;
  revalidateMainTableViews();
  return { ok: true };
}

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
  const cur = await loadMainTableLayoutForView(supabase, vk.data);
  const res = await upsertMainTableLayoutRow(supabase, vk.data, {
    ...cur,
    column_widths: w.data,
  });
  if (!res.ok) return res;
  revalidatePath("/tasks");
  revalidatePath("/okrs/table");
  return { ok: true };
}

function sameColumnKeySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  if (s.size !== a.length) return false;
  for (const x of b) {
    if (!s.has(x)) return false;
  }
  return true;
}

export async function saveMainTableColumnOrder(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      viewKey: z.enum(["tasks", "okr"]),
      keys: z.array(z.string()),
      includeOkrBoardProject: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { data: cols, error: cErr } = await supabase
    .from("task_custom_columns")
    .select("*")
    .order("sort_order", { ascending: true });
  if (cErr) return { ok: false, message: cErr.message };
  const customCols = (cols ?? []) as import("@/types/main-table").TaskCustomColumnRow[];
  const expected = defaultMainTableColumnKeys(
    parsed.data.viewKey,
    customCols,
    parsed.data.viewKey === "okr" && parsed.data.includeOkrBoardProject,
  );
  if (!sameColumnKeySet(expected, parsed.data.keys)) {
    return { ok: false, message: "Spaltenfolge stimmt nicht mit der aktuellen Tabelle überein" };
  }
  const cur = await loadMainTableLayoutForView(supabase, parsed.data.viewKey);
  const res = await upsertMainTableLayoutRow(supabase, parsed.data.viewKey, {
    ...cur,
    column_order: parsed.data.keys,
  });
  if (!res.ok) return res;
  revalidateMainTableViews();
  return { ok: true };
}

export async function saveMainTableGroupSort(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      viewKey: z.enum(["tasks", "okr"]).optional(),
      groupSort: z.object({
        topic: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(),
      }),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const viewKey = parsed.data.viewKey ?? "tasks";
  const gs = parsed.data.groupSort;
  const nextGs =
    (gs.topic?.length ?? 0) > 0 || (gs.status?.length ?? 0) > 0
      ? {
          ...(gs.topic?.length ? { topic: gs.topic } : {}),
          ...(gs.status?.length ? { status: gs.status } : {}),
        }
      : null;
  const cur = await loadMainTableLayoutForView(supabase, viewKey);
  const res = await upsertMainTableLayoutRow(supabase, viewKey, {
    ...cur,
    group_sort: nextGs,
  });
  if (!res.ok) return res;
  revalidateMainTableViews();
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

  const wk = customColWidthKey(col_key);
  const defaultW = defaultWidthForCustomColType(col_type);
  for (const vk of ["tasks", "okr"] as const) {
    const layoutCur = await loadMainTableLayoutForView(supabase, vk);
    if (layoutCur.column_widths[wk] != null) continue;
    const layoutRes = await upsertMainTableLayoutRow(supabase, vk, {
      ...layoutCur,
      column_widths: { ...layoutCur.column_widths, [wk]: defaultW },
    });
    if (!layoutRes.ok) {
      console.error("[main-table] Breite neue Spalte:", layoutRes.message);
    }
  }

  revalidateMainTableViews();
  return { ok: true, col_key };
}

const renameColumnSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
});

export async function renameTaskCustomColumn(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = renameColumnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_custom_columns")
    .update({ label: parsed.data.label.trim() })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidateMainTableViews();
  return { ok: true };
}

const deleteColumnSchema = z.object({ id: z.string().uuid() });

export async function deleteTaskCustomColumn(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = deleteColumnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("task_custom_columns").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };

  revalidateMainTableViews();
  return { ok: true };
}
