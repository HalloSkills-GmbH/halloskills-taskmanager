import { Suspense } from "react";
import Link from "next/link";
import { normalizeItemKind } from "@/lib/okr/queries";
import { fetchAssigneeOptions } from "@/lib/profiles/actions";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentRow } from "@/types/departments";
import type { TaskRow } from "@/types/tasks";
import { QuarterTabs } from "./QuarterTabs";

type TaskDashRow = Pick<TaskRow, "id" | "item_kind" | "department_id" | "status" | "name" | "progress" | "end_date">;

function quarterRange(q: number, year: number): { label: string; start: string; end: string } {
  const qStart = new Date(year, (q - 1) * 3, 1);
  const qEnd = new Date(year, q * 3, 0);
  return {
    label: `Q${q} ${year}`,
    start: qStart.toISOString().slice(0, 10),
    end: qEnd.toISOString().slice(0, 10),
  };
}

function currentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function buildOkrByDepartment(tasks: TaskDashRow[], qStart: string, qEnd: string) {
  const map = new Map<string, { objectives: TaskDashRow[]; keyResults: TaskDashRow[] }>();
  for (const t of tasks) {
    const did = t.department_id;
    if (!did) continue;
    if (!map.has(did)) map.set(did, { objectives: [], keyResults: [] });
    const kind = normalizeItemKind(t as TaskRow);
    const inQuarter = t.end_date && t.end_date >= qStart && t.end_date <= qEnd;
    if (!inQuarter) continue;
    if (kind === "objective") map.get(did)!.objectives.push(t);
    else if (kind === "key_result") map.get(did)!.keyResults.push(t);
  }
  return map;
}


const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  complete:    { bg: "#f0fdf4", color: "#15803d" },
  "in progress": { bg: "#fef9c3", color: "#854d0e" },
  planned:     { bg: "#dbeafe", color: "#1d4ed8" },
  blocked:     { bg: "#fff1f2", color: "#be123c" },
  "not started": { bg: "#f1f5f9", color: "#64748b" },
};

const STATUS_DE: Record<string, string> = {
  complete: "Erledigt",
  "in progress": "In Bearbeitung",
  planned: "Geplant",
  blocked: "Blockiert",
  "not started": "Nicht gestartet",
};

function statusStyle(status: string | null) {
  const k = (status ?? "").toLowerCase();
  for (const [key, val] of Object.entries(STATUS_COLOR)) {
    if (k.includes(key.split(" ")[0])) return val;
  }
  return { bg: "#f1f5f9", color: "#64748b" };
}

function statusLabel(status: string | null) {
  const k = (status ?? "").toLowerCase();
  for (const [key, label] of Object.entries(STATUS_DE)) {
    if (k.includes(key.split(" ")[0])) return label;
  }
  return status ?? "—";
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { q: qParam } = await searchParams;
  const year = new Date().getFullYear();
  const activeQ = Math.min(4, Math.max(1, parseInt(qParam ?? String(currentQuarter()), 10) || currentQuarter()));
  const quarter = quarterRange(activeQ, year);

  const [tasksRes, deptRes, assigneeOptions] = await Promise.all([
    supabase.from("tasks").select("id,item_kind,department_id,status,name,progress,end_date"),
    supabase.from("departments").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    fetchAssigneeOptions(),
  ]);

  // Map first name → { color, initials }
  const personByFirstName = new Map<string, { color: string; initials: string }>();
  for (const o of assigneeOptions) {
    if (o.type !== "profile") continue;
    const parts = o.name.trim().split(" ");
    const firstName = parts[0];
    const initials = parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    personByFirstName.set(firstName, { color: o.color ?? "#94a3b8", initials });
  }

  const tasks = (tasksRes.data ?? []) as TaskDashRow[];
  const departments = (deptRes.data ?? []) as DepartmentRow[];
  const okrByDept = buildOkrByDepartment(tasks, quarter.start, quarter.end);

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-app-text">
            OKR-Stand aller Abteilungen im aktiven Quartal.
          </p>
        </div>
        <Suspense>
          <QuarterTabs activeQ={activeQ} year={year} />
        </Suspense>
      </div>

      {departments.length === 0 ? (
        <p className="mt-8 text-sm text-app-muted">Noch keine Abteilungen angelegt.</p>
      ) : (
        <ul className="mt-8 grid gap-5 lg:grid-cols-2">
          {departments.map((d) => {
            const { objectives, keyResults } = okrByDept.get(d.id) ?? {
              objectives: [], keyResults: [],
            };
            const hasQuarterData = objectives.length > 0 || keyResults.length > 0;

            return (
              <li key={d.id} className="rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-app-ink">{d.name}</h2>
                  {d.responsible_name && (() => {
                    const p = personByFirstName.get(d.responsible_name);
                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: p?.color ?? "#94a3b8" }}
                          title={d.responsible_name}
                        >
                          {p?.initials ?? d.responsible_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-[11px] font-semibold text-app-muted">{d.responsible_name}</span>
                      </div>
                    );
                  })()}
                </div>

                {!hasQuarterData ? (
                  <p className="mt-4 text-xs text-app-muted">
                    Keine OKRs mit Fälligkeit in {quarter.label}.
                  </p>
                ) : (
                  <div className="mt-4 space-y-5">
                    {/* Progress bar — Ø Fortschritt der Key Results */}
                    {keyResults.length > 0 && (() => {
                      const avg = Math.round(keyResults.reduce((sum, kr) => sum + (kr.progress ?? 0), 0) / keyResults.length);
                      const done = keyResults.filter((kr) => (kr.progress ?? 0) >= 100).length;
                      return (
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-app-muted">
                            <span>Fortschritt</span>
                            <span>{avg}% · {done}/{keyResults.length} KRs erledigt</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2,#f1f5f9)]">
                            <div className="h-full rounded-full bg-[#15803d] transition-all" style={{ width: `${avg}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    {/* Objectives */}
                    {objectives.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-app-muted">Objectives</p>
                        <ul className="space-y-2">
                          {objectives.map((o) => {
                            const style = statusStyle(o.status);
                            const label = statusLabel(o.status);
                            return (
                              <li key={o.id} className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold text-app-ink leading-snug flex-1 min-w-0 truncate">
                                  {o.name}
                                </span>
                                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: style.bg, color: style.color }}>
                                  {label}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Key Results */}
                    {keyResults.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-app-muted">Key Results</p>
                        <ul className="space-y-2">
                          {keyResults.map((kr) => {
                            const style = statusStyle(kr.status);
                            const label = statusLabel(kr.status);
                            return (
                              <li key={kr.id} className="flex items-center justify-between gap-2">
                                <span className="text-[13px] text-app-text leading-snug flex-1 min-w-0 truncate">
                                  {kr.name}
                                </span>
                                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: style.bg, color: style.color }}>
                                  {label}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-5 border-t border-app-border pt-4">
                  <Link href={`/d/${d.slug}`} className="text-xs font-bold text-app-brand hover:underline">
                    Zur Abteilung →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
