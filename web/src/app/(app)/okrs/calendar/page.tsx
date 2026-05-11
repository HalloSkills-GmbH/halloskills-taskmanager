import { OkrFilteredCalendar } from "@/components/okr/OkrFilteredCharts";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function OkrsCalendarPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("id");
  const all = (data ?? []) as TaskRow[];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight text-app-ink">Monatskalender</h2>
        <p className="mt-1 text-sm font-medium text-app-text">
          Einträge nach Zeitraum — Filter kommen aus der gemeinsamen Leiste oben.
        </p>
      </div>
      {error ? (
        <p className="mb-4 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm font-medium text-[#8A6A12]">
          {error.message}
        </p>
      ) : null}
      <OkrFilteredCalendar initialAll={all} />
    </div>
  );
}
