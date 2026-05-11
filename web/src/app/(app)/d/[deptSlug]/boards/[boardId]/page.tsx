import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TasksPageClient } from "@/components/tasks/TasksPageClient";
import {
  BOARD_TASKS_DEFAULT_HIDDEN_COLUMNS,
  normalizeLayoutLabels,
} from "@/lib/tasks/main-table-layout-shared";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import {
  boardStatusesRecordFromConfigs,
  loadAllBoardColumnConfigs,
} from "@/lib/board-config/queries";
import {
  fetchBoardProjects,
  fetchDepartmentBoardForDept,
  fetchDepartmentBySlug,
} from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentBoardDetailPage({
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
  const boardConfigs = await loadAllBoardColumnConfigs(board.id);
  const initialBoardStatuses = boardStatusesRecordFromConfigs(boardConfigs);

  const supabase = await createClient();
  const [tasksRes, colsRes, layoutRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("department_id", dept.id).order("id"),
    supabase.from("task_custom_columns").select("*").order("sort_order", { ascending: true }),
    supabase.from("main_table_layout").select("*").eq("view_key", "tasks").maybeSingle(),
  ]);

  const customCols = (colsRes.error ? [] : colsRes.data ?? []) as TaskCustomColumnRow[];
  const layoutRow = (layoutRes.error ? null : layoutRes.data) as MainTableLayoutRow | null;
  const cw = layoutRow?.column_widths;
  const storedWidths =
    cw && typeof cw === "object" && !Array.isArray(cw)
      ? (cw as Record<string, number>)
      : undefined;
  const merged = mergeLayoutWidths("tasks", storedWidths, customCols);
  const layoutSyncKey = `${layoutRow?.updated_at ?? "0"}:${customCols.map((c) => c.id).join(",")}`;
  const serverBuiltinColumnLabels = normalizeLayoutLabels(layoutRow?.builtin_column_labels);

  return (
    <>
      {tasksRes.error ? (
        <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pt-8">
          <p className="rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
            {tasksRes.error.message}
          </p>
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] py-14 text-sm font-medium text-app-muted">
            Board wird geladen…
          </div>
        }
      >
        <TasksPageClient
          initialTasks={(tasksRes.data as TaskRow[]) ?? []}
          initialCustomColumns={customCols}
          initialMergedWidths={merged}
          layoutSyncKey={layoutSyncKey}
          initialBoardStatuses={initialBoardStatuses}
          departmentId={dept.id}
          tasksPathPrefix={`/d/${dept.slug}/boards/${board.id}`}
          boardId={board.id}
          allowedProjectIds={projectIds}
          defaultHiddenColumnKeys={BOARD_TASKS_DEFAULT_HIDDEN_COLUMNS}
          hiddenColumnsStorageKey={`main-tasks-hidden-board-${board.id}`}
          serverBuiltinColumnLabels={serverBuiltinColumnLabels}
          initialColumnOrder={layoutRow?.column_order ?? null}
          initialGroupSort={layoutRow?.group_sort ?? null}
          departmentDefaultBoardId={board.id}
        />
      </Suspense>
    </>
  );
}
