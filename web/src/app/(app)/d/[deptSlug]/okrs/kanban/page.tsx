import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OkrFilteredKanban } from "@/components/okr/OkrFilteredKanban";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentOkrsKanbanPage({
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
  const all = (data ?? []) as TaskRow[];

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        OKR-Kanban nur für <strong>{dept.name}</strong> — dieselben Filter wie unter OKRs.
      </p>
      {error ? (
        <p className="mb-6 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm font-medium text-[#8A6A12]">
          {error.message}
        </p>
      ) : null}
      <Suspense fallback={<div className="text-sm text-[var(--muted)]">Kanban wird geladen…</div>}>
        <OkrFilteredKanban initialAll={all} departmentId={dept.id} />
      </Suspense>
    </div>
  );
}
