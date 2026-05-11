import { Suspense } from "react";
import { TaskListFilteredCalendar } from "@/components/tasks/TaskListFilteredCharts";
import { filterOperationalRows } from "@/lib/okr/queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function TasksCalendarPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("id");
  const all = (data ?? []) as TaskRow[];
  const operational = filterOperationalRows(all);

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Monatsraster mit Start- und Enddatum — Filter über die URL wie in der Aufgaben-Tabelle.
      </p>
      {error ? (
        <p className="mb-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          {error.message}
        </p>
      ) : null}
      <Suspense fallback={<div className="text-sm text-app-muted">Kalender wird geladen…</div>}>
        <TaskListFilteredCalendar initialRows={operational} />
      </Suspense>
    </div>
  );
}
