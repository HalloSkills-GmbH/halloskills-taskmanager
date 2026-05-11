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
