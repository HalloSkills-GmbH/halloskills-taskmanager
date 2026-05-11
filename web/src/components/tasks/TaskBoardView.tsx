"use client";

import type { TaskRow } from "@/types/tasks";
import { updateTaskFields } from "@/app/(app)/okrs/actions";
import { filterOperationalRows } from "@/lib/okr/queries";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DepartmentBoardColumn } from "@/types/departments";

export type TaskBoardViewProps = {
  initialRows: TaskRow[];
  enableRealtime?: boolean;
  /** Nur für Server-Routen: keine Funktion über RSC-Grenze serialisieren. */
  variant?: "all" | "operational";
  /** Feste Spalten; Drop setzt `tasks.status` auf den Spaltentitel. Unbekannter Status → erste Spalte. */
  columns?: DepartmentBoardColumn[] | null;
  /** Wenn gesetzt, überschreibt die Zeilenauswahl (z. B. OKR- oder Aufgaben-URL-Filter). */
  rowProjection?: (all: TaskRow[]) => TaskRow[];
};

function statusKey(row: TaskRow): string {
  return (row.status || "Ohne Status").trim() || "Ohne Status";
}

function BoardColumn({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status:${title}`,
    data: { status: title },
  });
  return (
    <section
      ref={setNodeRef}
      className={`flex w-[280px] shrink-0 flex-col rounded-2xl border bg-app-hover/50 shadow-card transition-colors ${
        isOver ? "border-app-brand ring-2 ring-app-brand/25" : "border-app-border"
      }`}
    >
      <header className="flex items-center justify-between border-b border-app-border px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-app-muted">{title}</span>
        <span className="rounded-full bg-app-card px-2.5 py-0.5 text-xs font-semibold text-app-text shadow-sm">
          {count}
        </span>
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 p-3">{children}</div>
    </section>
  );
}

function BoardCard({ task }: { task: TaskRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task },
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`cursor-grab touch-manipulation rounded-xl border border-app-border bg-app-card p-3.5 text-sm shadow-sm transition active:cursor-grabbing ${
        isDragging ? "border-app-brand opacity-90 shadow-lg ring-2 ring-app-brand/20" : "hover:border-app-brand-soft hover:shadow-md"
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="font-semibold leading-snug text-app-ink">{task.name}</div>
      {(task.item_kind || "task").toLowerCase() !== "task" ? (
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-app-muted">
          {(task.item_kind || "").replace(/_/g, " ")}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-app-text">
        {task.topic ? (
          <span className="rounded-md bg-app-brand-soft/60 px-2 py-0.5 text-app-brand">{task.topic}</span>
        ) : null}
        {task.assigned ? (
          <span className="rounded-md bg-app-hover px-2 py-0.5 text-app-ink2">{task.assigned}</span>
        ) : null}
        {task.progress != null ? (
          <span className="rounded-md bg-app-hover px-2 py-0.5 text-app-ink2">{task.progress}%</span>
        ) : null}
      </div>
      {(task.start_date || task.end_date) && (
        <div className="mt-2 text-[11px] font-medium text-app-muted">
          {task.start_date ?? "—"} → {task.end_date ?? task.start_date ?? "—"}
        </div>
      )}
    </article>
  );
}

export function TaskBoardView({
  initialRows,
  enableRealtime = true,
  variant = "all",
  columns: columnConfig = null,
  rowProjection,
}: TaskBoardViewProps) {
  const router = useRouter();
  const project = useMemo(() => {
    if (rowProjection) return rowProjection;
    return variant === "operational" ? filterOperationalRows : undefined;
  }, [rowProjection, variant]);
  const { rows: live } = useTasksRealtime(initialRows, {
    project,
    enabled: enableRealtime,
  });
  const rows = enableRealtime ? live : initialRows;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const columns = useMemo(() => {
    if (columnConfig && columnConfig.length > 0) {
      const titles = columnConfig.map((c) => c.title);
      const map = new Map<string, TaskRow[]>();
      for (const t of titles) map.set(t, []);
      const first = titles[0]!;
      for (const r of rows) {
        const key = statusKey(r);
        if (map.has(key)) map.get(key)!.push(r);
        else map.get(first)!.push(r);
      }
      return titles.map((t) => ({ title: t, items: map.get(t)! }));
    }
    const map = new Map<string, TaskRow[]>();
    for (const r of rows) {
      const key = statusKey(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const keys = [...map.keys()].sort((a, b) => a.localeCompare(b, "de"));
    return keys.map((k) => ({ title: k, items: map.get(k)! }));
  }, [rows, columnConfig]);

  async function onDragEnd(event: DragEndEvent) {
    setError(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    if (!activeId.startsWith("task:")) return;
    const taskId = Number(activeId.slice(5));
    if (!Number.isFinite(taskId)) return;
    const newStatus = over.data.current?.status as string | undefined;
    if (!newStatus) return;
    const task = rows.find((r) => r.id === taskId);
    if (!task || statusKey(task) === newStatus) return;

    setBusy(true);
    const res = await updateTaskFields({ id: taskId, status: newStatus });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.refresh();
  }

  if (!rows.length && !(columnConfig && columnConfig.length > 0)) {
    return (
      <p className="rounded-2xl border border-dashed border-app-border-strong bg-app-card p-10 text-center text-sm font-medium text-app-text shadow-card">
        Keine Aufgaben — oder RLS blockiert den Zugriff.
      </p>
    );
  }

  const boardContent = (
    <>
      {error ? (
        <p className="mb-4 rounded-xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-2 text-sm font-medium text-[#8E2B27]">
          {error}
        </p>
      ) : null}
      {busy ? (
        <p className="mb-3 text-xs font-medium text-app-muted">Status wird gespeichert…</p>
      ) : null}
      <div className="flex gap-5 overflow-x-auto pb-2">
        {columns.map((col) => (
          <BoardColumn key={col.title} title={col.title} count={col.items.length}>
            {col.items.map((t) => (
              <BoardCard key={t.id} task={t} />
            ))}
          </BoardColumn>
        ))}
      </div>
    </>
  );

  if (!mounted) {
    return boardContent;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
      {boardContent}
    </DndContext>
  );
}
