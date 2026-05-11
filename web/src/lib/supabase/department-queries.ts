import type {
  BoardProjectRow,
  DepartmentBoardRow,
  DepartmentRow,
} from "@/types/departments";
import { createClient } from "@/lib/supabase/server";

export async function fetchDepartmentBySlug(slug: string): Promise<DepartmentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return data as DepartmentRow;
}

export async function fetchDepartmentBoardForDept(
  boardId: string,
  departmentId: string,
): Promise<DepartmentBoardRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("department_boards")
    .select("*")
    .eq("id", boardId)
    .eq("department_id", departmentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as DepartmentBoardRow;
}

/** Board-Projekte der Abteilung für OKR-Tabelle (Aufgaben ↔ Kanban). */
export type BoardProjectOption = { id: string; label: string };

export async function fetchBoardProjectOptionsForDepartment(
  departmentId: string,
): Promise<BoardProjectOption[]> {
  const supabase = await createClient();
  const { data: boards, error: bErr } = await supabase
    .from("department_boards")
    .select("id,name")
    .eq("department_id", departmentId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (bErr || !boards?.length) return [];
  const boardIds = boards.map((b) => b.id as string);
  const { data: projects, error: pErr } = await supabase
    .from("board_projects")
    .select("id,name,board_id")
    .in("board_id", boardIds)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (pErr || !projects?.length) return [];
  const names = new Map(boards.map((b) => [b.id as string, b.name as string]));
  return projects.map((p) => ({
    id: p.id as string,
    label: `${names.get(p.board_id as string) ?? "Board"} · ${p.name as string}`,
  }));
}

export async function fetchBoardProjects(boardId: string): Promise<BoardProjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_projects")
    .select("*")
    .eq("board_id", boardId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as BoardProjectRow[];
}
