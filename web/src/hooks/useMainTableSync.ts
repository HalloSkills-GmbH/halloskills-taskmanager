"use client";

import { saveMainTableColumnWidths } from "@/app/(app)/main-table/actions";
import { createClient } from "@/lib/supabase/client";
import { mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
import type { TaskCustomColumnRow } from "@/types/main-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useMainTableSync(
  mode: "tasks" | "okr",
  initialMergedWidths: Record<string, number>,
  initialCustomColumns: TaskCustomColumnRow[],
  enableRealtime: boolean,
  /** Ändert sich nach Server-Revalidate (z. B. updated_at der Layout-Zeile). */
  layoutSyncKey: string,
) {
  const viewKey = mode;
  const [widths, setWidths] = useState(initialMergedWidths);
  const [customColumns, setCustomColumns] = useState(initialCustomColumns);
  const supabase = useMemo(() => createClient(), []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customRef = useRef(initialCustomColumns);
  customRef.current = customColumns;

  useEffect(() => {
    setWidths(mergeLayoutWidths(mode, initialMergedWidths, initialCustomColumns));
    setCustomColumns(initialCustomColumns);
    // layoutSyncKey signalisiert neue Server-Daten; Werte kommen aus dem gleichen Render.
  }, [mode, layoutSyncKey, initialMergedWidths, initialCustomColumns]);

  const reloadCustomColumns = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_custom_columns")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data) return;
    setCustomColumns(data as TaskCustomColumnRow[]);
    setWidths((w) => mergeLayoutWidths(mode, w, data as TaskCustomColumnRow[]));
  }, [mode, supabase]);

  useEffect(() => {
    if (!enableRealtime) return;

    const ch = supabase
      .channel(`main-table-layout-${viewKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "main_table_layout",
          filter: `view_key=eq.${viewKey}`,
        },
        (payload) => {
          const row = payload.new as { column_widths?: Record<string, number> } | null;
          const cw = row?.column_widths;
          if (cw && typeof cw === "object") {
            setWidths(mergeLayoutWidths(mode, cw, customRef.current));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_custom_columns" },
        () => {
          void reloadCustomColumns();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enableRealtime, mode, reloadCustomColumns, supabase, viewKey]);

  const persistWidths = useCallback(
    (next: Record<string, number>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveMainTableColumnWidths(viewKey, next);
      }, 450);
    },
    [viewKey],
  );

  const updateWidthImmediate = useCallback(
    (key: string, w: number) => {
      const clamped = Math.round(Math.min(800, Math.max(40, w)));
      setWidths((prev) => {
        const next = { ...prev, [key]: clamped };
        persistWidths(next);
        return next;
      });
    },
    [persistWidths],
  );

  return { widths, updateWidthImmediate, customColumns, reloadCustomColumns };
}
