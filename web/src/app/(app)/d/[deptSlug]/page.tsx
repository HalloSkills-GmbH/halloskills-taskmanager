import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DepartmentAddObjectiveForm } from "@/components/okr/DepartmentAddObjectiveForm";
import { DepartmentOkrPreview } from "@/components/okr/DepartmentOkrPreview";
import { normalizeItemKind } from "@/lib/okr/queries";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

type OkrItem = { id: number; name: string; status: string | null; end_date: string | null };

function getQuarter(endDate: string | null): "Q1" | "Q2" | "Q3" | "Q4" | null {
  if (!endDate) return null;
  const month = new Date(endDate).getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  "Completed":   { bg: "#dcfce7", color: "#15803d" },
  "In Progress": { bg: "#fff3cd", color: "#92400e" },
  "On Track":    { bg: "#dbeafe", color: "#1d4ed8" },
  "At Risk":     { bg: "#fee2e2", color: "#b91c1c" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const s = STATUS_STYLES[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function TaskCard({ item }: { item: OkrItem }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[13px] font-semibold leading-snug text-[#1a1f36]">{item.name}</p>
      <div className="mt-1.5">
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

const QUARTERS = ["Q2", "Q3", "Q4"] as const;
type Quarter = (typeof QUARTERS)[number];

const ROW_LABELS: { key: "objectives" | "keyResults" | "deliverables"; label: string }[] = [
  { key: "objectives",   label: "Objectives"   },
  { key: "keyResults",   label: "Key Results"  },
  { key: "deliverables", label: "Deliverables" },
];

export default async function DepartmentHubPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const supabase = await createClient();
  const [tasksRes, boardsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,item_kind,name,status,end_date")
      .eq("department_id", dept.id)
      .order("id"),
    supabase
      .from("department_boards")
      .select("id,name")
      .eq("department_id", dept.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const tasks = (tasksRes.data ?? []) as (Pick<TaskRow, "id" | "item_kind" | "name" | "status"> & { end_date: string | null })[];
  const boards = boardsRes.data ?? [];

  // Build quarterly grid
  const grid: Record<Quarter, Record<"objectives" | "keyResults" | "deliverables", OkrItem[]>> = {
    Q2: { objectives: [], keyResults: [], deliverables: [] },
    Q3: { objectives: [], keyResults: [], deliverables: [] },
    Q4: { objectives: [], keyResults: [], deliverables: [] },
  };

  for (const t of tasks) {
    const q = getQuarter(t.end_date);
    if (!q || q === "Q1") continue;
    const kind = normalizeItemKind(t as TaskRow);
    const item: OkrItem = { id: t.id, name: t.name ?? "", status: t.status, end_date: t.end_date };
    if (kind === "objective") grid[q].objectives.push(item);
    else if (kind === "key_result") grid[q].keyResults.push(item);
    else grid[q].deliverables.push(item);
  }

  const hasAnyData = tasks.some((t) => t.end_date);

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">

      {/* ── OKR Jahresplan ── */}
      <section className="rounded-2xl border border-app-border bg-app-card shadow-card">
        <div className="border-b border-app-border px-6 py-5">
          <h1 className="text-lg font-bold tracking-tight text-app-ink">OKR Jahresplan 2026</h1>
          <p className="mt-0.5 text-sm text-app-muted">{dept.name}</p>
        </div>

        {tasksRes.error ? (
          <p className="mx-6 mt-4 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-sm font-medium text-[#8E2B27]">
            {tasksRes.error.message}
          </p>
        ) : null}

        <div className="overflow-x-auto px-6 pb-6 pt-4">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "120px repeat(3, 1fr)", gap: "0 16px" }}>
            {/* Column headers */}
            <div />
            {QUARTERS.map((q, i) => {
              const dates = ["01.04. – 30.06.", "01.07. – 30.09.", "01.10. – 31.12."];
              return (
                <div key={q} className="pb-3">
                  <span className="text-sm font-bold text-app-ink">{q} 2026</span>
                  <span className="ml-2 text-xs font-normal text-app-muted">{dates[i]}</span>
                </div>
              );
            })}

            {/* Objectives row */}
            <div className="flex items-start pt-1 pr-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-app-muted">Objectives</span>
            </div>
            {QUARTERS.map((q) => (
              <div key={q} className="flex flex-col gap-2">
                {grid[q].objectives.length === 0 ? (
                  <p className="text-[11px] text-app-muted">–</p>
                ) : grid[q].objectives.map((item) => (
                  <div key={item.id} className="rounded-xl border border-app-border bg-[var(--surface-1,#f8f9fb)] px-3 py-2.5">
                    <p className="text-[12px] font-semibold text-app-ink leading-snug">{item.name}</p>
                    <div className="mt-1.5"><StatusBadge status={item.status} /></div>
                  </div>
                ))}
              </div>
            ))}

            {/* Key Results row */}
            <div className="flex items-start pt-4 pr-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-app-muted">Key Results</span>
            </div>
            {QUARTERS.map((q) => (
              <div key={q} className="flex flex-col gap-2 pt-3">
                {grid[q].keyResults.length === 0 ? (
                  <p className="text-[11px] text-app-muted">–</p>
                ) : grid[q].keyResults.map((item) => (
                  <div key={item.id} className="rounded-xl border border-app-border bg-[var(--surface-1,#f8f9fb)] px-3 py-2.5">
                    <p className="text-[12px] font-semibold text-app-ink leading-snug">{item.name}</p>
                    <div className="mt-1.5"><StatusBadge status={item.status} /></div>
                  </div>
                ))}
              </div>
            ))}

            {/* Deliverables row */}
            <div className="flex items-start pt-4 pr-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-app-muted">Deliverables</span>
            </div>
            {QUARTERS.map((q) => (
              <div key={q} className="pt-3">
                {grid[q].deliverables.length === 0 ? (
                  <p className="text-[11px] text-app-muted">–</p>
                ) : (
                  <div className="rounded-xl border border-app-border bg-[var(--surface-1,#f8f9fb)] px-3 py-2.5">
                    <ul className="divide-y divide-app-border">
                      {grid[q].deliverables.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                          <p className="text-[12px] text-app-ink">{item.name}</p>
                          <StatusBadge status={item.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {!hasAnyData ? (
          <p className="px-6 pb-5 text-xs text-app-muted">
            Noch keine Einträge mit Enddatum — lege Objectives an und vergib ein Datum, damit sie hier erscheinen.
          </p>
        ) : null}
      </section>


      {/* ── Add Objective ── */}
      <section className="mt-8 rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
        <DepartmentAddObjectiveForm departmentId={dept.id} />
        <p className="mt-4 text-xs leading-relaxed text-app-muted">
          Key Results und Deliverables legst du in der{" "}
          <Link href={`/d/${dept.slug}/okrs/table`} className="font-semibold text-app-brand hover:underline">
            OKR-Tabelle
          </Link>{" "}
          unter einem Objective an (Zeile aufklappen oder Aktionen in der Tabelle).
        </p>
      </section>


      {/* ── Boards ── */}
      {boards.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-app-muted">Abteilungs-Boards</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/d/${dept.slug}/boards/${b.id}`}
                  className="block rounded-2xl border border-app-border bg-app-card p-4 shadow-card transition hover:border-app-brand-soft"
                >
                  <span className="font-bold text-app-ink">{b.name}</span>
                  <span className="mt-1 block text-xs text-app-muted">Kanban öffnen</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
