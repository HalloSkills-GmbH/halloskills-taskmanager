import { OkrFilteredCalendar } from "@/components/okr/OkrFilteredCharts";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";
import { notFound } from "next/navigation";

export default async function DepartmentOkrsCalendarPage({
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
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight text-app-ink">Kalender</h2>
        <p className="mt-1 text-sm font-medium text-app-text">Nur Zeilen dieser Abteilung.</p>
      </div>
      {error ? (
        <p className="mb-4 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm font-medium text-[#8A6A12]">
          {error.message}
        </p>
      ) : null}
      <OkrFilteredCalendar initialAll={all} departmentId={dept.id} />
    </div>
  );
}
