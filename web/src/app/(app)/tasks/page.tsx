import { Suspense } from "react";
import { TasksPageClient } from "@/components/tasks/TasksPageClient";
import { normalizeLayoutHidden, normalizeLayoutLabels } from "@/lib/tasks/main-table-layout-shared";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import { createClient } from "@/lib/supabase/server";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";

export default async function TasksPage() {
  const supabase = await createClient();

  const [tasksRes, colsRes, layoutRes] = await Promise.all([
    supabase.from("tasks").select("*").order("id"),
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
  const serverBuiltinColumnsHidden = normalizeLayoutHidden(layoutRow?.builtin_columns_hidden);
  const serverBuiltinColumnLabels = normalizeLayoutLabels(layoutRow?.builtin_column_labels);

  return (
    <>
      {tasksRes.error ? (
        <div className="mx-auto max-w-[1600px] px-8 pt-8">
          <p className="rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
            Daten konnten nicht geladen werden: {tasksRes.error.message}
          </p>
        </div>
      ) : null}
      {colsRes.error ? (
        <div className="mx-auto max-w-[1600px] px-8 pt-4">
          <p className="rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm text-[#8A6A12]">
            Hinweis: Zusatzspalten nicht verfügbar ({colsRes.error.message}). Migration{" "}
            <code className="font-mono text-xs">003_main_table_custom_layout.sql</code> ausführen.
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
          serverBuiltinColumnsHidden={serverBuiltinColumnsHidden}
          serverBuiltinColumnLabels={serverBuiltinColumnLabels}
          initialColumnOrder={layoutRow?.column_order ?? null}
          initialGroupSort={layoutRow?.group_sort ?? null}
        />
      </Suspense>
    </>
  );
}
