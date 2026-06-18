import { DashboardWeekSection } from "@/components/dashboard/DashboardWeekSection";
import { fetchAssigneeOptions } from "@/lib/profiles/actions";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import { MAIN_TABLE_TASK_SELECT } from "@/lib/tasks/task-row-select";
import { createClient } from "@/lib/supabase/server";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import { PersonalTodos } from "./PersonalTodos";

export default async function DashboardPage() {
  try {
    return await DashboardContent();
  } catch (e) {
    console.error("[dashboard]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="mx-auto max-w-[720px] px-8 py-14">
        <h1 className="text-[1.5rem] font-bold tracking-tight text-app-ink">Mein Tag nicht erreichbar</h1>
        <p className="mt-3 text-sm leading-relaxed text-app-text">
          {process.env.NODE_ENV === "development"
            ? msg
            : "Ein Serverfehler ist aufgetreten. Bitte .next löschen, Dev-Server neu starten und Supabase-Umgebungsvariablen prüfen."}
        </p>
      </div>
    );
  }
}

async function DashboardContent() {
  const supabase = await createClient();

  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult?.user?.id ?? null;

  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - dayOfWeek);
  thisWeekStart.setHours(0, 0, 0, 0);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  thisWeekEnd.setHours(23, 59, 59, 999);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(thisWeekStart.getDate() + 7);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);

  const todosRes = userId
    ? await supabase.from("personal_todos").select("id,text,done").eq("user_id", userId).order("created_at", { ascending: true })
    : { data: [] };
  const todos = (todosRes.data ?? []) as { id: string; text: string; done: boolean }[];

  const [profileRes, myTasksRes, colsRes, layoutRes, assigneeOptions] = await Promise.all([
    userId ? supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    userId ? supabase
      .from("tasks")
      .select(MAIN_TABLE_TASK_SELECT)
      .contains("assigned", [userId])
      .order("end_date", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("task_custom_columns").select("*").order("sort_order", { ascending: true }),
    supabase.from("main_table_layout").select("*").eq("view_key", "tasks").maybeSingle(),
    fetchAssigneeOptions(),
  ]);

  const displayName = (profileRes.data as { display_name: string } | null)?.display_name ?? null;
  const allMyTasks = (myTasksRes.data ?? []) as TaskRow[];
  const customCols = (colsRes.data ?? []) as TaskCustomColumnRow[];
  const layoutRow = layoutRes.data as MainTableLayoutRow | null;
  const storedWidths = layoutRow?.column_widths && typeof layoutRow.column_widths === "object" && !Array.isArray(layoutRow.column_widths)
    ? (layoutRow.column_widths as Record<string, number>) : undefined;
  const mergedWidths = mergeLayoutWidths("tasks", storedWidths, customCols);
  const layoutSyncKey = `${layoutRow?.updated_at ?? "0"}:${customCols.map((c) => c.id).join(",")}`;

  const isoWeek = (d: Date) => {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };
  const kwThis = isoWeek(thisWeekStart);
  const kwNext = isoWeek(nextWeekStart);

  const thisWeekStr = { start: thisWeekStart.toISOString().slice(0, 10), end: thisWeekEnd.toISOString().slice(0, 10) };
  const nextWeekStr = { start: nextWeekStart.toISOString().slice(0, 10), end: nextWeekEnd.toISOString().slice(0, 10) };

  // Show task if it starts this week OR is due this week (avoids showing long-running tasks every week)
  const myTasksThisWeek = allMyTasks.filter((t) => {
    const startsThisWeek = t.start_date && t.start_date >= thisWeekStr.start && t.start_date <= thisWeekStr.end;
    const dueThisWeek = t.end_date && t.end_date >= thisWeekStr.start && t.end_date <= thisWeekStr.end;
    return startsThisWeek || dueThisWeek;
  });
  const thisWeekIds = new Set(myTasksThisWeek.map((t) => t.id));
  const myTasksNextWeek = allMyTasks.filter((t) => {
    if (thisWeekIds.has(t.id)) return false;
    const startsNextWeek = t.start_date && t.start_date >= nextWeekStr.start && t.start_date <= nextWeekStr.end;
    const dueNextWeek = t.end_date && t.end_date >= nextWeekStr.start && t.end_date <= nextWeekStr.end;
    return startsNextWeek || dueNextWeek;
  });

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">
        {displayName ? `Hallo, ${displayName.split(" ")[0]} 👋` : "Mein Tag"}
      </h1>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-app-text">
        Deine persönliche Übersicht — Aufgaben, die diese und nächste Woche fällig sind.
      </p>

      <div className="mt-8 space-y-6">
        <PersonalTodos initialTodos={todos} />
        <DashboardWeekSection
          title={`Diese Woche · KW ${kwThis}`}
          tasks={myTasksThisWeek}
          customColumns={customCols}
          mergedWidths={mergedWidths}
          layoutSyncKey={layoutSyncKey}
          assigneeOptions={assigneeOptions}
          emptyText="Keine Aufgaben diese Woche fällig."
          storageKey="dashboard-this-week"
        />
        <DashboardWeekSection
          title={`Nächste Woche · KW ${kwNext}`}
          tasks={myTasksNextWeek}
          customColumns={customCols}
          mergedWidths={mergedWidths}
          layoutSyncKey={layoutSyncKey}
          assigneeOptions={assigneeOptions}
          emptyText="Keine Aufgaben nächste Woche fällig."
          storageKey="dashboard-next-week"
          collapsible
        />
      </div>
    </div>
  );
}

