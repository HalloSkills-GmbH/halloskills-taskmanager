import { OkrTableClient } from "@/components/okr/OkrTableClient";
import { parseOkrFilters } from "@/lib/okr/filters";
import { recordToURLSearchParams } from "@/lib/okr/search-params";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import {
  fetchBoardProjectOptionsForDepartment,
  fetchDepartmentBySlug,
} from "@/lib/supabase/department-queries";
import { fetchAssigneeOptions } from "@/lib/profiles/actions";
import { createClient } from "@/lib/supabase/server";
import { MAIN_TABLE_TASK_SELECT } from "@/lib/tasks/task-row-select";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import { notFound } from "next/navigation";

export default async function DepartmentOkrsTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ deptSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const raw = await searchParams;
  const filters = parseOkrFilters(recordToURLSearchParams(raw));
  const supabase = await createClient();

  const [tasksRes, colsRes, layoutRes] = await Promise.all([
    supabase.from("tasks").select(MAIN_TABLE_TASK_SELECT).eq("department_id", dept.id).order("id"),
    supabase.from("task_custom_columns").select("*").order("sort_order", { ascending: true }),
    supabase.from("main_table_layout").select("*").eq("view_key", "okr").maybeSingle(),
  ]);

  const all = (tasksRes.data ?? []) as TaskRow[];
  const customCols = (colsRes.error ? [] : colsRes.data ?? []) as TaskCustomColumnRow[];
  const layoutRow = (layoutRes.error ? null : layoutRes.data) as MainTableLayoutRow | null;
  const cw = layoutRow?.column_widths;
  const storedWidths =
    cw && typeof cw === "object" && !Array.isArray(cw)
      ? (cw as Record<string, number>)
      : undefined;
  const merged = mergeLayoutWidths("okr", storedWidths, customCols);
  const layoutSyncKey = `${layoutRow?.updated_at ?? "0"}:${customCols.map((c) => c.id).join(",")}`;
  const [boardProjectOptions, assigneeOptions] = await Promise.all([
    fetchBoardProjectOptionsForDepartment(dept.id),
    fetchAssigneeOptions(),
  ]);

  return (
    <div>
      {tasksRes.error ? (
        <p className="mb-4 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm font-medium text-[#8A6A12]">
          {tasksRes.error.message}
        </p>
      ) : null}
      <OkrTableClient
        initialAll={all}
        filters={filters}
        initialCustomColumns={customCols}
        initialMergedWidths={merged}
        layoutSyncKey={layoutSyncKey}
        departmentId={dept.id}
        boardProjectOptions={boardProjectOptions}
        initialColumnOrder={layoutRow?.column_order ?? null}
        initialGroupSort={layoutRow?.group_sort ?? null}
        assigneeOptions={assigneeOptions}
      />
    </div>
  );
}
