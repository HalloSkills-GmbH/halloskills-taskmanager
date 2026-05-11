import { Suspense } from "react";
import { TasksShell } from "@/components/tasks/TasksShell";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-[var(--muted)]">Aufgaben werden geladen…</div>}
    >
      <TasksShell>{children}</TasksShell>
    </Suspense>
  );
}
