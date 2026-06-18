"use client";

import { MainTableView } from "@/components/tasks/MainTableView";
import { COL, mergeLayoutWidths } from "@/lib/tasks/main-table-columns";
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
}: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-app-ink">{title}</h2>
      {tasks.length === 0 ? (
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
      )}
    </section>
  );
}
