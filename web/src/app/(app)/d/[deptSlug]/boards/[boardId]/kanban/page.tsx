import { notFound } from "next/navigation";
import { BoardProjectsAndKanban } from "@/components/workspace/BoardProjectsAndKanban";
import { parseBoardColumnConfig } from "@/lib/department-board";
import { fetchBoardProjects, fetchDepartmentBoardForDept, fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentBoardKanbanPage({
  params,
}: {
  params: Promise<{ deptSlug: string; boardId: string }>;
}) {
  const { deptSlug, boardId } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const board = await fetchDepartmentBoardForDept(boardId, dept.id);
  if (!board || board.is_group) notFound();

  const supabase = await createClient();
  const projects = await fetchBoardProjects(boardId);
  const projectIds = projects.map((p) => p.id);

  let initialBoardTasks: TaskRow[] = [];
  let tasksError: { message: string } | null = null;
  if (projectIds.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .in("project_id", projectIds)
      .order("id");
    initialBoardTasks = (data ?? []) as TaskRow[];
    tasksError = error;
  }

  const { data: maxRow } = await supabase
    .from("tasks")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextTaskId = maxRow?.id != null ? (maxRow.id as number) + 1 : 1;
  const columns = parseBoardColumnConfig(board.column_config);

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Kanban für <strong>{board.name}</strong> — Projekte und operative Aufgaben mit Board-Projekt.
      </p>
      {tasksError ? (
        <p className="mb-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          {tasksError.message}
        </p>
      ) : null}
      <BoardProjectsAndKanban
        boardId={board.id}
        departmentId={dept.id}
        initialProjects={projects}
        initialBoardTasks={initialBoardTasks}
        columns={columns}
        nextTaskId={nextTaskId}
      />
    </div>
  );
}
