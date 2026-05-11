"use client";

import type { TaskRow } from "@/types/tasks";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

type Options = {
  /** Nach jedem Realtime-Reload: Teilmenge aus allen Zeilen (z. B. OKR-Filter oder nur operative Tasks). Memoized übergeben. */
  project?: (all: TaskRow[]) => TaskRow[];
  /** Standard: true. Bei false kein Channel (nur Props/Server-Daten). */
  enabled?: boolean;
};

/** Hält `tasks` mit Supabase-Realtime synchron; liefert die volle Liste (`allRows`) und optional gefilterte `rows`. */
export function useTasksRealtime(initialTasks: TaskRow[], options?: Options) {
  const enabled = options?.enabled !== false;
  const project = options?.project;

  const [allRows, setAllRows] = useState<TaskRow[]>(initialTasks);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setAllRows(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("tasks-realtime-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          void (async () => {
            const { data } = await supabase.from("tasks").select("*").order("id");
            if (!data) return;
            setAllRows(data as TaskRow[]);
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, enabled]);

  const rows = useMemo(
    () => (project ? project(allRows) : allRows),
    [allRows, project],
  );

  return { allRows, rows };
}
