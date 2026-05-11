import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { filterOperationalRows } from "@/lib/okr/queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function BoardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("id");
  const all = (data ?? []) as TaskRow[];
  const operational = filterOperationalRows(all);

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">Board</h1>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-app-text">
        Operative Aufgaben nach Status — Kanban inspiriert vom Legacy-Layout und modernen Boards
        wie Monday oder ClickUp.
      </p>
      {error ? (
        <p className="mt-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          {error.message}
        </p>
      ) : null}
      <div className="mt-8">
        <TaskBoardView initialRows={operational} variant="operational" />
      </div>
    </div>
  );
}
