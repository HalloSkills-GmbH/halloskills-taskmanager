"use client";

import { addTaskCustomColumn } from "@/app/(app)/main-table/actions";
import { deleteTaskRow, insertTaskRow, updateTaskFields } from "@/app/(app)/okrs/actions";
import { useMainTableSync } from "@/hooks/useMainTableSync";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import type { OkrFilters } from "@/lib/okr/filters";
import {
  filterRowsByDepartmentId,
  filterRowsForOkrView,
  isOperationalRow,
  normalizeItemKind,
} from "@/lib/okr/queries";
import type { TaskListFilters } from "@/lib/tasks/filters";
import { filterTaskListRows } from "@/lib/tasks/filters";
import {
  COL,
  customColWidthKey,
  gridTemplateFromWidths,
} from "@/lib/tasks/main-table-columns";
import {
  buildTaskForestSubset,
  collectIdsWithChildren,
  groupForestBy,
  loadExpandedIdsFromStorage,
  saveExpandedIds,
  type TaskTreeNode,
} from "@/lib/tasks/tree";
import { statusVisual, topicAccent } from "@/lib/ui/task-status-visual";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import type { StatusOption } from "@/types/profiles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { StatusConfigurator } from "./StatusConfigurator";
import { PersonPicker } from "./PersonPicker";
import type { AssigneeOption } from "@/types/profiles";

const STATUSES = [
  "Not started",
  "Planned",
  "In Progress",
  "Complete",
  "Blocked",
] as const;

const ITEM_KINDS = ["task", "objective", "key_result"] as const;

function okrItemKindsForDepth(depth: number): (typeof ITEM_KINDS)[number][] {
  if (depth === 0) return ["objective"];
  if (depth === 1) return ["key_result"];
  return ["task"];
}

function subtaskButtonTitle(mode: "tasks" | "okr", parent: TaskRow): string {
  if (mode !== "okr") return "Unteraufgabe";
  const k = normalizeItemKind(parent);
  if (k === "objective") return "Key Result hinzufügen";
  if (k === "key_result") return "Aufgabe hinzufügen";
  return "Unteraufgabe";
}

type GroupBy = "none" | "topic" | "status";

export type MainTableGroupBy = GroupBy;

/** Clientseitige Sortierung der projizierten Flachliste vor Baumaufbau (nur sinnvoll im Aufgaben-Modus). */
export type MainTableTaskSort = "none" | "name" | "start" | "status";

export type MainTableViewProps = {
  mode: "tasks" | "okr";
  initialTasks: TaskRow[];
  enableRealtime?: boolean;
  taskFilters?: TaskListFilters;
  okrFilters?: OkrFilters;
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  /** Synchronisation mit Server-Daten (z. B. layout.updated_at + Spalten-IDs). */
  layoutSyncKey: string;
  /** Nur Zeilen dieser Abteilung (UUID); Realtime lädt weiter alle Tasks, Filter greift clientseitig). */
  departmentId?: string | null;
  /** Gruppierung von außen steuern (z. B. Aufgaben-Toolbar). */
  groupBy?: MainTableGroupBy;
  onGroupByChange?: (g: MainTableGroupBy) => void;
  /** Ausgeblendete Tabellenspalten (`COL.*` oder `custom:…`). */
  hiddenColumnKeys?: string[];
  taskSort?: MainTableTaskSort;
  /** Kein „Gruppieren“-Select in der Tabellen-Zeile (wird z. B. von der Toolbar übernommen). */
  suppressBuiltInGroupUi?: boolean;
  /** Nur Abteilungs-OKRs: Dropdown, um Aufgaben einem Board-Projekt zuzuordnen. */
  boardProjectOptions?: { id: string; label: string }[];
  /** Verfügbare Personen/Gruppen für den PersonPicker. */
  assigneeOptions?: AssigneeOption[];
};

type FlatRow = { node: TaskTreeNode; depth: number };

function flattenVisible(nodes: TaskTreeNode[], expanded: Set<number>, depth = 0): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children.length > 0 && expanded.has(n.row.id)) {
      out.push(...flattenVisible(n.children, expanded, depth + 1));
    }
  }
  return out;
}

