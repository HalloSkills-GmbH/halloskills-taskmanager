import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TasksPageClient } from "@/components/tasks/TasksPageClient";
import {
  boardStatusesRecordFromConfigs,
  loadAllBoardColumnConfigs,
} from "@/lib/board-config/queries";
import { normalizeLayoutHidden, normalizeLayoutLabels } from "@/lib/tasks/main-table-layout-shared";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import { MAIN_TABLE_TASK_SELECT } from "@/lib/tasks/task-row-select";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { StatusOption } from "@/types/profiles";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentTasksPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const supabase = await createClient();
  const [tasksRes, colsRes, layoutRes, boardRes] = await Promise.all([
    supabase.from("tasks").select(MAIN_TABLE_TASK_SELECT).eq("department_id", dept.id).order("id"),
    supabase.from("task_custom_columns").select("*").order("sort_order", { ascending: true }),
    supabase.from("main_table_layout").select("*").eq("view_key", "tasks").maybeSingle(),
    supabase
      .from("department_boards")
      .select("id")
      .eq("department_id", dept.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const customCols = (colsRes.error ? [] : colsRes.data ?? []) as TaskCustomColumnRow[];
  const layoutRow = (layoutRes.error ? null : layoutRes.data) as MainTableLayoutRow | null;
  const departmentDefaultBoardId = boardRes.error ? null : (boardRes.data?.id ?? null);

  let initialBoardStatuses: Record<string, StatusOption[]> = {};
  if (departmentDefaultBoardId) {
    const boardConfigs = await loadAllBoardColumnConfigs(departmentDefaultBoardId);
    initialBoardStatuses = boardStatusesRecordFromConfigs(boardConfigs);
  }

  const cw = layoutRow?.column_widths;
  const storedWidths =
    cw && typeof cw === "object" && !Array.isArray(cw)
      ? (cw as Record<string, number>)
      : undefined;
  const merged = mergeLayoutWidths("tasks", storedWidths, customCols);
  const layoutSyncKey = `${layoutRow?.updated_at ?? "0"}:${customCols.map((c) => c.id).join(",")}`;
  const serverBuiltinColumnsHidden = normalizeLayoutHidden(layoutRow?.builtin_columns_hidden);
  const serverBuiltinColumnLabels = normalizeLayoutLabels(layoutRow?.builtin_column_labels);

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
            Aufgaben werden geladen…
          </div>
        }
      >
        <TasksPageClient
          initialTasks={(tasksRes.data as TaskRow[]) ?? []}
          initialCustomColumns={customCols}
          initialMergedWidths={merged}
          layoutSyncKey={layoutSyncKey}
          departmentId={dept.id}
          tasksPathPrefix={`/d/${dept.slug}/tasks`}
          serverBuiltinColumnsHidden={serverBuiltinColumnsHidden}
          serverBuiltinColumnLabels={serverBuiltinColumnLabels}
          initialColumnOrder={layoutRow?.column_order ?? null}
          initialGroupSort={layoutRow?.group_sort ?? null}
          departmentDefaultBoardId={departmentDefaultBoardId}
          initialBoardStatuses={initialBoardStatuses}
        />
      </Suspense>
    </>
  );
}
