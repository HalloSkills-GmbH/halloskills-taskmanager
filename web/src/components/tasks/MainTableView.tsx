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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

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

function nextTaskId(all: TaskRow[]): number {
  return all.length ? Math.max(...all.map((r) => r.id)) + 1 : 1;
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
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<"text" | "date" | "status">("text");
  const [newColStatusOpts, setNewColStatusOpts] = useState("Offen, Erledigt");
  const [addColBusy, setAddColBusy] = useState(false);

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
      const id = nextTaskId(allRows);

      if (mode === "okr") {
        const pk = normalizeItemKind(parent);
        if (pk === "objective") {
          const res = await insertTaskRow({
            id,
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
            id,
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
        id,
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
    [allRows, mode, departmentId],
  );

  const removeRow = useCallback(async (id: number) => {
    if (!window.confirm("Diese Zeile wirklich löschen?")) return;
    const res = await deleteTaskRow(id);
    if (!res.ok) setError(res.message);
  }, []);

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
    const opts =
      newColType === "status"
        ? newColStatusOpts
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    const res = await addTaskCustomColumn({
      label: newColLabel.trim(),
      col_type: newColType,
      status_options: opts,
    });
    setAddColBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setAddColOpen(false);
    setNewColLabel("");
    setNewColType("text");
    setNewColStatusOpts("Offen, Erledigt");
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
      <div className="hs-toolbar !mb-0">
        <div className="left flex flex-wrap items-center gap-2">
          {suppressBuiltInGroupUi ? null : (
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-3)]">
              Gruppieren
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="hs-select !py-1.5"
              >
                <option value="none">Keine Gruppe</option>
                <option value="topic">Thema</option>
                <option value="status">Status</option>
              </select>
            </label>
          )}
          <button
            type="button"
            className="hs-btn hs-btn-ghost !py-1.5 !text-[12px]"
            onClick={() => setAddColOpen(true)}
          >
            + Spalte
          </button>
        </div>
        <div className="right">
          <span className="text-[12.5px] font-semibold text-[var(--muted)]">
            {projectedRows.length} sichtbar · {allRows.length} in der DB
          </span>
        </div>
      </div>

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
          onClick={() => setAddColOpen(false)}
        >
          <div
            className="hs-modal max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="hs-modal-head">
              <h2 className="hs-modal-title">Spalte hinzufügen</h2>
            </div>
            <div className="hs-modal-body space-y-4">
              <label className="hs-field">
                <span className="hs-field-label">Bezeichnung</span>
                <input
                  className="hs-input w-full"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="z. B. Review-Datum"
                />
              </label>
              <label className="hs-field">
                <span className="hs-field-label">Typ</span>
                <select
                  className="hs-select w-full"
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as typeof newColType)}
                >
                  <option value="text">Text</option>
                  <option value="date">Datum</option>
                  <option value="status">Status (eigene Optionen)</option>
                </select>
              </label>
              {newColType === "status" ? (
                <label className="hs-field">
                  <span className="hs-field-label">Optionen (kommagetrennt)</span>
                  <input
                    className="hs-input w-full"
                    value={newColStatusOpts}
                    onChange={(e) => setNewColStatusOpts(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <div className="hs-modal-foot">
              <button type="button" className="hs-btn hs-btn-ghost" onClick={() => setAddColOpen(false)}>
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
          </div>
        </div>
      ) : null}

      {emptyMsg ? (
        <p className="rounded-hs border border-dashed border-[var(--border-2)] bg-[var(--card)] p-10 text-center text-sm font-medium text-[var(--ink-3)] shadow-card">
          {emptyMsg}
        </p>
      ) : (
        <div className="hs-mtable overflow-x-auto">
          <div className="hs-mtable-head min-w-max" style={{ gridTemplateColumns: colTplVisible }}>
            {visibleColKeys.map((key, idx) => (
              <span
                key={key}
                className="relative flex min-w-0 items-center px-2 py-1"
                style={{ textAlign: idx === 0 ? "center" : "left" }}
              >
                {headerLabel(mode, key, customColumns)}
                {idx < visibleColKeys.length - 1 ? (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-[var(--accent)]/25"
                    onMouseDown={(e) => onResizeMouseDown(e, key)}
                  />
                ) : null}
              </span>
            ))}
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
                  <span className="hs-mgroup-title" style={{ color: accent }}>
                    {g.key}
                  </span>
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
                        style={{ gridTemplateColumns: colTplVisible }}
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
                              <button
                                type="button"
                                className={`hs-name-check ${isDoneStatus(r.status) ? "done" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void patch(r.id, {
                                    status: isDoneStatus(r.status) ? "In Progress" : "Complete",
                                  });
                                }}
                                aria-label={
                                  isDoneStatus(r.status) ? "Als offen markieren" : "Erledigt"
                                }
                              >
                                {isDoneStatus(r.status) ? (
                                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M5 12l4 4L19 6"
                                      stroke="currentColor"
                                      strokeWidth="2.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                ) : null}
                              </button>
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
                            <button type="button" className="hs-cell-person" title={r.assigned || ""}>
                              <span
                                className="hs-avatar flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9px] font-bold text-white"
                                style={{
                                  background: topicAccent(r.assigned || "?"),
                                }}
                              >
                                {initials(r.assigned)}
                              </span>
                            </button>
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
                            <span className="hs-chip max-w-full !cursor-default truncate">{topic}</span>
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
                          <div className="hs-mcell hs-mcell-meta text-[12px]">
                            {formatDeShort(r.start_date)}
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.end) ? (
                          <div className="hs-mcell hs-mcell-meta">
                            <span className={`hs-due ${isDoneStatus(r.status) ? "done" : ""}`}>
                              {formatDeShort(r.end_date)}
                            </span>
                          </div>
                        ) : null}
                        {!hiddenSet.has(COL.prog) ? (
                          <div className="hs-mcell hs-mcell-prog">
                            <div className="hs-prog-cell w-full">
                              <div className="hs-prog">
                                <span
                                  className="hs-prog-fill bg-[var(--accent)]"
                                  style={{ width: `${prog}%` }}
                                />
                              </div>
                              <span className="hs-prog-num">{prog}%</span>
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
                      </div>
                    );
                  })}
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
    </div>
  );
}
