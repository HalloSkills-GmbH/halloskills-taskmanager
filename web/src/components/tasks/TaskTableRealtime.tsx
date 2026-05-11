"use client";

import type { TaskRow } from "@/types/tasks";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

type Props = {
  initialTasks: TaskRow[];
  /** Filtert sichtbare Zeilen (Name, Notizen, Topic, Team) — z. B. aus `?q=` der URL. */
  searchQuery?: string;
};

function matchesQuery(row: TaskRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = `${row.name} ${row.notes || ""} ${row.topic || ""} ${row.assigned || ""} ${row.status || ""}`.toLowerCase();
  return hay.includes(s);
}

export function TaskTableRealtime({ initialTasks, searchQuery = "" }: Props) {
  const [rows, setRows] = useState<TaskRow[]>(initialTasks);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setRows(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    const ch = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          void (async () => {
            const { data } = await supabase.from("tasks").select("*").order("id");
            if (data) setRows(data as TaskRow[]);
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase]);

  const visible = useMemo(
    () => rows.filter((r) => matchesQuery(r, searchQuery)),
    [rows, searchQuery],
  );

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-app-border-strong bg-app-card p-10 text-center text-sm font-medium text-app-text shadow-card">
        Noch keine Zeilen in <code className="rounded-md bg-app-hover px-1.5 py-0.5 font-mono text-xs">tasks</code>{" "}
        — oder RLS blockiert den Lesezugriff für diesen Nutzer.
      </p>
    );
  }

  if (!visible.length) {
    return (
      <p className="rounded-2xl border border-dashed border-app-border-strong bg-app-card p-10 text-center text-sm font-medium text-app-text shadow-card">
        Keine Treffer für „{searchQuery.trim()}“.{" "}
        <span className="text-app-muted">Suchbegriff in der Topbar anpassen oder leeren.</span>
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-app-border bg-app-card shadow-card-lg">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-app-border bg-app-card text-[10px] font-bold uppercase tracking-[0.14em] text-app-muted">
          <tr>
            <th className="px-4 py-3.5">ID</th>
            <th className="px-4 py-3.5">Name</th>
            <th className="px-4 py-3.5">Team</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">%</th>
            <th className="px-4 py-3.5">Start</th>
            <th className="px-4 py-3.5">Ende</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t, i) => (
            <tr
              key={t.id}
              className={`border-b border-app-border transition-colors last:border-0 hover:bg-app-hover/80 ${
                i % 2 === 0 ? "bg-app-card" : "bg-[#FAFBFD]"
              }`}
            >
              <td className="px-4 py-2.5 font-mono text-xs text-app-muted">{t.id}</td>
              <td className="max-w-xs truncate px-4 py-2.5 font-semibold text-app-ink">{t.name}</td>
              <td className="px-4 py-2.5 text-app-text">{t.assigned ?? "—"}</td>
              <td className="px-4 py-2.5 text-app-text">{t.status ?? "—"}</td>
              <td className="px-4 py-2.5 text-app-text">{t.progress ?? 0}</td>
              <td className="px-4 py-2.5 text-xs font-medium text-app-muted">{t.start_date ?? "—"}</td>
              <td className="px-4 py-2.5 text-xs font-medium text-app-muted">{t.end_date ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
