"use client";

import { insertTaskRow } from "@/app/(app)/okrs/actions";
import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { filterOperationalRows } from "@/lib/okr/queries";
import { createBoardProject, deleteBoardProject } from "@/lib/workspace/actions";
import type { BoardProjectRow, DepartmentBoardColumn } from "@/types/departments";
import type { TaskRow } from "@/types/tasks";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export function BoardProjectsAndKanban({
  boardId,
  departmentId,
  initialProjects,
  initialBoardTasks,
  columns,
  nextTaskId,
}: {
  boardId: string;
  departmentId: string;
  initialProjects: BoardProjectRow[];
  initialBoardTasks: TaskRow[];
  columns: DepartmentBoardColumn[];
  nextTaskId: number;
}) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [taskProjectId, setTaskProjectId] = useState<string>(initialProjects[0]?.id ?? "");

  useEffect(() => {
    setTaskProjectId((prev) => {
      if (prev && initialProjects.some((p) => p.id === prev)) return prev;
      return initialProjects[0]?.id ?? "";
    });
  }, [initialProjects]);

  const projectIdSet = useMemo(
    () => new Set(initialProjects.map((p) => p.id)),
    [initialProjects],
  );

  const rowProjection = useCallback(
    (all: TaskRow[]) =>
      filterOperationalRows(all).filter(
        (r) => r.project_id != null && projectIdSet.has(r.project_id),
      ),
    [projectIdSet],
  );

  async function onCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await createBoardProject({ boardId, name: projectName.trim() });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    setProjectName("");
    router.refresh();
  }

  async function onDeleteProject(projectId: string) {
    if (
      !window.confirm(
        "Projekt löschen? Zugehörige Aufgaben verlieren die Projekt-Zuordnung.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await deleteBoardProject({ projectId, boardId });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    router.refresh();
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskProjectId) {
      setMsg("Bitte zuerst ein Projekt anlegen oder auswählen.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await insertTaskRow({
      id: nextTaskId,
      name: "Neue Board-Aufgabe",
      item_kind: "task",
      department_id: departmentId,
      project_id: taskProjectId,
      status: columns[0]?.title ?? "Planned",
      progress: 0,
      notes: "",
      parent_id: null,
      okr_objective_id: null,
      okr_key_result_id: null,
      dependencies: [],
      attachments: [],
      custom_fields: {},
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {msg ? (
        <p className="rounded-lg border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-3 py-2 text-sm text-[#8E2B27]">
          {msg}
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-bold text-app-ink">Projekte auf diesem Board</h2>
        <p className="mt-1 text-xs text-app-muted">
          Nur Aufgaben mit Projekt erscheinen im Kanban. Die Abteilungs-Haupttabelle listet alle
          Zeilen weiterhin.
        </p>
        <form
          onSubmit={(e) => void onCreateProject(e)}
          className="mt-3 flex max-w-md flex-wrap items-end gap-2"
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-app-muted">
            Neues Projekt
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm text-app-ink"
              placeholder="z. B. Website-Relaunch"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-app-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Anlegen
          </button>
        </form>
        <ul className="mt-4 space-y-2">
          {initialProjects.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm"
            >
              <span className="font-semibold text-app-ink">{p.name}</span>
              <button
                type="button"
                onClick={() => void onDeleteProject(p.id)}
                disabled={busy}
                className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-bold text-app-ink">Neue Aufgabe (Projekt)</h2>
        <form onSubmit={(e) => void onCreateTask(e)} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-app-muted">
            Projekt
            <select
              value={taskProjectId}
              onChange={(e) => setTaskProjectId(e.target.value)}
              className="ml-2 rounded-lg border border-app-border bg-app-card px-2 py-1.5 text-sm"
            >
              <option value="">— wählen —</option>
              {initialProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !taskProjectId}
            className="rounded-lg border border-app-border bg-app-hover px-3 py-2 text-sm font-bold disabled:opacity-50"
          >
            Aufgabe hinzufügen
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-bold text-app-ink">Kanban</h2>
        <div className="mt-4">
          <TaskBoardView
            initialRows={initialBoardTasks}
            variant="operational"
            columns={columns}
            enableRealtime
            rowProjection={rowProjection}
          />
        </div>
      </section>
    </div>
  );
}
