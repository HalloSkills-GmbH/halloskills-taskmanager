import Link from "next/link";
import { CreateDepartmentForm } from "@/components/dashboard/CreateDepartmentForm";
import { fetchDepartmentOkrSnapshot } from "@/lib/okr/department-okr-snapshot";
import { normalizeItemKind } from "@/lib/okr/queries";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentRow } from "@/types/departments";
import type { TaskRow } from "@/types/tasks";

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

  const [tasksRes, deptRes] = await Promise.all([
    supabase.from("tasks").select("id,item_kind,department_id,status"),
    supabase.from("departments").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);

  const tasks = (tasksRes.data ?? []) as Pick<
    TaskRow,
    "id" | "item_kind" | "department_id" | "status"
  >[];
  const departments = (deptRes.data ?? []) as DepartmentRow[];

  const objectives = tasks.filter((t) => normalizeItemKind(t as TaskRow) === "objective");
  const keyResults = tasks.filter((t) => normalizeItemKind(t as TaskRow) === "key_result");
  const operational = tasks.filter((t) => {
    const k = normalizeItemKind(t as TaskRow);
    return !k || k === "task";
  });

  const byDept = (did: string | null) => tasks.filter((t) => t.department_id === did);

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">Dashboard</h1>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-app-text">
        Alle OKRs und Aufgaben auf einen Blick. Über die Seitenleiste wechselst du in Abteilungen —
        dort siehst du gefilterte Aufgaben, OKRs und eigene Boards mit konfigurierbaren Spalten.
      </p>

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
            {await Promise.all(
              departments.map(async (d) => {
                const { objectives, keyResults } = await fetchDepartmentOkrSnapshot(d.id);
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
                      {objectives.length} Objectives · {keyResults.length} Key Results
                    </p>
                    {objectives.length > 0 || keyResults.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-app-text">
                        {objectives.slice(0, 2).map((o) => (
                          <li key={o.id} className="truncate">
                            <span className="font-semibold text-app-ink">O:</span> {o.name}
                          </li>
                        ))}
                        {keyResults.slice(0, 2).map((kr) => (
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
              }),
            )}
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
