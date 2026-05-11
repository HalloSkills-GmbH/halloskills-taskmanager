"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { taskInsertSchema, taskUpdateSchema } from "@/lib/validators/task-update";

function revalidateOkr() {
  revalidatePath("/dashboard");
  revalidatePath("/d", "layout");
  revalidatePath("/okrs/table");
  revalidatePath("/okrs/kanban");
  revalidatePath("/okrs/gantt");
  revalidatePath("/okrs/calendar");
  revalidatePath("/okrs", "layout");
  revalidatePath("/tasks");
  revalidatePath("/tasks/kanban");
  revalidatePath("/tasks/gantt");
  revalidatePath("/tasks/calendar");
  revalidatePath("/board");
}

export async function updateTaskFields(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { id, ...rest } = parsed.data;
  const patch = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) {
    return { ok: false, message: error.message };
  }
  revalidateOkr();
  return { ok: true };
}

export async function insertTaskRow(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = taskInsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const supabase = await createClient();

  let taskId = parsed.data.id;
  if (!taskId) {
    const { data: maxRow } = await supabase
      .from("tasks")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    taskId = (maxRow?.id ?? 0) + 1;
  }

  const parentId = parsed.data.parent_id ?? null;
  let sortOrder = parsed.data.sort_order;
  if (sortOrder === undefined) {
    let q = supabase.from("tasks").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    if (parentId === null) {
      q = q.is("parent_id", null);
    } else {
      q = q.eq("parent_id", parentId);
    }
    const { data: maxSort } = await q.maybeSingle();
    sortOrder = (maxSort?.sort_order ?? -1) + 1;
  }

  const row = {
    ...parsed.data,
    id: taskId,
    sort_order: sortOrder,
    dependencies: parsed.data.dependencies ?? [],
    attachments: parsed.data.attachments ?? [],
    progress: parsed.data.progress ?? 0,
    status: parsed.data.status ?? "Planned",
    custom_fields: parsed.data.custom_fields ?? {},
  };

  const { error } = await supabase.from("tasks").insert(row);
  if (error) {
    return { ok: false, message: error.message };
  }
  revalidateOkr();
  return { ok: true };
}

export async function deleteTaskRow(
  id: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const nid = z.coerce.number().int().positive().safeParse(id);
  if (!nid.success) {
    return { ok: false, message: "Ungültige ID" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", nid.data);
  if (error) {
    return { ok: false, message: error.message };
  }
  revalidateOkr();
  return { ok: true };
}

const reorderTasksSchema = z.object({
  updates: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      sort_order: z.coerce.number().int().min(0),
    }),
  ),
});

export async function reorderTaskRows(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = reorderTasksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  for (const u of parsed.data.updates) {
    const { error } = await supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id);
    if (error) return { ok: false, message: error.message };
  }
  revalidateOkr();
  return { ok: true };
}
