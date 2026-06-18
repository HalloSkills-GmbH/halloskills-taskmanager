"use client";

import { useMemo, useState } from "react";
import { MainTableView, type OkrContextEntry } from "./MainTableView";
import { COL } from "@/lib/tasks/main-table-columns";
import type { TaskRow } from "@/types/tasks";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { AssigneeOption } from "@/types/profiles";

const DELIVERABLES_HIDDEN = [COL.topic, COL.link];


type DueFilter = "overdue" | "this_week" | "next_week" | "this_month" | "no_date" | "";
type ProgressFilter = "not_started" | "in_progress" | "done" | "";

function getWeekRange(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mon = new Date(now); mon.setDate(now.getDate() - day + offsetWeeks * 7); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
  return { start: mon.toISOString().slice(0,10), end: sun.toISOString().slice(0,10) };
}

interface Props {
  initialTasks: TaskRow[];
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  layoutSyncKey: string;
  departmentId: string;
  okrContextMap: Map<number, OkrContextEntry>;
  assigneeOptions: AssigneeOption[];
}

export function DeliverablesPageClient({
  initialTasks,
  initialCustomColumns,
  initialMergedWidths,
  layoutSyncKey,
  departmentId,
  okrContextMap,
  assigneeOptions,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("");
  const [objectiveFilter, setObjectiveFilter] = useState("");
  const [krFilter, setKrFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("");

  // Collect unique objectives and key results from context map
  const { objectives, keyResultsByObj } = useMemo(() => {
    const objSet = new Map<string, string>();
    const krMap = new Map<string, Map<string, string>>();
    for (const ctx of okrContextMap.values()) {
      if (ctx.obj) objSet.set(ctx.obj, ctx.obj);
      if (ctx.obj && ctx.kr) {
        if (!krMap.has(ctx.obj)) krMap.set(ctx.obj, new Map());
        krMap.get(ctx.obj)!.set(ctx.kr, ctx.kr);
      }
    }
    return { objectives: [...objSet.keys()], keyResultsByObj: krMap };
  }, [okrContextMap]);

  const availableKrs = useMemo(() => {
    if (!objectiveFilter) {
      const all = new Map<string, string>();
      for (const m of keyResultsByObj.values()) for (const kr of m.keys()) all.set(kr, kr);
      return [...all.keys()];
    }
    return [...(keyResultsByObj.get(objectiveFilter)?.keys() ?? [])];
  }, [objectiveFilter, keyResultsByObj]);

  const today = new Date().toISOString().slice(0,10);
  const thisWeek = getWeekRange(0);
  const nextWeek = getWeekRange(1);
  const thisMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0,10);

  const filteredTasks = useMemo(() => {
    return initialTasks.filter((t) => {
      // Status
      if (statusFilter) {
        const s = (t.status ?? "").toLowerCase();
        if (statusFilter.toLowerCase() !== s) return false;
      }
      // Due date
      if (dueFilter) {
        const d = t.end_date;
        if (dueFilter === "no_date" && d) return false;
        if (dueFilter === "overdue" && (!d || d >= today)) return false;
        if (dueFilter === "this_week" && (!d || d < thisWeek.start || d > thisWeek.end)) return false;
        if (dueFilter === "next_week" && (!d || d < nextWeek.start || d > nextWeek.end)) return false;
        if (dueFilter === "this_month" && (!d || d > thisMonthEnd)) return false;
      }
      // Objective
      if (objectiveFilter) {
        const ctx = okrContextMap.get(t.id);
        if (ctx?.obj !== objectiveFilter) return false;
      }
      // Key Result
      if (krFilter) {
        const ctx = okrContextMap.get(t.id);
        if (ctx?.kr !== krFilter) return false;
      }
      // Person
      if (personFilter) {
        const ids = Array.isArray(t.assigned) ? t.assigned : t.assigned ? [t.assigned] : [];
        if (!ids.includes(personFilter)) return false;
      }
      // Progress
      if (progressFilter) {
        const p = t.progress ?? 0;
        if (progressFilter === "not_started" && p !== 0) return false;
        if (progressFilter === "in_progress" && (p === 0 || p >= 100)) return false;
        if (progressFilter === "done" && p < 100) return false;
      }
      return true;
    });
  }, [initialTasks, statusFilter, dueFilter, objectiveFilter, krFilter, personFilter, progressFilter, okrContextMap, today, thisWeek, nextWeek, thisMonthEnd]);

  const activeCount = [
    !!statusFilter,
    !!dueFilter,
    !!objectiveFilter,
    !!krFilter,
    !!personFilter,
    !!progressFilter,
  ].filter(Boolean).length;

  const clearAll = () => {
    setStatusFilter("");
    setDueFilter("");
    setObjectiveFilter("");
    setKrFilter("");
    setPersonFilter("");
    setProgressFilter("");
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-6 py-2.5">
        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="hs-select !text-[11px] !py-1 !h-7"
        >
          <option value="">Status: alle</option>
          <option value="planned">Geplant</option>
          <option value="in progress">In Bearbeitung</option>
          <option value="blocked">Blockiert</option>
          <option value="complete">Erledigt</option>
          <option value="not started">Nicht gestartet</option>
        </select>

        {/* Due date */}
        <select
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value as DueFilter)}
          className="hs-select !text-[11px] !py-1 !h-7"
        >
          <option value="">Fälligkeit: alle</option>
          <option value="overdue">Überfällig</option>
          <option value="this_week">Diese Woche</option>
          <option value="next_week">Nächste Woche</option>
          <option value="this_month">Diesen Monat</option>
          <option value="no_date">Kein Datum</option>
        </select>

        {/* Objective */}
        {objectives.length > 0 && (
          <select
            value={objectiveFilter}
            onChange={(e) => { setObjectiveFilter(e.target.value); setKrFilter(""); }}
            className="hs-select !text-[11px] !py-1 !h-7 max-w-[180px]"
          >
            <option value="">Objective: alle</option>
            {objectives.map((o) => (
              <option key={o} value={o}>{o.length > 30 ? o.slice(0, 30) + "…" : o}</option>
            ))}
          </select>
        )}

        {/* Key Result */}
        {availableKrs.length > 0 && (
          <select
            value={krFilter}
            onChange={(e) => setKrFilter(e.target.value)}
            className="hs-select !text-[11px] !py-1 !h-7 max-w-[180px]"
          >
            <option value="">Key Result: alle</option>
            {availableKrs.map((kr) => (
              <option key={kr} value={kr}>{kr.length > 35 ? kr.slice(0, 35) + "…" : kr}</option>
            ))}
          </select>
        )}

        {/* Person */}
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="hs-select !text-[11px] !py-1 !h-7"
        >
          <option value="">Person: alle</option>
          {assigneeOptions.filter((o) => o.type === "profile").map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>

        {/* Progress */}
        <select
          value={progressFilter}
          onChange={(e) => setProgressFilter(e.target.value as ProgressFilter)}
          className="hs-select !text-[11px] !py-1 !h-7"
        >
          <option value="">Fortschritt: alle</option>
          <option value="not_started">Nicht gestartet (0%)</option>
          <option value="in_progress">In Arbeit (1–99%)</option>
          <option value="done">Fertig (100%)</option>
        </select>

        {activeCount > 0 && (
          <>
            <div className="h-4 w-px bg-[var(--border)]" />
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Filter zurücksetzen ({activeCount})
            </button>
          </>
        )}
      </div>

      <MainTableView
        mode="deliverables"
        initialTasks={filteredTasks}
        initialCustomColumns={initialCustomColumns}
        initialMergedWidths={initialMergedWidths}
        layoutSyncKey={layoutSyncKey}
        departmentId={departmentId}
        okrContextMap={okrContextMap}
        assigneeOptions={assigneeOptions}
        enableRealtime={false}
        groupBy="quarter"
        taskSort="end"
        initialGroupSort={null}
        hiddenColumnKeys={DELIVERABLES_HIDDEN}
        tableStorageScopeSuffix="deliverables"
      />
    </div>
  );
}
