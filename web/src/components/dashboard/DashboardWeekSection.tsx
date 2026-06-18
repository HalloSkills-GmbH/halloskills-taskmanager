"use client";

import { useState } from "react";
import { MainTableView } from "@/components/tasks/MainTableView";
import { COL } from "@/lib/tasks/main-table-columns";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { AssigneeOption } from "@/types/profiles";
import type { TaskRow } from "@/types/tasks";

const HIDDEN = [COL.topic, COL.boardProj, COL.link];

type Props = {
  title: string;
  tasks: TaskRow[];
  customColumns: TaskCustomColumnRow[];
  mergedWidths: Record<string, number>;
  layoutSyncKey: string;
  assigneeOptions: AssigneeOption[];
  emptyText: string;
  storageKey: string;
  collapsible?: boolean;
};

export function DashboardWeekSection({
  title,
  tasks,
  customColumns,
  mergedWidths,
  layoutSyncKey,
  assigneeOptions,
  emptyText,
  storageKey,
  collapsible = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        className="mb-2 flex items-center gap-2 text-left"
        onClick={() => collapsible && setOpen((v) => !v)}
        style={{ cursor: collapsible ? "pointer" : "default" }}
      >
        {collapsible && (
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <h2 className="text-base font-bold text-app-ink">
          {title}
          {collapsible && tasks.length > 0 && (
            <span className="ml-2 text-sm font-normal text-app-muted">{tasks.length} Deliverable{tasks.length !== 1 ? "s" : ""}</span>
          )}
        </h2>
      </button>

      {collapsible && !open ? null : (
        tasks.length === 0 ? (
          <div className="rounded-2xl border border-app-border bg-app-card px-5 py-4 text-sm text-app-muted shadow-card">
            {emptyText}
          </div>
        ) : (
          <div className="rounded-2xl border border-app-border bg-app-card shadow-card overflow-hidden">
            <MainTableView
              mode="tasks"
              initialTasks={tasks}
              enableRealtime={false}
              initialCustomColumns={customColumns}
              initialMergedWidths={mergedWidths}
              layoutSyncKey={layoutSyncKey}
              hiddenColumnKeys={HIDDEN}
              assigneeOptions={assigneeOptions}
              suppressBuiltInGroupUi
              tableStorageScopeSuffix={storageKey}
              groupBy="none"
            />
          </div>
        )
      )}
    </section>
  );
}
