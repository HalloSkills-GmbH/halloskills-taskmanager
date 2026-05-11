"use client";

import { useState } from "react";
import type { OkrFilters } from "@/lib/okr/filters";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import { MainTableView } from "@/components/tasks/MainTableView";

type Props = {
  initialAll: TaskRow[];
  filters: OkrFilters;
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  layoutSyncKey: string;
  departmentId?: string | null;
  boardProjectOptions?: { id: string; label: string }[];
  initialColumnOrder?: string[] | null;
  initialGroupSort?: { topic?: string[]; status?: string[] } | null;
};

export function OkrTableClient({
  initialAll,
  filters,
  initialCustomColumns,
  initialMergedWidths,
  layoutSyncKey,
  departmentId = null,
  boardProjectOptions,
  initialColumnOrder = null,
  initialGroupSort = null,
}: Props) {
  const [error] = useState<string | null>(null);

  return (
    <div>
      {error ? (
        <div
          className="mb-4 rounded-hs border px-4 py-2.5 text-sm font-medium"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
            background: "color-mix(in oklab, var(--danger) 12%, var(--card))",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      ) : null}
      <MainTableView
        mode="okr"
        initialTasks={initialAll}
        enableRealtime
        okrFilters={filters}
        initialCustomColumns={initialCustomColumns}
        initialMergedWidths={initialMergedWidths}
        layoutSyncKey={layoutSyncKey}
        departmentId={departmentId}
        boardProjectOptions={boardProjectOptions}
        initialColumnOrder={initialColumnOrder}
        initialGroupSort={initialGroupSort}
      />
    </div>
  );
}
