import Link from "next/link";
import { CreateDepartmentForm } from "@/components/dashboard/CreateDepartmentForm";
import type { OkrSnapshotRow } from "@/lib/okr/department-okr-snapshot";
import { normalizeItemKind } from "@/lib/okr/queries";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentRow } from "@/types/departments";
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
        <h1 className="text-[1.5rem] font-bold tracking-tight text-app-ink">Dashboard nicht erreichbar</h1>
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
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const [tasksRes, deptRes, profileRes, myTasksRes] = await Promise.all([
    supabase.from("tasks").select("id,item_kind,department_id,status,name,progress"),
    supabase.from("departments").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    userId ? supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    userId ? supabase
      .from("tasks")
      .select("id,name,status,end_date,department_id")
      .eq("assigned", userId)
      .gte("end_date", weekStart.toISOString().slice(0, 10))
      .lte("end_date", weekEnd.toISOString().slice(0, 10))
      .order("end_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const displayName = (profileRes.data as { display_name: string } | null)?.display_name ?? null;
  const myTasks = (myTasksRes.data ?? []) as { id: number; name: string; status: string; end_date: string | null }[];
  const tasks = (tasksRes.data ?? []) as TaskDashRow[];
  const departments = (deptRes.data ?? []) as DepartmentRow[];
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
        {displayName ? `Hallo, ${displayName.split(" ")[0]} 👋` : "Dashboard"}
      </h1>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-app-text">
        Alle OKRs und Aufgaben auf einen Blick. Über die Seitenleiste wechselst du in Abteilungen —
        dort siehst du gefilterte Aufgaben, OKRs und eigene Boards mit konfigurierbaren Spalten.
      </p>

      <section className="mt-8 rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
        <h2 className="text-base font-bold text-app-ink">Diese Woche fällig</h2>
        {myTasks.length === 0 ? (
          <p className="mt-3 text-sm text-app-muted">Keine Aufgaben diese Woche — alles erledigt oder nichts zugewiesen.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {myTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-app-border bg-[var(--surface-2,#f9fafb)] px-4 py-3">
                <span className="flex-1 truncate text-sm font-medium text-app-ink">{t.name}</span>
                <div className="flex shrink-0 items-center gap-3">
                  {t.end_date ? (
                    <span className="text-xs text-app-muted">
                      {new Date(t.end_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                    </span>
                  ) : null}
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: t.status === "Completed" ? "#dcfce7" : t.status === "In Progress" ? "#fff3cd" : "#f3f4f6",
                      color: t.status === "Completed" ? "#15803d" : t.status === "In Progress" ? "#92400e" : "#6b7280",
                    }}
                  >
                    {t.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
