import { Suspense } from "react";
import { TaskListFilteredGantt } from "@/components/tasks/TaskListFilteredCharts";
import { filterOperationalRows } from "@/lib/okr/queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function TasksGanttPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("id");
  const all = (data ?? []) as TaskRow[];
  const operational = filterOperationalRows(all);

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Zeitstrahl für operative Aufgaben — dieselben URL-Parameter wie in der Tabelle (
        <code className="font-mono text-xs">q</code>, <code className="font-mono text-xs">status</code>
        , <code className="font-mono text-xs">topic</code>).
      </p>
      {error ? (
        <p className="mb-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          {error.message}
        </p>
      ) : null}
      <Suspense fallback={<div className="text-sm text-app-muted">Gantt wird geladen…</div>}>
        <TaskListFilteredGantt initialRows={operational} />
      </Suspense>
    </div>
  );
}
