"use client";

import type { TaskRow } from "@/types/tasks";
import { filterOperationalRows, normalizeItemKind } from "@/lib/okr/queries";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import { useMemo } from "react";

export type TaskGanttViewProps = {
  initialRows: TaskRow[];
  enableRealtime?: boolean;
  project?: (all: TaskRow[]) => TaskRow[];
  variant?: "all" | "operational";
};

function parseYmd(s: string | null): Date | null {
  if (!s) return null;
  const p = s.slice(0, 10).split("-").map(Number);
  const y = p[0];
  const m = p[1];
  const d = p[2];
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function barColor(row: TaskRow): string {
  const k = normalizeItemKind(row);
  if (k === "objective") return "bg-app-brand";
  if (k === "key_result") return "bg-[#2D8A6E]";
  return "bg-app-ink2";
}

export function TaskGanttView({
  initialRows,
  enableRealtime = true,
  project,
  variant = "all",
}: TaskGanttViewProps) {
  const projectFn = useMemo(
    () => project ?? (variant === "operational" ? filterOperationalRows : undefined),
    [project, variant],
  );
  const { rows: live } = useTasksRealtime(initialRows, {
    project: projectFn,
    enabled: enableRealtime,
  });
  const rows = enableRealtime ? live : initialRows;

  const { min, max, pxPerDay, widthPx, bars } = useMemo(() => {
    const withDates = rows.filter((r) => r.start_date);
    const starts = withDates.map((r) => parseYmd(r.start_date)).filter(Boolean) as Date[];
    const ends = withDates.map((r) => parseYmd(r.end_date || r.start_date)).filter(Boolean) as Date[];
    const minD =
      starts.length > 0
        ? new Date(Math.min(...starts.map((d) => d.getTime())))
        : new Date();
    let maxD =
      ends.length > 0 ? new Date(Math.max(...ends.map((d) => d.getTime()))) : new Date(minD);
    if (maxD < minD) maxD = new Date(minD);
    maxD.setDate(maxD.getDate() + 1);
    minD.setHours(0, 0, 0, 0);
    maxD.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    const totalDays = Math.max(1, Math.ceil((maxD.getTime() - minD.getTime()) / dayMs));
    const pxPerDay = 10;
    const widthPx = totalDays * pxPerDay;

    const bars = withDates.map((r) => {
      const s = parseYmd(r.start_date)!;
      const e = parseYmd(r.end_date || r.start_date) || s;
      const startClamped = s < minD ? minD : s;
      const endClamped = e > maxD ? maxD : e;
      const offset = Math.max(0, Math.round((startClamped.getTime() - minD.getTime()) / dayMs));
      const span = Math.max(
        1,
        Math.round((endClamped.getTime() - startClamped.getTime()) / dayMs) + 1,
      );
      return { row: r, offset, span };
    });

    return { min: minD, max: maxD, pxPerDay, widthPx, bars };
  }, [rows]);

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-app-border-strong bg-app-card p-10 text-center text-sm font-medium text-app-text shadow-card">
        Keine Zeilen für diese Ansicht.
      </p>
    );
  }

  if (!bars.length) {
    return (
      <p className="rounded-2xl border border-[#E0C878]/80 bg-[#FBEBC5]/50 p-6 text-sm font-medium text-[#8A6A12] shadow-card">
        Für den Gantt fehlen <strong>start_date</strong>-Werte. Bitte in der Tabelle oder in
        Supabase ergänzen.
      </p>
    );
  }

  const labelW = 220;

  return (
    <div className="overflow-x-auto rounded-2xl border border-app-border bg-app-card shadow-card-lg">
      <div className="min-w-[640px]">
        <div
          className="sticky top-0 z-10 flex border-b border-app-border bg-app-hover/60 text-[10px] font-bold uppercase tracking-[0.12em] text-app-muted"
          style={{ paddingLeft: labelW }}
        >
          {Array.from(
            { length: Math.ceil((max.getTime() - min.getTime()) / 86400000) },
            (_, i) => {
              const d = new Date(min);
              d.setDate(d.getDate() + i);
              const show = i === 0 || d.getDate() === 1;
              return (
                <div
                  key={i}
                  style={{ width: pxPerDay, minWidth: pxPerDay }}
                  className={`shrink-0 border-l border-app-border py-1 text-center ${
                    show ? "text-app-ink2" : "text-transparent"
                  }`}
                >
                  {show ? `${d.getDate()}.${d.getMonth() + 1}` : "."}
                </div>
              );
            },
          )}
        </div>
        {bars.map(({ row, offset, span }) => (
          <div
            key={row.id}
            className="flex items-stretch border-b border-app-border text-sm transition-colors last:border-0 hover:bg-app-hover/40"
          >
            <div
              className="shrink-0 border-r border-app-border bg-app-card px-3 py-2.5 text-app-ink2"
              style={{ width: labelW, minWidth: labelW }}
            >
              <span className="font-mono text-xs text-app-muted">{row.id}</span>{" "}
              <span className="font-semibold">{row.name}</span>
              <div className="truncate text-xs text-app-text">
                {(row.item_kind || "task").toLowerCase()} · {row.status || "—"}
              </div>
            </div>
            <div className="relative flex-1 py-2" style={{ minWidth: widthPx }}>
              <div
                className={`absolute top-1/2 h-7 -translate-y-1/2 rounded-md ${barColor(row)} shadow-[0_2px_8px_rgba(15,30,55,0.12)] transition hover:brightness-110`}
                style={{
                  left: offset * pxPerDay,
                  width: span * pxPerDay,
                  minWidth: 4,
                }}
                title={`${row.start_date ?? ""} → ${row.end_date ?? row.start_date ?? ""}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
