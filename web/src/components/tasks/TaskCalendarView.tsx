"use client";

import type { TaskRow } from "@/types/tasks";
import { filterOperationalRows, normalizeItemKind } from "@/lib/okr/queries";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import { pillSecondary } from "@/lib/ui/classes";
import { useMemo, useState } from "react";

function parseYmd(s: string | null): Date | null {
  if (!s) return null;
  const p = s.slice(0, 10).split("-").map(Number);
  const y = p[0];
  const m = p[1];
  const d = p[2];
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function sameYmd(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dotClass(row: TaskRow): string {
  const k = normalizeItemKind(row);
  if (k === "objective") return "bg-app-brand";
  if (k === "key_result") return "bg-[#2D8A6E]";
  return "bg-app-ink2";
}

export type TaskCalendarViewProps = {
  initialRows: TaskRow[];
  enableRealtime?: boolean;
  project?: (all: TaskRow[]) => TaskRow[];
  variant?: "all" | "operational";
};

const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function TaskCalendarView({
  initialRows,
  enableRealtime = true,
  project,
  variant = "all",
}: TaskCalendarViewProps) {
  const projectFn = useMemo(
    () => project ?? (variant === "operational" ? filterOperationalRows : undefined),
    [project, variant],
  );
  const { rows: live } = useTasksRealtime(initialRows, {
    project: projectFn,
    enabled: enableRealtime,
  });
  const rows = enableRealtime ? live : initialRows;
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const { weeks, monthTitle } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(y, m, 1 - startOffset);
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(gridStart);
        cell.setDate(gridStart.getDate() + w * 7 + d);
        week.push(cell);
      }
      weeks.push(week);
    }
    const title = first.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    return { weeks, monthTitle: title };
  }, [cursor]);

  const tasksForDay = (day: Date) =>
    rows.filter((r) => {
      const s = parseYmd(r.start_date);
      if (!s) return false;
      const e = parseYmd(r.end_date || r.start_date) || s;
      const t0 = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const t1 = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
      const t2 = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
      return t0 >= t1 && t0 <= t2;
    });

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <div className="rounded-2xl border border-app-border bg-app-card shadow-card-lg">
      <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className={`${pillSecondary} !h-10 !w-10 !p-0`}
          aria-label="Vorheriger Monat"
        >
          ←
        </button>
        <h2 className="text-lg font-bold capitalize tracking-tight text-app-ink">{monthTitle}</h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className={`${pillSecondary} !h-10 !w-10 !p-0`}
          aria-label="Nächster Monat"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-app-border p-px">
        {weekdayLabels.map((wd) => (
          <div
            key={wd}
            className="bg-app-hover/80 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-app-muted"
          >
            {wd}
          </div>
        ))}
        {weeks.flatMap((week) =>
          week.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const list = tasksForDay(day);
            const today = sameYmd(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[92px] bg-app-card p-2 text-xs transition-colors ${
                  inMonth ? "text-app-ink2" : "text-app-muted/50"
                } ${today ? "ring-2 ring-inset ring-app-brand/45 ring-offset-0" : ""}`}
              >
                <div className="mb-1 text-[13px] font-bold">{day.getDate()}</div>
                <div className="flex max-h-[52px] flex-col gap-0.5 overflow-y-auto">
                  {list.map((t) => (
                    <div
                      key={t.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] leading-tight text-white"
                      style={{ background: "transparent" }}
                      title={t.name}
                    >
                      <span className={`mr-0.5 inline-block h-1.5 w-1.5 rounded-full ${dotClass(t)}`} />
                      <span className="font-medium text-app-ink2">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
