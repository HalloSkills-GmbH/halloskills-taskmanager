import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TaskListFilteredKanban } from "@/components/tasks/TaskListFilteredKanban";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentTasksKanbanPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("department_id", dept.id)
    .order("id");
  const rows = (data ?? []) as TaskRow[];

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Kanban für <strong>{dept.name}</strong> — Filter wie in der Abteilungs-Tabelle.
      </p>
      {error ? (
        <p className="mb-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          {error.message}
        </p>
      ) : null}
      <Suspense fallback={<div className="text-sm text-app-muted">Kanban wird geladen…</div>}>
        <TaskListFilteredKanban initialRows={rows} departmentId={dept.id} />
      </Suspense>
    </div>
  );
}
