import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TaskListFilteredCalendar } from "@/components/tasks/TaskListFilteredCharts";
import { filterOperationalRows } from "@/lib/okr/queries";
import {
  fetchBoardProjects,
  fetchDepartmentBoardForDept,
  fetchDepartmentBySlug,
} from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentBoardCalendarPage({
  params,
}: {
  params: Promise<{ deptSlug: string; boardId: string }>;
}) {
  const { deptSlug, boardId } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const board = await fetchDepartmentBoardForDept(boardId, dept.id);
  if (!board || board.is_group) notFound();

  const projects = await fetchBoardProjects(boardId);
  const projectIds = projects.map((p) => p.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("department_id", dept.id)
    .order("id");
  const all = (data ?? []) as TaskRow[];
  const operational = filterOperationalRows(all);

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Kalender für <strong>{board.name}</strong> — Filter über die URL wie in der Board-Tabelle.
      </p>
      {error ? (
        <p className="mb-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          {error.message}
        </p>
      ) : null}
      <Suspense fallback={<div className="text-sm text-app-muted">Kalender wird geladen…</div>}>
        <TaskListFilteredCalendar
          initialRows={operational}
          departmentId={dept.id}
          restrictProjectIds={projectIds}
        />
      </Suspense>
    </div>
  );
}
