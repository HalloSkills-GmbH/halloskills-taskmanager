"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { APP_SIDEBAR_NAV_TAG } from "@/lib/supabase/sidebar-nav";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { DEFAULT_DEPARTMENT_BOARD_KANBAN_COLUMNS } from "@/lib/department-board";
import type { DepartmentBoardColumn } from "@/types/departments";

const boardColumnSchema = z.array(
  z.object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(80),
  }),
);

function revalidateWorkspace() {
  revalidateTag(APP_SIDEBAR_NAV_TAG);
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
  const { data: boardRow, error } = await supabase
    .from("department_boards")
    .insert({
      department_id: departmentId,
      name: "Hauptboard",
      sort_order: 0,
      column_config: DEFAULT_DEPARTMENT_BOARD_KANBAN_COLUMNS,
      is_group: false,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[workspace] Standard-Board:", error.message);
    return;
  }
  if (boardRow?.id) {
    const { error: pErr } = await supabase.from("board_projects").insert({
      board_id: boardRow.id as string,
      name: "Allgemein",
      sort_order: 0,
    });
    if (pErr) {
      console.error("[workspace] Standard-Projekt (Hauptboard):", pErr.message);
    }
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
  if (!parsed.data.isGroup) {
    insertData.column_config = DEFAULT_DEPARTMENT_BOARD_KANBAN_COLUMNS;
  }
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
  const newBoardId = data.id as string;
  if (!parsed.data.isGroup) {
    const { data: proj, error: pErr } = await supabase
      .from("board_projects")
      .insert({
        board_id: newBoardId,
        name: "Allgemein",
        sort_order: 0,
      })
      .select("id")
      .single();
    if (pErr) {
      console.error("[workspace] Standard-Projekt:", pErr.message);
    } else if (proj?.id) {
      const projectId = proj.id as string;
      const deptId = parsed.data.departmentId;
      const { data: maxRow } = await supabase
        .from("tasks")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextId = (maxRow?.id ?? 0) + 1;
      const base = {
        item_kind: "task" as const,
        department_id: deptId,
        project_id: projectId,
        status: "Planned",
        progress: 0,
        parent_id: null,
        okr_objective_id: null,
        okr_key_result_id: null,
        start_date: null,
        end_date: null,
        assigned: null,
        notes: null,
        dependencies: [] as number[],
        attachments: [] as unknown[],
        custom_fields: {} as Record<string, unknown>,
      };
      const topic1 = "Gruppe 1";
      const topic2 = "Gruppe 2";
      const seedRows: Record<string, unknown>[] = [];
      for (let i = 1; i <= 4; i++) {
        seedRows.push({
          ...base,
          id: nextId++,
          name: `Aufgabe ${i}`,
          topic: topic1,
        });
      }
      for (let i = 1; i <= 2; i++) {
        seedRows.push({
          ...base,
          id: nextId++,
          name: `Aufgabe ${i}`,
          topic: topic2,
        });
      }
      const { error: seedErr } = await supabase.from("tasks").insert(seedRows);
      if (seedErr) {
        console.error("[workspace] Board-Beispielaufgaben:", seedErr.message);
      }
    }
  }
  revalidateWorkspace();
  return { ok: true, id: newBoardId, isGroup: parsed.data.isGroup };
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

export async function reorderSidebarBoards(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      departmentId: z.string().uuid(),
      parentId: z.string().uuid().nullable(),
      orderedIds: z.array(z.string().uuid()).min(1),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { departmentId, parentId, orderedIds } = parsed.data;
  const supabase = await createClient();

  const { data: rows, error: fetchErr } = await supabase
    .from("department_boards")
    .select("id, department_id, parent_id, is_group")
    .in("id", orderedIds);
  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!rows || rows.length !== orderedIds.length) {
    return { ok: false, message: "Boards nicht vollständig gefunden" };
  }

  for (const row of rows) {
    if (row.is_group) {
      return { ok: false, message: "Nur Boards dürfen sortiert werden" };
    }
    if (row.department_id !== departmentId) {
      return { ok: false, message: "Abteilung passt nicht" };
    }
    const rowParent = row.parent_id ?? null;
    if (rowParent !== parentId) {
      return { ok: false, message: "Eltern-Ordner passt nicht" };
    }
  }

  const updates = orderedIds.map((id, i) =>
    supabase.from("department_boards").update({ sort_order: i }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, message: failed.error.message };
  }
  revalidateWorkspace();
  return { ok: true };
}

export async function updateBoardParent(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      boardId: z.string().uuid(),
      parentId: z.string().uuid().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("department_boards")
    .update({ parent_id: parsed.data.parentId })
    .eq("id", parsed.data.boardId);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}

export async function updateDepartment(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      icon: z.string().max(50).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      sort_order: z.number().int().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name.trim();
  if (parsed.data.icon) updateData.icon = parsed.data.icon;
  if (parsed.data.color) updateData.color = parsed.data.color;
  if (parsed.data.sort_order !== undefined) updateData.sort_order = parsed.data.sort_order;
  
  if (Object.keys(updateData).length === 0) {
    return { ok: true };
  }
  
  const { error } = await supabase
    .from("departments")
    .update(updateData)
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}

export async function deleteDepartment(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}

export async function updateDepartmentBoard(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      icon: z.string().max(50).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      sort_order: z.number().int().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name.trim();
  if (parsed.data.icon) updateData.icon = parsed.data.icon;
  if (parsed.data.color) updateData.color = parsed.data.color;
  if (parsed.data.sort_order !== undefined) updateData.sort_order = parsed.data.sort_order;
  
  if (Object.keys(updateData).length === 0) {
    return { ok: true };
  }
  
  const { error } = await supabase
    .from("department_boards")
    .update(updateData)
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}

export async function deleteDepartmentBoard(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("department_boards")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidateWorkspace();
  return { ok: true };
}
