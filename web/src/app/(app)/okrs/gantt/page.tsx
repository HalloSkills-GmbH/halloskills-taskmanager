import { OkrFilteredGantt } from "@/components/okr/OkrFilteredCharts";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function OkrsGanttPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("id");
  const all = (data ?? []) as TaskRow[];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight text-app-ink">Zeitleiste</h2>
        <p className="mt-1 text-sm font-medium text-app-text">
          Gefiltert über dieselbe URL wie Tabelle und Kalender.
        </p>
      </div>
      {error ? (
        <p className="mb-4 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm font-medium text-[#8A6A12]">
          {error.message}
        </p>
      ) : null}
      <OkrFilteredGantt initialAll={all} />
    </div>
  );
}
