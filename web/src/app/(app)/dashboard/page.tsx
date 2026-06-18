import Link from "next/link";
import { CreateDepartmentForm } from "@/components/dashboard/CreateDepartmentForm";
import { DashboardWeekSection } from "@/components/dashboard/DashboardWeekSection";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import type { TaskNotification } from "@/components/dashboard/NotificationsPanel";
import { fetchAssigneeOptions } from "@/lib/profiles/actions";
import type { OkrSnapshotRow } from "@/lib/okr/department-okr-snapshot";
import { normalizeItemKind } from "@/lib/okr/queries";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import { MAIN_TABLE_TASK_SELECT } from "@/lib/tasks/task-row-select";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentRow } from "@/types/departments";
import type { MainTableLayoutRow, TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";

type TaskDashRow = Pick<TaskRow, "id" | "item_kind" | "department_id" | "status" | "name" | "progress">;

function buildOkrByDepartment(tasks: TaskDashRow[]): Map<string, { objectives: OkrSnapshotRow[]; keyResults: OkrSnapshotRow[] }> {
  const map = new Map<string, { objectives: OkrSnapshotRow[]; keyResults: OkrSnapshotRow[] }>();
  for (const t of tasks) {
    const did = t.department_id;
    if (!did) continue;
    let bucket = map.get(did);
    if (!bucket) {
      bucket = { objectives: [], keyResults: [] };
      map.set(did, bucket);
    }
    const kind = normalizeItemKind(t as TaskRow);
    const row: OkrSnapshotRow = {
      id: t.id,
      name: t.name,
      status: t.status,
      progress: t.progress,
      item_kind: t.item_kind,
    };
    if (kind === "objective") bucket.objectives.push(row);
    else if (kind === "key_result") bucket.keyResults.push(row);
  }
  return map;
}

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

  const [tasksRes, deptRes, profileRes, myTasksRes, colsRes, layoutRes, assigneeOptions, notificationsRes] = await Promise.all([
    supabase.from("tasks").select("id,item_kind,department_id,status,name,progress"),
    supabase.from("departments").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    userId ? supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    userId ? supabase
      .from("tasks")
      .select(MAIN_TABLE_TASK_SELECT)
      .eq("assigned", userId)
      .order("end_date", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("task_custom_columns").select("*").order("sort_order", { ascending: true }),
    supabase.from("main_table_layout").select("*").eq("view_key", "tasks").maybeSingle(),
    fetchAssigneeOptions(),
    userId ? supabase
      .from("task_notifications")
      .select("id,type,message,actor_name,task_id,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const displayName = (profileRes.data as { display_name: string } | null)?.display_name ?? null;
  const notifications = (notificationsRes.data ?? []) as TaskNotification[];
  const departments = (deptRes.data ?? []) as DepartmentRow[];
  const allMyTasks = (myTasksRes.data ?? []) as TaskRow[];
  const customCols = (colsRes.data ?? []) as TaskCustomColumnRow[];
  const layoutRow = layoutRes.data as MainTableLayoutRow | null;
  const storedWidths = layoutRow?.column_widths && typeof layoutRow.column_widths === "object" && !Array.isArray(layoutRow.column_widths)
    ? (layoutRow.column_widths as Record<string, number>) : undefined;
  const mergedWidths = mergeLayoutWidths("tasks", storedWidths, customCols);
  const layoutSyncKey = `${layoutRow?.updated_at ?? "0"}:${customCols.map((c) => c.id).join(",")}`;

  const thisWeekStr = { start: thisWeekStart.toISOString().slice(0, 10), end: thisWeekEnd.toISOString().slice(0, 10) };
  const nextWeekStr = { start: nextWeekStart.toISOString().slice(0, 10), end: nextWeekEnd.toISOString().slice(0, 10) };

  const myTasksThisWeek = allMyTasks.filter((t) => t.end_date && t.end_date >= thisWeekStr.start && t.end_date <= thisWeekStr.end);
  const myTasksNextWeek = allMyTasks.filter((t) => t.end_date && t.end_date >= nextWeekStr.start && t.end_date <= nextWeekStr.end);
  const myTasksNoDueDate = allMyTasks.filter((t) => !t.end_date && t.status !== "complete");

  const tasks = (tasksRes.data ?? []) as TaskDashRow[];
  const okrByDept = buildOkrByDepartment(tasks);

  const objectives = tasks.filter((t) => normalizeItemKind(t as TaskRow) === "objective");
  const keyResults = tasks.filter((t) => normalizeItemKind(t as TaskRow) === "key_result");
  const operational = tasks.filter((t) => {
    const k = normalizeItemKind(t as TaskRow);
    return !k || k === "task";
  });

  const byDept = (did: string | null) => tasks.filter((t) => t.department_id === did);

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">
        {displayName ? `Hallo, ${displayName.split(" ")[0]} 👋` : "Mein Tag"}
      </h1>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-app-text">
        Alle OKRs und Aufgaben auf einen Blick. Über die Seitenleiste wechselst du in Abteilungen —
        dort siehst du gefilterte Aufgaben, OKRs und eigene Boards mit konfigurierbaren Spalten.
      </p>

      <div className="mt-8 space-y-6">
        <DashboardWeekSection
          title="Diese Woche"
          tasks={myTasksThisWeek}
          customColumns={customCols}
          mergedWidths={mergedWidths}
          layoutSyncKey={layoutSyncKey}
          assigneeOptions={assigneeOptions}
          emptyText="Keine Aufgaben diese Woche fällig."
          storageKey="dashboard-this-week"
        />
        <DashboardWeekSection
          title="Nächste Woche"
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

      <NotificationsPanel notifications={notifications} />

      {tasksRes.error ? (
        <p className="mt-6 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
          Aufgaben konnten nicht geladen werden: {tasksRes.error.message}
        </p>
      ) : null}
      {deptRes.error ? (
        <p className="mt-4 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm text-[#8A6A12]">
          Abteilungen nicht verfügbar ({deptRes.error.message}). Bitte Migration{" "}
          <code className="font-mono text-xs">004_departments_and_boards.sql</code> ausführen.
        </p>
      ) : null}

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Objectives" value={objectives.length} accent="brand" />
        <StatCard label="Key Results" value={keyResults.length} accent="green" />
        <StatCard label="Operative Aufgaben" value={operational.length} accent="amber" />
        <StatCard label="Abteilungen" value={departments.length} accent="slate" />
      </section>

      <section className="mt-10 rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-app-ink">Abteilungen verwalten</h2>
        <p className="mt-1 text-sm text-app-text">
          Nach dem Anlegen erscheint die Abteilung in der Seitenleiste mit Übersicht, Aufgaben, OKRs
          und Boards.
        </p>
        <div className="mt-5">
          <CreateDepartmentForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-app-ink">Abteilungen &amp; Volumen</h2>
        {departments.length === 0 ? (
          <p className="mt-3 text-sm text-app-muted">
            Noch keine Abteilung — oben anlegen oder Migration prüfen.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {departments.map((d) => {
              const slice = byDept(d.id);
              const obj = slice.filter((t) => normalizeItemKind(t as TaskRow) === "objective");
              return (
                <li key={d.id}>
                  <Link
                    href={`/d/${d.slug}`}
                    className="block rounded-2xl border border-app-border bg-app-card p-5 shadow-card transition hover:border-app-brand-soft"
                  >
                    <span className="font-bold text-app-ink">{d.name}</span>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-app-muted">
                      <span>{slice.length} Zeilen gesamt</span>
                      <span>{obj.length} Objectives</span>
                    </div>
                    <span className="mt-2 inline-block text-xs font-bold text-app-brand">
                      Zur Abteilung →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-app-ink">OKRs nach Abteilung</h2>
        <p className="mt-1 max-w-3xl text-sm text-app-text">
          Kurzüberblick aus derselben Datenbasis wie die Abteilungsübersichten. Detailbearbeitung in
          der jeweiligen OKR-Tabelle.
        </p>
        {departments.length === 0 ? null : (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {departments.map((d) => {
              const { objectives: deptObjectives, keyResults: deptKeyResults } = okrByDept.get(d.id) ?? {
                objectives: [],
                keyResults: [],
              };
              return (
                <li
                  key={d.id}
                  className="rounded-2xl border border-app-border bg-app-card p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-bold text-app-ink">{d.name}</span>
                    <Link
                      href={`/d/${d.slug}/okrs/table`}
                      className="text-xs font-bold text-app-brand hover:underline"
                    >
                      OKRs →
                    </Link>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-app-muted">
                    {deptObjectives.length} Objectives · {deptKeyResults.length} Key Results
                  </p>
                  {deptObjectives.length > 0 || deptKeyResults.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-sm text-app-text">
                      {deptObjectives.slice(0, 2).map((o) => (
                        <li key={o.id} className="truncate">
                          <span className="font-semibold text-app-ink">O:</span> {o.name}
                        </li>
                      ))}
                      {deptKeyResults.slice(0, 2).map((kr) => (
                        <li key={kr.id} className="truncate">
                          <span className="font-semibold text-app-ink">KR:</span> {kr.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-app-muted">Noch keine OKR-Zeilen zugeordnet.</p>
                  )}
                  <Link
                    href={`/d/${d.slug}`}
                    className="mt-3 inline-block text-xs font-bold text-app-brand hover:underline"
                  >
                    Zur Abteilungsübersicht
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/tasks" className="rounded-xl border border-app-border bg-app-card px-4 py-2.5 shadow-sm hover:border-app-brand-soft">
          Alle Aufgaben
        </Link>
        <Link href="/okrs/table" className="rounded-xl border border-app-border bg-app-card px-4 py-2.5 shadow-sm hover:border-app-brand-soft">
          Alle OKRs
        </Link>
      </section>
    </div>
  );
}

type MyTask = { id: number; name: string; status: string | null; end_date: string | null };

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  complete:           { bg: "#dcfce7", color: "#15803d" },
  in_progress:        { bg: "#fff3cd", color: "#92400e" },
  blocked:            { bg: "#fee2e2", color: "#b91c1c" },
  planned:            { bg: "#dbeafe", color: "#1d4ed8" },
  not_started:        { bg: "#f3f4f6", color: "#6b7280" },
};

const STATUS_DE: Record<string, string> = {
  not_started: "Nicht gestartet",
  planned: "Geplant",
  in_progress: "In Bearbeitung",
  complete: "Erledigt",
  blocked: "Blockiert",
};

function TaskRow({ task }: { task: MyTask }) {
  const statusKey = task.status ?? "";
  const statusLabel = (STATUS_DE[statusKey] ?? STATUS_DE[statusKey.toLowerCase()] ?? statusKey) || null;
  const style = STATUS_STYLE[statusKey] ?? STATUS_STYLE[statusKey.toLowerCase()] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-app-border bg-[var(--surface-2,#f9fafb)] px-4 py-3">
      <span className="flex-1 truncate text-sm font-medium text-app-ink">{task.name}</span>
      <div className="flex shrink-0 items-center gap-3">
        {task.end_date ? (
          <span className="text-xs text-app-muted">
            {new Date(task.end_date + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
          </span>
        ) : null}
        {statusLabel ? (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={style}>
            {statusLabel}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function MyTasksSection({ title, tasks, emptyText }: { title: string; tasks: MyTask[]; emptyText: string }) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
      <h2 className="text-base font-bold text-app-ink">{title}</h2>
      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-app-muted">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </ul>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "brand" | "green" | "amber" | "slate";
}) {
  const bar =
    accent === "brand"
      ? "bg-app-brand"
      : accent === "green"
        ? "bg-[#7CC97A]"
        : accent === "amber"
          ? "bg-[#E0C878]"
          : "bg-app-muted";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
      <span className={`absolute left-0 top-0 h-full w-1 rounded-r ${bar}`} aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-app-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-app-ink">{value}</p>
    </div>
  );
}
