"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResultItem = {
  id: string;
  type: "task" | "okr" | "board";
  name: string;
  status?: string;
  departmentName?: string;
  departmentSlug?: string;
  boardName?: string;
  boardId?: string;
  itemKind?: string;
};

export type SearchResults = {
  tasks: SearchResultItem[];
  okrs: SearchResultItem[];
  boards: SearchResultItem[];
  total: number;
};

export async function globalSearch(query: string): Promise<SearchResults> {
  if (!query || query.trim().length < 2) {
    return { tasks: [], okrs: [], boards: [], total: 0 };
  }

  const q = query.trim().toLowerCase();
  const supabase = await createClient();

  const [tasksRes, boardsRes, deptsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, name, status, item_kind, project_id")
      .or(`name.ilike.%${q}%,notes.ilike.%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("department_boards")
      .select("id, name, department_id, is_group")
      .ilike("name", `%${q}%`)
      .eq("is_group", false)
      .order("name")
      .limit(10),
    supabase.from("departments").select("id, name, slug"),
  ]);

  const deptMap = new Map<string, { name: string; slug: string }>();
  if (deptsRes.data) {
    for (const d of deptsRes.data) {
      deptMap.set(d.id, { name: d.name, slug: d.slug });
    }
  }

  const boardMap = new Map<string, { name: string; deptId: string }>();
  if (boardsRes.data) {
    for (const b of boardsRes.data as { id: string; name: string; department_id: string }[]) {
      boardMap.set(b.id, { name: b.name, deptId: b.department_id });
    }
  }

  let projectBoardMap = new Map<string, string>();
  if (tasksRes.data) {
    const projectIds = [
      ...new Set(
        (tasksRes.data as { project_id?: string }[])
          .map((t) => t.project_id)
          .filter(Boolean) as string[]
      ),
    ];
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from("board_projects")
        .select("id, board_id")
        .in("id", projectIds);
      if (projects) {
        for (const p of projects as { id: string; board_id: string }[]) {
          projectBoardMap.set(p.id, p.board_id);
        }
      }
    }
  }

  const tasks: SearchResultItem[] = [];
  const okrs: SearchResultItem[] = [];

  if (tasksRes.data) {
    for (const t of tasksRes.data as {
      id: number;
      name: string;
      status?: string;
      item_kind?: string;
      project_id?: string;
    }[]) {
      const kind = (t.item_kind || "task").toLowerCase();
      const boardId = t.project_id ? projectBoardMap.get(t.project_id) : undefined;
      const boardInfo = boardId ? boardMap.get(boardId) : undefined;
      const deptInfo = boardInfo ? deptMap.get(boardInfo.deptId) : undefined;

      const item: SearchResultItem = {
        id: String(t.id),
        type: kind === "objective" || kind === "keyresult" ? "okr" : "task",
        name: t.name,
        status: t.status,
        itemKind: t.item_kind,
        boardId,
        boardName: boardInfo?.name,
        departmentName: deptInfo?.name,
        departmentSlug: deptInfo?.slug,
      };

      if (item.type === "okr") {
        okrs.push(item);
      } else {
        tasks.push(item);
      }
    }
  }

  const boards: SearchResultItem[] = [];
  if (boardsRes.data) {
    for (const b of boardsRes.data as {
      id: string;
      name: string;
      department_id: string;
    }[]) {
      const deptInfo = deptMap.get(b.department_id);
      boards.push({
        id: b.id,
        type: "board",
        name: b.name,
        departmentName: deptInfo?.name,
        departmentSlug: deptInfo?.slug,
      });
    }
  }

  return {
    tasks: tasks.slice(0, 10),
    okrs: okrs.slice(0, 10),
    boards,
    total: tasks.length + okrs.length + boards.length,
  };
}
