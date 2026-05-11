import { Suspense } from "react";
import { OkrFilteredKanban } from "@/components/okr/OkrFilteredKanban";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function OkrsKanbanPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("id");
  const all = (data ?? []) as TaskRow[];

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--pad-x)] pb-14 pt-6">
      <p className="mb-6 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Kanban für die gefilterten OKR-Zeilen (Objectives, Key Results, verknüpfte Tasks) — Status per
        Drag &amp; Drop anpassen.
      </p>
      {error ? (
        <p className="mb-6 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm font-medium text-[#8A6A12]">
          {error.message}
        </p>
      ) : null}
      <Suspense fallback={<div className="text-sm text-[var(--muted)]">Kanban wird geladen…</div>}>
        <OkrFilteredKanban initialAll={all} />
      </Suspense>
    </div>
  );
}
