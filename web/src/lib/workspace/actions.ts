"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import type { DepartmentBoardColumn } from "@/types/departments";

const boardColumnSchema = z.array(
  z.object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(80),
  }),
);

function revalidateWorkspace() {
  revalidatePath("/dashboard");
  revalidatePath("/d", "layout");
  revalidatePath("/tasks", "layout");
  revalidatePath("/okrs", "layout");
  revalidatePath("/board");
}

async function insertDefaultDepartmentBoard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
) {
  const { error } = await supabase.from("department_boards").insert({
    department_id: departmentId,
    name: "Hauptboard",
    sort_order: 0,
  });
  if (error) {
    console.error("[workspace] Standard-Board:", error.message);
  }
}

export async function createDepartment(
  input: unknown,
): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const parsed = z.object({ name: z.string().min(1).max(120) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const base = slugify(parsed.data.name);
  const supabase = await createClient();

  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data: existing } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${i + 2}`;
  }

  const { data: dept, error } = await supabase
    .from("departments")
    .insert({
      name: parsed.data.name.trim(),
      slug,
      sort_order: 0,
    })
    .select("id,slug")
    .single();
  if (error || !dept?.id) {
    return { ok: false, message: error?.message || "Abteilung konnte nicht angelegt werden" };
  }
  await insertDefaultDepartmentBoard(supabase, dept.id as string);
  revalidateWorkspace();
  return { ok: true, slug: dept.slug as string };
}

export async function createDepartmentBoard(
  input: unknown,
): Promise<{ ok: true; id: string; isGroup: boolean } | { ok: false; message: string }> {
  const parsed = z
    .object({
      departmentId: z.string().uuid(),
      name: z.string().min(1).max(120),
      isGroup: z.boolean().optional().default(false),
      parentId: z.string().uuid().nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const insertData: Record<string, unknown> = {
    department_id: parsed.data.departmentId,
    name: parsed.data.name.trim(),
    sort_order: 0,
    is_group: parsed.data.isGroup,
  };
  if (parsed.data.parentId) {
    insertData.parent_id = parsed.data.parentId;
  }
  const { data, error } = await supabase
    .from("department_boards")
    .insert(insertData)
    .select("id")
    .single();
  if (error || !data?.id) {
    return { ok: false, message: error?.message || "Insert fehlgeschlagen" };
  }
  revalidateWorkspace();
  return { ok: true, id: data.id as string, isGroup: parsed.data.isGroup };
}

export async function updateDepartmentBoardColumns(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      boardId: z.string().uuid(),
      columns: boardColumnSchema,
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const cols = parsed.data.columns as DepartmentBoardColumn[];
  const { error } = await supabase
    .from("department_boards")
    .update({ column_config: cols })
    .eq("id", parsed.data.boardId);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}

export async function createBoardProject(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = z
    .object({
      boardId: z.string().uuid(),
      name: z.string().min(1).max(120),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("board_projects")
    .select("sort_order")
    .eq("board_id", parsed.data.boardId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = maxRow?.sort_order != null ? (maxRow.sort_order as number) + 1 : 0;
  const { data, error } = await supabase
    .from("board_projects")
    .insert({
      board_id: parsed.data.boardId,
      name: parsed.data.name.trim(),
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    return { ok: false, message: error?.message || "Projekt konnte nicht angelegt werden" };
  }
  revalidateWorkspace();
  return { ok: true, id: data.id as string };
}

export async function deleteBoardProject(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      boardId: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_projects")
    .delete()
    .eq("id", parsed.data.projectId)
    .eq("board_id", parsed.data.boardId);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}