function initials(s: string | null | undefined): string {
  const t = (s || "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function isDoneStatus(s: string | null | undefined): boolean {
  return (s || "").toLowerCase().includes("complete");
}

function formatDeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = iso.slice(0, 10).split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function readCustomFields(row: TaskRow): Record<string, unknown> {
  const c = row.custom_fields;
  if (c && typeof c === "object" && !Array.isArray(c)) return { ...c };
  return {};
}

function StatusCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const vis = statusVisual(value);
  return (
    <div className="hs-pop relative h-full min-h-[36px] w-full">
      <button
        type="button"
        className="hs-cell-status"
        style={{ background: vis.color, color: "#fff" }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="hs-dot" style={{ background: "#fff", opacity: 0.85 }} />
        {value || "—"}
      </button>
      {open ? (
        <div
          className="hs-menu"
          style={{ left: 0, right: "auto", zIndex: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          {STATUSES.map((s) => {
            const c = statusVisual(s);
            return (
              <button
                key={s}
                type="button"
                className="hs-menuitem"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              >
                <span className="hs-dot" style={{ background: c.dot }} />
                {s}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function orderedColumnKeys(
  mode: "tasks" | "okr",
  customColumns: TaskCustomColumnRow[],
  includeOkrBoardProject: boolean,
): string[] {
  const keys: string[] = [COL.grab, COL.name];
  if (mode === "okr") keys.push(COL.tipo);
  keys.push(COL.person, COL.link);
  if (mode === "okr" && includeOkrBoardProject) keys.push(COL.boardProj);
  keys.push(COL.topic);
  for (const c of [...customColumns].sort((a, b) => a.sort_order - b.sort_order)) {
    keys.push(customColWidthKey(c.col_key));
  }
  keys.push(COL.status, COL.start, COL.end, COL.prog, COL.attach);
  if (mode === "okr") keys.push(COL.actions);
  return keys;
}

function headerLabel(mode: "tasks" | "okr", key: string, customColumns: TaskCustomColumnRow[]): string {
  if (key === COL.grab) return "";
  if (key === COL.name) return "Aufgabe";
  if (key === COL.tipo) return "Typ";
  if (key === COL.person) return "Person";
  if (key === COL.link) return "OKR";
  if (key === COL.boardProj) return "Board / Projekt";
  if (key === COL.topic) return "Thema";
  if (key === COL.status) return "Status";
  if (key === COL.start) return "Start";
  if (key === COL.end) return "Ende";
  if (key === COL.prog) return "Fortschritt";
  if (key === COL.attach) return "📎";
  if (key === COL.actions) return "";
  if (key.startsWith("custom:")) {
    const ck = key.slice("custom:".length);
    return customColumns.find((c) => c.col_key === ck)?.label ?? ck;
  }
  return "";
}

export function MainTableView({
  mode,
  initialTasks,
  enableRealtime = true,
  taskFilters,
  okrFilters,
  initialCustomColumns,
  initialMergedWidths,
  layoutSyncKey,
  departmentId = null,
  groupBy: groupByProp,
  onGroupByChange,
  hiddenColumnKeys = [],
  taskSort = "none",
  suppressBuiltInGroupUi = false,
  boardProjectOptions,
  assigneeOptions = [],
}: MainTableViewProps) {
  const router = useRouter();
  const storageKey = `main-${mode}-${departmentId ?? "all"}`;
  const [groupByInternal, setGroupByInternal] = useState<GroupBy>(
    mode === "tasks" ? "topic" : "status",
  );
  const groupBy = groupByProp ?? groupByInternal;
  const setGroupBy = useCallback(
    (g: GroupBy) => {
      onGroupByChange?.(g);
      if (groupByProp === undefined) setGroupByInternal(g);
    },
    [groupByProp, onGroupByChange],
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [expandInit, setExpandInit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notesRow, setNotesRow] = useState<TaskRow | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [addColOpen, setAddColOpen] = useState(false);
  const [addColStep, setAddColStep] = useState<"select" | "configure">("select");
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<
    "text" | "date" | "status" | "dropdown" | "person" | "number" | "file" | "checkbox" | "formula" | "timeline" | "priority"
  >("text");
  const [newColStatusOpts, setNewColStatusOpts] = useState("Offen, Erledigt");
  const [newColDropdownOpts, setNewColDropdownOpts] = useState("Option 1, Option 2");
  const [newColPriorityOpts, setNewColPriorityOpts] = useState("Niedrig, Mittel, Hoch, Kritisch");
  const [addColBusy, setAddColBusy] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ key: string; color: string } | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupColor, setEditGroupColor] = useState("#00c875");
  const [statusConfigOpen, setStatusConfigOpen] = useState<string | null>(null);
  const [boardStatuses, setBoardStatuses] = useState<Record<string, StatusOption[]>>({});

  const { widths, updateWidthImmediate, customColumns } = useMainTableSync(
    mode,
    initialMergedWidths,
    initialCustomColumns,
    enableRealtime,
    layoutSyncKey,
  );

  const includeOkrBoardProject = mode === "okr" && boardProjectOptions !== undefined;
  const colKeys = useMemo(
    () => orderedColumnKeys(mode, customColumns, includeOkrBoardProject),
    [mode, customColumns, includeOkrBoardProject],
  );
  const hiddenSet = useMemo(() => new Set(hiddenColumnKeys), [hiddenColumnKeys]);
  const visibleColKeys = useMemo(
    () => colKeys.filter((k) => !hiddenSet.has(k)),
    [colKeys, hiddenSet],
  );
  const colTplVisible = useMemo(
    () => gridTemplateFromWidths(visibleColKeys, widths),
    [visibleColKeys, widths],
  );

  const project = useMemo(() => {
    const dept = (rows: TaskRow[]) =>
      departmentId ? filterRowsByDepartmentId(rows, departmentId) : rows;
    if (mode === "okr" && okrFilters) {
      return (all: TaskRow[]) => dept(filterRowsForOkrView(all, okrFilters));
    }
    if (mode === "tasks" && taskFilters) {
      return (all: TaskRow[]) => dept(filterTaskListRows(all, taskFilters));
    }
    if (departmentId) {
      return (all: TaskRow[]) => dept(all);
    }
    return undefined;
  }, [mode, okrFilters, taskFilters, departmentId]);

  const { allRows, rows: projectedRows } = useTasksRealtime(initialTasks, {
    project,
    enabled: enableRealtime,
  });

  const keyResults = useMemo(
    () =>
      allRows.filter((r) => normalizeItemKind(r) === "key_result").sort((a, b) => a.id - b.id),
    [allRows],
  );

  const tasksByKrId = useMemo(() => {
    const m = new Map<number, TaskRow[]>();
    for (const t of allRows) {
      if (!isOperationalRow(t) || t.okr_key_result_id == null) continue;
      const id = t.okr_key_result_id;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(t);
    }
    return m;
  }, [allRows]);

  const rowsForForest = useMemo(() => {
    if (!taskSort || taskSort === "none") return projectedRows;
    const copy = [...projectedRows];
    const cmp = (a: TaskRow, b: TaskRow) => {
      if (taskSort === "name") return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
      if (taskSort === "start")
        return (a.start_date || "").localeCompare(b.start_date || "", undefined, {
          sensitivity: "variant",
        });
      if (taskSort === "status")
        return (a.status || "").localeCompare(b.status || "", "de", { sensitivity: "base" });
      return 0;
    };
    copy.sort(cmp);
    return copy;
  }, [projectedRows, taskSort]);

  const forest = useMemo(() => buildTaskForestSubset(rowsForForest), [rowsForForest]);

  const groups = useMemo(() => groupForestBy(forest, groupBy), [forest, groupBy]);

  useLayoutEffect(() => {
    if (expandInit || rowsForForest.length === 0) return;
    const stored = loadExpandedIdsFromStorage(storageKey);
    const allExpand = collectIdsWithChildren(forest);
    setExpandedIds(stored ?? allExpand);
    setExpandInit(true);
  }, [forest, storageKey, expandInit, rowsForForest.length]);

  useEffect(() => {
    if (!expandInit) return;
    saveExpandedIds(storageKey, expandedIds);
  }, [expandedIds, expandInit, storageKey]);

  useEffect(() => {
    if (!colMenuOpen) return;
    const handleClick = () => setColMenuOpen(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [colMenuOpen]);

  const patch = useCallback(async (id: number, patchIn: Record<string, unknown>) => {
    setError(null);
    const res = await updateTaskFields({ id, ...patchIn });
    if (!res.ok) {
      setError(res.message);
      return false;
    }
    return true;
  }, []);

  const patchCustom = useCallback(
    async (row: TaskRow, colKey: string, value: unknown) => {
      const prev = readCustomFields(row);
      const next = { ...prev };
      if (value === "" || value == null) delete next[colKey];
      else next[colKey] = value;
      return patch(row.id, { custom_fields: next });
    },
    [patch],
  );

  const toggleRow = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }, []);

  const addSubtask = useCallback(
    async (parent: TaskRow) => {
      setBusy(true);
      setError(null);

      if (mode === "okr") {
        const pk = normalizeItemKind(parent);
        if (pk === "objective") {
          const res = await insertTaskRow({
            name: "Neues Key Result",
            item_kind: "key_result",
            parent_id: parent.id,
            okr_objective_id: parent.id,
            okr_key_result_id: null,
            start_date: parent.start_date,
            end_date: parent.end_date,
            topic: parent.topic,
            status: parent.status || "Planned",
            progress: 0,
            notes: "",
            assigned: parent.assigned ?? "",
            department_id: parent.department_id ?? departmentId ?? null,
            project_id: null,
            dependencies: [],
            attachments: [],
            custom_fields: {},
          });
          setBusy(false);
          if (!res.ok) setError(res.message);
          else setExpandedIds((prev) => new Set(prev).add(parent.id));
          return;
        }
        if (pk === "key_result") {
          const res = await insertTaskRow({
            name: "Neue Aufgabe (OKR)",
            item_kind: "task",
            parent_id: parent.id,
            okr_objective_id: parent.okr_objective_id ?? null,
            okr_key_result_id: parent.id,
            start_date: parent.start_date,
            end_date: parent.end_date,
            topic: parent.topic,
            status: parent.status || "Planned",
            progress: 0,
            notes: "",
            assigned: parent.assigned ?? "",
            department_id: parent.department_id ?? departmentId ?? null,
            project_id: null,
            dependencies: [],
            attachments: [],
            custom_fields: readCustomFields(parent),
          });
          setBusy(false);
          if (!res.ok) setError(res.message);
          else setExpandedIds((prev) => new Set(prev).add(parent.id));
          return;
        }
      }

      const res = await insertTaskRow({
        name: "Neue Unteraufgabe",
        item_kind: "task",
        parent_id: parent.id,
        start_date: parent.start_date,
        end_date: parent.end_date,
        topic: parent.topic,
        status: parent.status || "Planned",
        progress: 0,
        notes: "",
        assigned: parent.assigned,
        okr_objective_id: parent.okr_objective_id,
        okr_key_result_id: parent.okr_key_result_id,
        department_id: parent.department_id ?? departmentId ?? null,
        project_id: parent.project_id ?? null,
        dependencies: [],
        attachments: [],
        custom_fields: readCustomFields(parent),
      });
      setBusy(false);
      if (!res.ok) setError(res.message);
      else setExpandedIds((prev) => new Set(prev).add(parent.id));
    },
    [mode, departmentId],
  );

  const removeRow = useCallback(async (id: number) => {
    if (!window.confirm("Diese Zeile wirklich löschen?")) return;
    const res = await deleteTaskRow(id);
    if (!res.ok) setError(res.message);
  }, []);

  const addTaskToGroup = useCallback(
    async (groupKey: string) => {
      setBusy(true);
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date();
      end.setDate(end.getDate() + 7);

      const itemKind = mode === "okr" ? "objective" : "task";
      const topicVal = groupBy === "topic" ? groupKey : "Ops";
      const statusVal = groupBy === "status" ? groupKey : "Planned";

      const res = await insertTaskRow({
        name: mode === "okr" ? "Neues Objective" : "Neue Aufgabe",
        item_kind: itemKind,
        parent_id: null,
        okr_objective_id: null,
        okr_key_result_id: null,
        start_date: today,
        end_date: end.toISOString().slice(0, 10),
        topic: topicVal,
        status: statusVal,
        progress: 0,
        notes: "",
        assigned: "",
        department_id: departmentId ?? null,
        project_id: null,
        dependencies: [],
        attachments: [],
        custom_fields: {},
      });
      setBusy(false);
      if (!res.ok) setError(res.message);
    },
    [mode, groupBy, departmentId],
  );

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, colKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widths[colKey] ?? 80;
      const onMove = (ev: MouseEvent) => {
        updateWidthImmediate(colKey, startW + (ev.clientX - startX));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [widths, updateWidthImmediate],
  );

  const groupAccent = useCallback(
    (key: string) => {
      if (groupBy === "status") return statusVisual(key).color;
      if (groupBy === "topic") return topicAccent(key);
      return "var(--accent)";
    },
    [groupBy],
  );

  const linkedTasksForObjective = useCallback(
    (obj: TaskRow): TaskRow[] => {
      const krIds = allRows
        .filter(
          (r) => normalizeItemKind(r) === "key_result" && r.okr_objective_id === obj.id,
        )
        .map((r) => r.id);
      return allRows.filter(
        (t) =>
          isOperationalRow(t) &&
          t.okr_key_result_id != null &&
          krIds.includes(t.okr_key_result_id),
      );
    },
    [allRows],
  );

  const submitNewColumn = async () => {
    setAddColBusy(true);
    setError(null);
    const statusOpts =
      newColType === "status"
        ? newColStatusOpts.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const dropdownOpts =
      newColType === "dropdown"
        ? newColDropdownOpts.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const priorityOpts =
      newColType === "priority"
        ? newColPriorityOpts.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const res = await addTaskCustomColumn({
      label: newColLabel.trim(),
      col_type: newColType,
      status_options: statusOpts,
      dropdown_options: dropdownOpts,
      priority_options: priorityOpts,
    });
    setAddColBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setAddColOpen(false);
    setAddColStep("select");
    setNewColLabel("");
    setNewColType("text");
    setNewColStatusOpts("Offen, Erledigt");
    setNewColDropdownOpts("Option 1, Option 2");
    setNewColPriorityOpts("Niedrig, Mittel, Hoch, Kritisch");
    router.refresh();
  };

  const emptyMsg =
    projectedRows.length === 0
      ? "Keine Zeilen für die aktuellen Filter — Filter anpassen oder zurücksetzen."
      : null;

  if (projectedRows.length > 0 && !expandInit) {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-hs bg-[var(--surface-2)]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          className="rounded-xl border px-4 py-2.5 text-sm font-medium"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
            background: "color-mix(in oklab, var(--danger) 12%, var(--card))",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      ) : null}

      {addColOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/30 p-4 backdrop-blur-[2px]"
          onClick={() => { setAddColOpen(false); setAddColStep("select"); }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-pop"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            {addColStep === "select" ? (
              <>
                <div className="border-b border-[var(--border)] px-5 py-4">
                  <h2 className="text-[15px] font-bold text-[var(--ink)]">Spalte hinzufügen</h2>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-5">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Überblick</p>
                  <div className="mb-5 grid grid-cols-2 gap-2">
                    {[
                      { type: "status", label: "Status", color: "#00c875", icon: "M4 6h16M4 12h12M4 18h8" },
                      { type: "dropdown", label: "Drop-down", color: "#00c875", icon: "M6 9l6 6 6-6" },
                      { type: "text", label: "Text", color: "#fdab3d", icon: "M4 6h16M4 12h16M4 18h10" },
                      { type: "date", label: "Datum", color: "#00c875", icon: "M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
                      { type: "person", label: "Personen", color: "#579bfc", icon: "M16 14a4 4 0 10-8 0M12 10a3 3 0 100-6 3 3 0 000 6z" },
                      { type: "number", label: "Zahlen", color: "#a25ddc", icon: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14" },
                    ].map((col) => (
                      <button
                        key={col.type}
                        type="button"
                        onClick={() => { setNewColType(col.type as typeof newColType); setAddColStep("configure"); }}
                        className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--border-2)] hover:bg-[var(--hover)]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: col.color }}>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="text-white">
                            <path d={col.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="text-[13px] font-medium text-[var(--ink)]">{col.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Sehr nützlich</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: "file", label: "Datei", color: "#e2445c", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6" },
                      { type: "checkbox", label: "Checkbox", color: "#00c875", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
                      { type: "formula", label: "Formel", color: "#a25ddc", icon: "M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" },
                      { type: "timeline", label: "Zeitleiste", color: "#a25ddc", icon: "M3 12h4l3-9 4 18 3-9h4" },
                      { type: "priority", label: "Priority", color: "#ffcb00", icon: "M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.77l-7-14a2 2 0 00-3.68 0l-7 14A2 2 0 005 19z" },
                    ].map((col) => (
                      <button
                        key={col.type}
                        type="button"
                        onClick={() => { setNewColType(col.type as typeof newColType); setAddColStep("configure"); }}
                        className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--border-2)] hover:bg-[var(--hover)]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: col.color }}>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="text-white">
                            <path d={col.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="text-[13px] font-medium text-[var(--ink)]">{col.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
                  <button type="button" className="hs-btn hs-btn-ghost" onClick={() => { setAddColOpen(false); setAddColStep("select"); }}>
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setAddColStep("select")}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <h2 className="text-[15px] font-bold text-[var(--ink)]">
                    {newColType === "status" && "Status-Spalte"}
                    {newColType === "dropdown" && "Dropdown-Spalte"}
                    {newColType === "text" && "Text-Spalte"}
                    {newColType === "date" && "Datum-Spalte"}
                    {newColType === "person" && "Personen-Spalte"}
                    {newColType === "number" && "Zahlen-Spalte"}
                    {newColType === "file" && "Datei-Spalte"}
                    {newColType === "checkbox" && "Checkbox-Spalte"}
                    {newColType === "formula" && "Formel-Spalte"}
                    {newColType === "timeline" && "Zeitleiste-Spalte"}
                    {newColType === "priority" && "Priority-Spalte"}
                  </h2>
                </div>
                <div className="space-y-4 p-5">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-3)]">Bezeichnung</span>
                    <input
                      className="hs-input w-full"
                      value={newColLabel}
                      onChange={(e) => setNewColLabel(e.target.value)}
                      placeholder="z. B. Review-Datum"
                      autoFocus
                    />
                  </label>
                  {newColType === "status" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-3)]">Status-Optionen (kommagetrennt)</span>
                      <input className="hs-input w-full" value={newColStatusOpts} onChange={(e) => setNewColStatusOpts(e.target.value)} />
                    </label>
                  ) : null}
                  {newColType === "dropdown" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-3)]">Dropdown-Optionen (kommagetrennt)</span>
                      <input className="hs-input w-full" value={newColDropdownOpts} onChange={(e) => setNewColDropdownOpts(e.target.value)} />
                    </label>
                  ) : null}
                  {newColType === "priority" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-3)]">Priorität-Optionen (kommagetrennt)</span>
                      <input className="hs-input w-full" value={newColPriorityOpts} onChange={(e) => setNewColPriorityOpts(e.target.value)} />
                    </label>
                  ) : null}
                  {newColType === "formula" ? (
                    <p className="rounded-lg bg-[var(--surface-2)] p-3 text-[12px] text-[var(--muted)]">
                      Formel-Spalten werden in einer späteren Version unterstützt.
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
                  <button type="button" className="hs-btn hs-btn-ghost" onClick={() => { setAddColOpen(false); setAddColStep("select"); }}>
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="hs-btn hs-btn-primary"
                    disabled={addColBusy || !newColLabel.trim()}
                    onClick={() => void submitNewColumn()}
                  >
                    {addColBusy ? "…" : "Anlegen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {emptyMsg ? (
        <p className="rounded-hs border border-dashed border-[var(--border-2)] bg-[var(--card)] p-10 text-center text-sm font-medium text-[var(--ink-3)] shadow-card">
          {emptyMsg}
        </p>
      ) : (
        <div className="hs-mtable overflow-x-auto">
          <div className="hs-mtable-head min-w-max" style={{ gridTemplateColumns: `${colTplVisible} 100px` }}>
            {visibleColKeys.map((key, idx) => {
              const isCustom = key.startsWith("custom:");
              const colId = isCustom ? key.slice("custom:".length) : key;
              const menuOpen = colMenuOpen === key;
              return (
                <span
                  key={key}
                  className="group relative flex min-w-0 items-center px-2 py-1"
                  style={{ textAlign: idx === 0 ? "center" : "left" }}
                >
                  <span className="truncate">{headerLabel(mode, key, customColumns)}</span>
                  {idx > 0 ? (
                    <button
                      type="button"
                      onClick={() => setColMenuOpen(menuOpen ? null : key)}
                      className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition hover:bg-[var(--hover)] group-hover:opacity-100"
                      aria-label="Spaltenmenü"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                        <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                      </svg>
                    </button>
                  ) : null}
                  {menuOpen ? (
                    <div
                      className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-pop"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">
                        Spalten-ID: {colId}
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
                        onClick={() => {
                          setGroupBy(key === COL.topic ? "topic" : key === COL.status ? "status" : "none");
                          setColMenuOpen(null);
                        }}
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <path d="M4 6h16M4 12h10M4 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Gruppieren nach
                      </button>
                      {(key === COL.status || (isCustom && customColumns.find(c => `custom:${c.id}` === key)?.column_type === "status")) ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
                          onClick={() => {
                            setStatusConfigOpen(key);
                            setColMenuOpen(null);
                          }}
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          Status anpassen
                        </button>
                      ) : null}
                      {isCustom ? (
                        <>
                          <div className="my-1 border-t border-[var(--border)]" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
                            onClick={() => {
                              const newName = window.prompt("Neuer Spaltenname:", headerLabel(mode, key, customColumns));
                              if (newName && newName.trim()) {
                                // TODO: Server Action für Umbenennung
                              }
                              setColMenuOpen(null);
                            }}
                          >
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                              <path d="M15.232 5.232l3.536 3.536M4 20h4l10-10a2.5 2.5 0 00-3.536-3.536L4 16.464V20z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Umbenennen
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--danger)] hover:bg-[var(--hover)]"
                            onClick={() => {
                              if (window.confirm("Diese Spalte wirklich löschen?")) {
                                // TODO: Server Action für Löschen
                              }
                              setColMenuOpen(null);
                            }}
                          >
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                              <path d="M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M4 7h16M10 11v6M14 11v6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Löschen
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {idx < visibleColKeys.length - 1 ? (
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-[var(--accent)]/25"
                      onMouseDown={(e) => onResizeMouseDown(e, key)}
                    />
                  ) : null}
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => setAddColOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Spalte
            </button>
          </div>

          {groups.map((g) => {
            const collapsed = collapsedGroups.has(g.key);
            const flat = flattenVisible(g.roots, expandedIds);
            const count = flat.length;
            const done = flat.filter(({ node }) => isDoneStatus(node.row.status)).length;
            const pct = count ? Math.round((done / count) * 100) : 0;
            const accent = groupAccent(g.key);

            return (
              <div
                key={g.key}
                className="hs-mgroup min-w-max"
                style={{ ["--group-accent" as string]: accent }}
              >
                <div className="hs-mgroup-head">
                  <button
                    type="button"
                    className="hs-mgroup-toggle"
                    onClick={() => toggleGroup(g.key)}
                    aria-expanded={!collapsed}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        transform: collapsed ? "rotate(-90deg)" : "none",
                        transition: "transform .15s",
                        color: accent,
                      }}
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGroup({ key: g.key, color: accent });
                      setEditGroupName(g.key);
                      setEditGroupColor(accent);
                    }}
                    className="hs-mgroup-title cursor-pointer transition hover:opacity-80"
                    style={{ color: accent }}
                  >
                    {g.key}
                  </button>
                  <span className="hs-mgroup-count">
                    {count} {count === 1 ? "Aufgabe" : "Aufgaben"}
                  </span>
                  <div className="hs-mgroup-progress">
                    <span className="hs-mgroup-bar" style={{ width: `${pct}%`, background: accent }} />
                  </div>
                  <span className="hs-mgroup-pct">{pct}%</span>
                </div>

                {!collapsed &&
                  flat.map(({ node, depth }) => {
                    const r = node.row;
                    const hasKids = node.children.length > 0;
                    const open = expandedIds.has(r.id);
                    const topic = (r.topic || "").trim() || "—";
                    const prog = Math.min(100, Math.max(0, r.progress ?? 0));
                    const sub = depth > 0;
                    const kind = normalizeItemKind(r);

                    const linkCell =
                      mode === "tasks" && isOperationalRow(r) ? (
                        <select
                          className="hs-select w-full min-w-0 !text-[11px]"
                          value={r.okr_key_result_id ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              void patch(r.id, { okr_key_result_id: null, okr_objective_id: null });
                              return;
                            }
                            const krId = Number(v);
                            const kr = keyResults.find((k) => k.id === krId);
                            void patch(r.id, {
                              okr_key_result_id: krId,
                              okr_objective_id: kr?.okr_objective_id ?? null,
                            });
                          }}
                        >
                          <option value="">— nicht verknüpft —</option>
                          {keyResults.map((kr) => (
                            <option key={kr.id} value={kr.id}>
                              KR: {kr.name.slice(0, 40)}
                              {kr.name.length > 40 ? "…" : ""} (#{kr.id})
                            </option>
                          ))}
                        </select>
                      ) : mode === "okr" ? (
                        <div className="min-w-0 text-[11px] font-semibold text-[var(--ink-3)]">
                          {kind === "key_result" ? (
                            (() => {
                              const linked = tasksByKrId.get(r.id) ?? [];
                              return linked.length ? (
                                <span
                                  className="hs-name-kr inline-flex max-w-full items-center gap-1"
                                  title={linked.map((t) => t.name).join(", ")}
                                >
                                  {linked.length} Aufg.
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              );
                            })()
                          ) : kind === "objective" ? (
                            (() => {
                              const linked = linkedTasksForObjective(r);
                              return linked.length ? (
                                <span
                                  className="hs-name-kr inline-flex max-w-full"
                                  title={linked.map((t) => t.name).join(", ")}
                                >
                                  {linked.length} Aufg. verknüpft
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              );
                            })()
                          ) : isOperationalRow(r) && r.okr_key_result_id ? (
                            <span className="text-[var(--positive)]">✓ KR #{r.okr_key_result_id}</span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </div>
                      ) : null;

                    const customCells = customColumns
                      .filter((c) => !hiddenSet.has(customColWidthKey(c.col_key)))
                      .map((c) => {
                      const wk = customColWidthKey(c.col_key);
                      const raw = readCustomFields(r)[c.col_key];
                      if (c.col_type === "text") {
                        return (
                          <div key={wk} className="hs-mcell min-w-0">
                            <input
                              className="hs-input w-full !py-1 !text-[12px]"
                              defaultValue={raw != null ? String(raw) : ""}
                              onBlur={(e) =>
                                void patchCustom(r, c.col_key, e.target.value.trim() || null)
                              }
                            />
                          </div>
                        );
                      }
                      if (c.col_type === "date") {
                        const s = raw != null ? String(raw).slice(0, 10) : "";
                        return (
                          <div key={wk} className="hs-mcell min-w-0">
                            <input
                              type="date"
                              className="hs-input w-full !py-1 !text-[12px]"
                              defaultValue={s}
                              onChange={(e) =>
                                void patchCustom(r, c.col_key, e.target.value || null)
                              }
                            />
                          </div>
                        );
                      }
                      const opts = c.status_options?.length ? c.status_options : ["A", "B"];
                      return (
                        <div key={wk} className="hs-mcell min-w-0">
                          <select
                            className="hs-select w-full !py-1 !text-[11px]"
                            value={raw != null ? String(raw) : ""}
                            onChange={(e) => void patchCustom(r, c.col_key, e.target.value || null)}
                          >
                            <option value="">—</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>
                                {o}
                            </option>
                            ))}
                          </select>
                        </div>
                      );
                    });

                    return (
                      <div
                        key={r.id}
                        className={`hs-mrow min-w-max ${sub ? "hs-msub" : ""}`}
                        style={{ gridTemplateColumns: `${colTplVisible} 100px` }}
                      >
                        {!hiddenSet.has(COL.grab) ? (
                          <div className="hs-mcell hs-mcell-grab hs-mcell-center text-[var(--muted)]">
                            ···
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.name) ? (
                          <div className="hs-mcell hs-mcell-name">
                            <div className="hs-name-cell" style={{ paddingLeft: depth * 24 }}>
                              {hasKids ? (
                                <button
                                  type="button"
                                  className="hs-name-toggle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRow(r.id);
                                  }}
                                  aria-expanded={open}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      transform: open ? "rotate(90deg)" : "none",
                                      transition: "transform .15s",
                                    }}
                                  >
                                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                      <path
                                        d="M9 6l6 6-6 6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </span>
                                </button>
                              ) : (
                                <span className="hs-name-toggle" />
                              )}
                              <div className="hs-name-main min-w-0">
                                <input
                                  key={`n-${r.id}-${r.name}`}
                                  defaultValue={r.name}
                                  onBlur={async (e) => {
                                    const v = e.target.value.trim();
                                    if (v && v !== r.name) await patch(r.id, { name: v });
                                  }}
                                  className="!rounded-md !border-[var(--border-2)] !bg-[var(--card)] px-2 py-1 text-[13.5px] font-semibold text-[var(--ink)] outline-none focus:!border-[var(--accent)]"
                                />
                              </div>
                              <div className="hs-name-actions">
                                <button
                                  type="button"
                                  className="hs-iconbtn"
                                  title={subtaskButtonTitle(mode, r)}
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void addSubtask(r);
                                  }}
                                >
                                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M12 5v14M5 12h14"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="hs-iconbtn"
                                  title="Notizen"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotesRow(r);
                                    setNotesDraft(r.notes || "");
                                  }}
                                >
                                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M8 21h8a2 2 0 002-2V7l-5-5H6a2 2 0 00-2 2v16"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {mode === "okr" && !hiddenSet.has(COL.tipo) ? (
                          <div className="hs-mcell">
                            <select
                              className="hs-select w-full min-w-0 !text-[12px]"
                              value={(r.item_kind || "task").toLowerCase()}
                              onChange={async (e) => {
                                await patch(r.id, {
                                  item_kind: e.target.value as (typeof ITEM_KINDS)[number],
                                });
                              }}
                            >
                              {(() => {
                                const cur = (r.item_kind || "task").toLowerCase() as (typeof ITEM_KINDS)[number];
                                const base = okrItemKindsForDepth(depth);
                                const list =
                                  !base.includes(cur) && ITEM_KINDS.includes(cur) ? [...base, cur] : base;
                                return list.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ));
                              })()}
                            </select>
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.person) ? (
                          <div className="hs-mcell hs-mcell-center">
                            <PersonPicker
                              value={r.assigned}
                              onChange={(v) => void patch(r.id, { assigned: v })}
                              options={assigneeOptions}
                            />
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.link) ? (
                          <div className="hs-mcell min-w-0">{linkCell}</div>
                        ) : null}
                        {mode === "okr" && includeOkrBoardProject && !hiddenSet.has(COL.boardProj) ? (
                          <div className="hs-mcell min-w-0">
                            {isOperationalRow(r) ? (
                              <select
                                className="hs-select w-full !text-[11px]"
                                value={r.project_id ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  void patch(r.id, { project_id: v ? v : null });
                                }}
                              >
                                <option value="">— kein Board-Projekt —</option>
                                {(boardProjectOptions ?? []).map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] text-[var(--muted)]">—</span>
                            )}
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.topic) ? (
                          <div className="hs-mcell">
                            <input
                              type="text"
                              className="hs-input-inline w-full truncate bg-transparent text-[12px]"
                              defaultValue={r.topic || ""}
                              placeholder="Thema…"
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (r.topic || "")) {
                                  void patch(r.id, { topic: v || null });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          </div>
                        ) : null}
                        {customCells}
                        {!hiddenSet.has(COL.status) ? (
                          <div className="hs-mcell hs-mcell-fill !p-0">
                            <StatusCell
                              value={r.status || "Not started"}
                              onChange={(s) => void patch(r.id, { status: s })}
                            />
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.start) ? (
                          <div className="hs-mcell hs-mcell-meta">
                            <input
                              type="date"
                              className="hs-input-date w-full bg-transparent text-[11px]"
                              value={r.start_date || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                void patch(r.id, { start_date: v || null });
                              }}
                            />
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.end) ? (
                          <div className="hs-mcell hs-mcell-meta">
                            <input
                              type="date"
                              className={`hs-input-date w-full bg-transparent text-[11px] ${isDoneStatus(r.status) ? "line-through opacity-60" : ""}`}
                              value={r.end_date || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                void patch(r.id, { end_date: v || null });
                              }}
                            />
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.prog) ? (
                          <div className="hs-mcell hs-mcell-prog">
                            <div className="hs-prog-cell group w-full">
                              <div className="hs-prog cursor-pointer" onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                void patch(r.id, { progress: Math.max(0, Math.min(100, pct)) });
                              }}>
                                <span
                                  className="hs-prog-fill bg-[var(--accent)]"
                                  style={{ width: `${prog}%` }}
                                />
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className="hs-prog-input hidden w-12 text-right text-[11px] group-hover:inline"
                                value={prog}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                                  void patch(r.id, { progress: v });
                                }}
                              />
                              <span className="hs-prog-num group-hover:hidden">{prog}%</span>
                            </div>
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.attach) ? (
                          <div className="hs-mcell hs-mcell-center text-[12px] font-semibold text-[var(--muted)]">
                            {Array.isArray(r.attachments) ? r.attachments.length : 0}
                          </div>
                        ) : null}
                        {mode === "okr" && !hiddenSet.has(COL.actions) ? (
                          <div className="hs-mcell hs-mcell-center">
                            <button
                              type="button"
                              className="text-[12px] font-semibold text-[var(--danger)] hover:underline"
                              onClick={() => void removeRow(r.id)}
                            >
                              Löschen
                            </button>
                          </div>
                        ) : null}
                        <div className="hs-mcell" />
                      </div>
                    );
                  })}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addTaskToGroup(g.key)}
                  className="hs-add-task-row flex w-full items-center gap-2 border-b border-transparent px-3 py-2.5 text-[13px] text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-60">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {mode === "okr" ? "Objective hinzufügen…" : "Aufgabe hinzufügen…"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {notesRow ? (
        <div className="hs-drawer-bg z-[60]" onClick={() => setNotesRow(null)}>
          <div className="hs-drawer" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="hs-drawer-head">
              <h3 className="text-sm font-bold text-[var(--ink)]">Notizen</h3>
            </div>
            <div className="hs-drawer-body">
              <p className="hs-drawer-title font-display text-2xl italic text-[var(--ink)]">
                {notesRow.name}
              </p>
              <textarea
                className="hs-input min-h-[240px]"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="hs-btn hs-btn-ghost" onClick={() => setNotesRow(null)}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="hs-btn hs-btn-primary"
                  onClick={async () => {
                    await patch(notesRow.id, { notes: notesDraft || null });
                    setNotesRow(null);
                  }}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingGroup ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setEditingGroup(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-[15px] font-bold text-[var(--ink)]">Gruppe bearbeiten</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-3)]">Name</span>
                <input
                  className="hs-input w-full"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  autoFocus
                />
              </label>
              <div>
                <span className="mb-2 block text-[12px] font-semibold text-[var(--ink-3)]">Farbe</span>
                <div className="grid grid-cols-8 gap-2">
                  {[
                    "#00c875", "#00d2d2", "#579bfc", "#a25ddc",
                    "#e2445c", "#ff158a", "#ff5ac4", "#fdab3d",
                    "#ffcb00", "#cab641", "#9cd326", "#037f4c",
                    "#c4c4c4", "#808080", "#333333", "#175a63",
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditGroupColor(c)}
                      className={`h-7 w-7 rounded-md transition ${
                        editGroupColor === c ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Vorschau:</span>
                <span className="font-bold" style={{ color: editGroupColor }}>{editGroupName || "Gruppe"}</span>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="hs-btn hs-btn-ghost" onClick={() => setEditingGroup(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="hs-btn hs-btn-primary"
                disabled={!editGroupName.trim()}
                onClick={async () => {
                  if (!editGroupName.trim()) return;
                  const oldTopic = editingGroup.key;
                  const newTopic = editGroupName.trim();
                  for (const row of allRows) {
                    if ((row.topic || "Ohne Thema") === oldTopic) {
                      await patch(row.id, { topic: newTopic });
                    }
                  }
                  setEditingGroup(null);
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {statusConfigOpen && departmentId ? (
        <StatusConfigurator
          boardId={departmentId}
          columnKey={statusConfigOpen}
          statuses={boardStatuses[statusConfigOpen] ?? STATUSES.map((s) => ({
            id: s.toLowerCase().replace(/\s+/g, "_"),
            label: s,
            color: statusVisual(s).bg,
          }))}
          onClose={() => setStatusConfigOpen(null)}
          onUpdate={(statuses) => {
            setBoardStatuses((prev) => ({ ...prev, [statusConfigOpen]: statuses }));
          }}
        />
      ) : null}
    </div>
  );
}
