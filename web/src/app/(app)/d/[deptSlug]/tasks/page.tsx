import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeliverablesPageClient } from "@/components/tasks/DeliverablesPageClient";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import { fetchAssigneeOptions } from "@/lib/profiles/actions";
import { MAIN_TABLE_TASK_SELECT } from "@/lib/tasks/task-row-select";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import type { OkrContextEntry } from "@/components/tasks/MainTableView";

export default async function DepartmentTasksPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const supabase = await createClient();
  const [tasksRes, colsRes, layoutRes, okrRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(MAIN_TABLE_TASK_SELECT)
      .eq("department_id", dept.id)
      .in("item_kind", ["task", "deliverable"])
      .order("end_date", { ascending: true, nullsFirst: false }),
    supabase.from("task_custom_columns").select("*").order("sort_order", { ascending: true }),
    supabase.from("main_table_layout").select("*").eq("view_key", "deliverables").maybeSingle(),
    supabase
      .from("tasks")
      .select("id,name,item_kind,okr_objective_id,okr_key_result_id")
      .eq("department_id", dept.id)
      .in("item_kind", ["objective", "key_result"]),
  ]);

  const assigneeOptions = await fetchAssigneeOptions();
  const customCols = (colsRes.error ? [] : colsRes.data ?? []) as TaskCustomColumnRow[];
  const layoutRow = (layoutRes.error ? null : layoutRes.data) as MainTableLayoutRow | null;

  // Build OKR context map: taskId → { obj name, kr name }
  type OkrRow = { id: number; name: string; item_kind: string | null; okr_objective_id: number | null; okr_key_result_id: number | null };
  const okrRows = (okrRes.data ?? []) as OkrRow[];
  const objectivesById = new Map(okrRows.filter((r) => r.item_kind === "objective").map((r) => [r.id, r.name]));
  const keyResultsById = new Map(okrRows.filter((r) => r.item_kind === "key_result").map((r) => [r.id, r.name]));

  const okrContextMap = new Map<number, OkrContextEntry>();
  for (const t of (tasksRes.data ?? []) as TaskRow[]) {
    okrContextMap.set(t.id, {
      obj: t.okr_objective_id ? (objectivesById.get(t.okr_objective_id) ?? null) : null,
      kr: t.okr_key_result_id ? (keyResultsById.get(t.okr_key_result_id) ?? null) : null,
    });
  }

  const cw = layoutRow?.column_widths;
  const storedWidths =
    cw && typeof cw === "object" && !Array.isArray(cw)
      ? (cw as Record<string, number>)
      : undefined;
  const merged = mergeLayoutWidths("deliverables", storedWidths, customCols);
  const layoutSyncKey = `${layoutRow?.updated_at ?? "0"}:${customCols.map((c) => c.id).join(",")}`;

  return (
    <>
      {tasksRes.error ? (
        <div className="mx-auto max-w-[1600px] px-8 pt-8">
          <p className="rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
            {tasksRes.error.message}
          </p>
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1600px] px-8 py-14 text-sm font-medium text-app-muted">
            Deliverables werden geladen…
          </div>
        }
      >
        <DeliverablesPageClient
          initialTasks={(tasksRes.data as TaskRow[]) ?? []}
          initialCustomColumns={customCols}
          initialMergedWidths={merged}
          layoutSyncKey={layoutSyncKey}
          departmentId={dept.id}
          okrContextMap={okrContextMap}
          assigneeOptions={assigneeOptions}
        />
      </Suspense>
    </>
  );
}
