"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import ReactDOM from "react-dom";
import { updateTaskFields } from "@/app/(app)/okrs/actions";

export type DashboardTask = {
  id: number;
  name: string;
  status: string | null;
  end_date: string | null;
  department_name?: string | null;
  item_kind?: string | null;
};

const STATUS_DE: Record<string, string> = {
  not_started: "Nicht gestartet",
  planned: "Geplant",
  in_progress: "In Bearbeitung",
  complete: "Erledigt",
  blocked: "Blockiert",
};

const STATUS_EN: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_DE).map(([en, de]) => [de, en])
);

const STATUS_COLORS: Record<string, { bg: string; dot: string; color: string }> = {
  not_started: { bg: "#f3f4f6", dot: "#9ca3af", color: "#374151" },
  planned:     { bg: "#dbeafe", dot: "#3b82f6", color: "#1d4ed8" },
  in_progress: { bg: "#fff3cd", dot: "#f59e0b", color: "#92400e" },
  complete:    { bg: "#dcfce7", dot: "#22c55e", color: "#15803d" },
  blocked:     { bg: "#fee2e2", dot: "#ef4444", color: "#b91c1c" },
};

function getStatusKey(raw: string | null): string {
  if (!raw) return "not_started";
  const lower = raw.toLowerCase().replace(" ", "_").replace(/ /g, "_");
  if (STATUS_DE[raw]) return raw;
  if (STATUS_DE[lower]) return lower;
  const fromDe = STATUS_EN[raw];
  if (fromDe) return fromDe;
  return raw;
}

function StatusBadge({ status, onClick }: { status: string | null; onClick?: () => void }) {
  const key = getStatusKey(status);
  const label = STATUS_DE[key] ?? status ?? "–";
  const c = STATUS_COLORS[key] ?? { bg: "#f3f4f6", dot: "#9ca3af", color: "#374151" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full cursor-pointer items-center gap-1.5 px-3 text-left"
      style={{ background: c.bg }}
      title="Status ändern"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.dot }} />
      <span className="truncate text-[12px] font-semibold" style={{ color: c.color }}>{label}</span>
    </button>
  );
}

function StatusDropdown({
  anchorRect,
  current,
  onSelect,
  onClose,
}: {
  anchorRect: DOMRect;
  current: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const currentKey = getStatusKey(current);
  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} />
      <div
        className="fixed z-[1000] min-w-[180px] rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-xl"
        style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
      >
        {Object.entries(STATUS_DE).map(([key, label]) => {
          const c = STATUS_COLORS[key] ?? { bg: "#f3f4f6", dot: "#9ca3af", color: "#374151" };
          return (
            <button
              key={key}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f5f6f8]"
              onClick={() => { onSelect(key); onClose(); }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.dot }} />
              <span className={`text-[13px] font-medium${currentKey === key ? " font-bold" : ""}`} style={{ color: c.color }}>{label}</span>
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}

function KindBadge({ kind }: { kind: string | null | undefined }) {
  const labels: Record<string, { label: string; bg: string; color: string }> = {
    objective:   { label: "Objective",   bg: "#f3e8ff", color: "#7c3aed" },
    key_result:  { label: "Key Result",  bg: "#e0f2fe", color: "#0369a1" },
    task:        { label: "Deliverable", bg: "#f0fdf4", color: "#15803d" },
  };
  const k = kind ?? "task";
  const s = labels[k] ?? labels.task;
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function TaskTableRow({
  task,
  onPatch,
}: {
  task: DashboardTask;
  onPatch: (id: number, patch: Partial<DashboardTask>) => void;
}) {
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const openStatus = useCallback(() => {
    if (statusRef.current) setStatusRect(statusRef.current.getBoundingClientRect());
  }, []);

  return (
    <div
      className="grid items-stretch border-b border-[#f0f0f0] hover:bg-[#fafafa]"
      style={{ gridTemplateColumns: "1fr 110px 120px 90px" }}
    >
      {/* Name */}
      <div className="flex items-center px-3 py-2.5">
        <span className="truncate text-[13px] font-medium text-[#1a1f36]">{task.name}</span>
        {task.department_name && (
          <span className="ml-2 shrink-0 text-[11px] text-[#9ca3af]">{task.department_name}</span>
        )}
      </div>

      {/* Typ */}
      <div className="flex items-center px-2 py-2">
        <KindBadge kind={task.item_kind} />
      </div>

      {/* Status */}
      <div ref={statusRef} className="flex items-stretch">
        <StatusBadge status={task.status} onClick={openStatus} />
        {statusRect && (
          <StatusDropdown
            anchorRect={statusRect}
            current={task.status}
            onSelect={(key) => {
              onPatch(task.id, { status: key });
              setStatusRect(null);
            }}
            onClose={() => setStatusRect(null)}
          />
        )}
      </div>

      {/* Fälligkeit */}
      <div className="flex items-center px-3 py-2">
        <input
          type="date"
          className="w-full bg-transparent text-[12px] text-[#374151] outline-none"
          value={task.end_date ?? ""}
          onChange={(e) => onPatch(task.id, { end_date: e.target.value || null })}
        />
      </div>
    </div>
  );
}

export function DashboardWeekTable({
  title,
  initialTasks,
  emptyText,
}: {
  title: string;
  initialTasks: DashboardTask[];
  emptyText: string;
}) {
  const [tasks, setTasks] = useState<DashboardTask[]>(initialTasks);
  const [, startTransition] = useTransition();

  const handlePatch = useCallback((id: number, patch: Partial<DashboardTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    startTransition(async () => {
      const dbPatch: Record<string, unknown> = { id };
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.end_date !== undefined) dbPatch.end_date = patch.end_date ?? null;
      await updateTaskFields(dbPatch);
    });
  }, []);

  return (
    <section className="rounded-2xl border border-app-border bg-app-card shadow-card">
      <div className="border-b border-[#f0f0f0] px-4 py-3">
        <h2 className="text-base font-bold text-app-ink">{title}</h2>
      </div>

      {tasks.length === 0 ? (
        <p className="px-4 py-4 text-sm text-app-muted">{emptyText}</p>
      ) : (
        <>
          {/* Header */}
          <div
            className="grid border-b border-[#f0f0f0] bg-[#fafafa]"
            style={{ gridTemplateColumns: "1fr 110px 120px 90px" }}
          >
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Aufgabe</div>
            <div className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Typ</div>
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Status</div>
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Fälligkeit</div>
          </div>
          {tasks.map((t) => (
            <TaskTableRow key={t.id} task={t} onPatch={handlePatch} />
          ))}
        </>
      )}
    </section>
  );
}
