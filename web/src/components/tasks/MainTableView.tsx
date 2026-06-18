"use client";

import {
  addTaskCustomColumn,
  deleteTaskCustomColumn,
  renameTaskCustomColumn,
  saveMainTableColumnOrder,
  saveMainTableGroupSort,
  setTasksBuiltinColumnLabel,
} from "@/app/(app)/main-table/actions";
import { deleteTaskRow, insertTaskRow, reorderTaskRows, updateTaskFields } from "@/app/(app)/okrs/actions";
import { useMainTableSync } from "@/hooks/useMainTableSync";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import type { OkrFilters } from "@/lib/okr/filters";
import {
  filterRowsByBoardProjects,
  filterRowsByDepartmentId,
  filterRowsForOkrView,
  isOperationalRow,
  normalizeItemKind,
} from "@/lib/okr/queries";
import type { TaskListFilters } from "@/lib/tasks/filters";
import { filterTaskListRows } from "@/lib/tasks/filters";
import {
  applyStoredColumnOrder,
  COL,
  customColWidthKey,
  defaultMainTableColumnKeys,
  gridTemplateFromWidths,
  TASKS_PERSISTABLE_BUILTIN_KEYS,
} from "@/lib/tasks/main-table-columns";
import {
  buildTaskForestSubset,
  // collectIdsWithChildren,
  groupForestBy,
  loadExpandedIdsFromStorage,
  quarterKeyForRow,
  saveExpandedIds,
  type TaskTreeNode,
} from "@/lib/tasks/tree";
import { statusVisual, statusVisualFromPalette, topicAccent } from "@/lib/ui/task-status-visual";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import type { StatusOption } from "@/types/profiles";
import { useRouter } from "next/navigation";
import ReactDOM from "react-dom";
import { createClient } from "@/lib/supabase/client";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

const STATUS_DE: Record<string, string> = {
  "Not started": "Nicht gestartet",
  "Planned":     "Geplant",
  "In Progress": "In Bearbeitung",
  "Complete":    "Erledigt",
  "Blocked":     "Blockiert",
};
const STATUS_EN: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_DE).map(([en, de]) => [de, en])
);


function subtaskButtonTitle(mode: "tasks" | "okr" | "deliverables", parent: TaskRow): string {
  if (mode !== "okr") return "Unteraufgabe";
  const k = normalizeItemKind(parent);
  if (k === "objective") return "Key Result hinzufügen";
  if (k === "key_result") return "Aufgabe hinzufügen";
  return "Unteraufgabe";
}

type GroupBy = "none" | "topic" | "status" | "quarter";

export type MainTableGroupBy = GroupBy;

/** Clientseitige Sortierung der projizierten Flachliste vor Baumaufbau (nur sinnvoll im Aufgaben-Modus). */
export type MainTableTaskSort = "none" | "name" | "start" | "end" | "status";

export type OkrContextEntry = { obj: string | null; kr: string | null };

export type MainTableViewProps = {
  mode: "tasks" | "okr" | "deliverables";
  /** Liefert O/KR-Labels pro task_id für den Deliverables-Modus. */
  okrContextMap?: Map<number, OkrContextEntry>;
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
  /** Board-UUID (`department_boards.id`) für StatusConfigurator / board_column_config — nicht `departmentId`. */
  statusConfigBoardId?: string | null;
  /** Gruppierung von außen steuern (z. B. Aufgaben-Toolbar). */
  groupBy?: MainTableGroupBy;
  onGroupByChange?: (g: MainTableGroupBy) => void;
  /** Ausgeblendete Tabellenspalten (`COL.*` oder `custom:…`). */
  hiddenColumnKeys?: string[];
  /** Sichtbarkeit von außen steuern (persistente feste Spalten + board-lokal). */
  onHiddenColumnKeysChange?: (keys: string[]) => void;
  /** Gespeicherte Überschriften fester Spalten (Aufgaben-Modus). */
  builtinColumnLabels?: Record<string, string>;
  taskSort?: MainTableTaskSort;
  /** Kein „Gruppieren“-Select in der Tabellen-Zeile (wird z. B. von der Toolbar übernommen). */
  suppressBuiltInGroupUi?: boolean;
  /** Nur Abteilungs-OKRs: Dropdown, um Aufgaben einem Board-Projekt zuzuordnen. */
  boardProjectOptions?: { id: string; label: string }[];
  /** Verfügbare Personen/Gruppen für den PersonPicker. */
  assigneeOptions?: AssigneeOption[];
  /** Nur Aufgaben mit project_id in dieser Liste (Board-Ansicht). Ungesetzt = keine Zusatzfilterung. */
  restrictProjectIds?: string[];
  /** Suffix für localStorage-Schlüssel (z. B. boardId), damit Board und Abteilung nicht kollidieren. */
  tableStorageScopeSuffix?: string | null;
  /** Neue Top-Level-Aufgaben in der Tabelle erhalten diese project_id (Board-Ansicht). */
  defaultProjectIdForNewTasks?: string | null;
  /** Workspace-Spaltenreihenfolge (main_table_layout.column_order). */
  initialColumnOrder?: string[] | null;
  /** Gespeicherte Gruppen-Reihenfolge (Thema/Status). */
  initialGroupSort?: { topic?: string[]; status?: string[] } | null;
  /** Servergeladene Status-Paletten pro Spalte (`board_column_config`), wenn `statusConfigBoardId` gesetzt. */
  initialBoardStatuses?: Record<string, StatusOption[]> | null;
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

function isDoneStatus(s: string | null | undefined): boolean {
  return (s || "").toLowerCase().includes("complete");
}

type NoteEntry = { id: string; text: string; createdAt: string; author?: string; authorColor?: string };

function parseNotes(raw: string | null | undefined): NoteEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NoteEntry[];
  } catch {}
  // legacy: plain string → wrap as single entry
  return [{ id: "legacy", text: raw, createdAt: "" }];
}

function serializeNotes(notes: NoteEntry[]): string | null {
  if (!notes.length) return null;
  return JSON.stringify(notes);
}

type SharePointLink = { label: string; url: string };

function AttachCell({
  attachments,
  onChange,
}: {
  attachments: unknown[] | null;
  onChange: (links: SharePointLink[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const links: SharePointLink[] = (attachments ?? [])
    .filter((a): a is SharePointLink => !!a && typeof (a as SharePointLink).url === "string");

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setLabelDraft("");
        setUrlDraft("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const addLink = () => {
    const url = urlDraft.trim();
    if (!url) return;
    const label = labelDraft.trim() || url;
    onChange([...links, { label, url }]);
    setLabelDraft("");
    setUrlDraft("");
  };

  return (
    <div className="hs-mcell hs-mcell-center">
      <button
        ref={btnRef}
        type="button"
        className="hs-iconbtn relative"
        title="SharePoint-Links"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {links.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
            {links.length}
          </span>
        )}
      </button>
      {open ? ReactDOM.createPortal(
        <div
          ref={popRef}
          className="fixed z-[9999] w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-pop"
          style={(() => {
            const r = btnRef.current?.getBoundingClientRect();
            return r ? { top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX - 200 } : {};
          })()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[13px] font-bold text-[var(--ink)]">SharePoint-Links</p>
            <p className="text-[11px] text-[var(--muted)]">Links zu Dateien oder Ordnern</p>
          </div>
          <div className="max-h-48 overflow-y-auto px-3 py-2">
            {links.length === 0 ? (
              <p className="py-1 text-[12px] text-[var(--muted)]">Noch keine Links eingetragen.</p>
            ) : links.map((l, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--accent)]">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-[12px] text-[var(--accent)] hover:underline"
                >
                  {l.label}
                </a>
                <button
                  type="button"
                  className="shrink-0 text-[var(--muted)] hover:text-[var(--danger)]"
                  onClick={() => onChange(links.filter((_, j) => j !== i))}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] px-3 py-3 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Bezeichnung (optional)"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              className="hs-input w-full text-[12px]"
            />
            <div className="flex gap-2">
              <input
                type="url"
                autoFocus
                placeholder="https://halloskills.sharepoint.com/…"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addLink(); }}
                className="hs-input flex-1 text-[12px]"
              />
              <button
                type="button"
                onClick={addLink}
                className="hs-btn hs-btn-primary shrink-0 text-[12px]"
              >
                +
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function readCustomFields(row: TaskRow): Record<string, unknown> {
  const c = row.custom_fields;
  if (c && typeof c === "object" && !Array.isArray(c)) return { ...c };
  return {};
}

function StatusCell({
  value,
  onChange,
  options,
  statusPalette,
  dependencies,
  allRows,
  onDependenciesChange,
}: {
  value: string;
  onChange: (s: string) => void;
  options?: readonly string[];
  statusPalette?: StatusOption[] | null;
  dependencies?: number[] | null;
  allRows?: TaskRow[];
  onDependenciesChange?: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const isBlocked = (value || "").toLowerCase().includes("block");
  const vis = statusVisualFromPalette(value, statusPalette);
  const opts =
    options ??
    (statusPalette?.length ? statusPalette.map((s) => s.label) : undefined) ??
    STATUSES;
  const blockerIds = dependencies ?? [];
  const blockerTasks = (allRows ?? []).filter((t) => blockerIds.includes(t.id));
  const searchResults = blockerSearch.trim().length > 0
    ? (allRows ?? []).filter(
        (t) => !blockerIds.includes(t.id) &&
          t.name?.toLowerCase().includes(blockerSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // clean up orphaned dependency IDs when popup opens
  useEffect(() => {
    if (!blockerOpen || !onDependenciesChange) return;
    const validIds = (allRows ?? []).map((t) => t.id);
    const cleaned = blockerIds.filter((id) => validIds.includes(id));
    if (cleaned.length !== blockerIds.length) onDependenciesChange(cleaned);
  }, [blockerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // close blocker popup on outside click
  useEffect(() => {
    if (!blockerOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setBlockerOpen(false);
        setBlockerSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [blockerOpen]);

  return (
    <div className="hs-pop relative h-full min-h-[36px] w-full">
      {/* Status badge — left-click opens status menu, for Blocked also shows blocker count */}
      <div className="group relative h-full w-full">
        <button
          ref={btnRef}
          type="button"
          className="hs-cell-status"
          style={{ background: vis.soft, color: vis.color }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
            setBlockerOpen(false);
          }}
        >
          <span className="hs-dot" style={{ background: vis.dot }} />
          {(STATUS_DE[value] ?? value) || "—"}
          {isBlocked && blockerTasks.length > 0 && (
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: vis.color, color: vis.soft }}
              onClick={(e) => {
                e.stopPropagation();
                setBlockerOpen((o) => !o);
                setOpen(false);
              }}
            >
              {blockerTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Blocker popup (click on Blocked badge) */}
      {blockerOpen && onDependenciesChange ? ReactDOM.createPortal(
        <div
          ref={popRef}
          className="fixed z-[9999] w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-pop"
          style={(() => {
            const r = btnRef.current?.getBoundingClientRect();
            return r ? { top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX } : {};
          })()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[13px] font-bold text-[var(--ink)]">Blockiert durch</p>
            <p className="text-[11px] text-[var(--muted)]">Welche Aufgaben blockieren diese?</p>
          </div>
          {/* Existing blockers */}
          <div className="max-h-48 overflow-y-auto px-3 py-2">
            {blockerTasks.length === 0 ? (
              <p className="py-1 text-[12px] text-[var(--muted)]">Noch keine Aufgabe eingetragen.</p>
            ) : blockerTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
                <span className="text-[12px] text-[var(--ink)]">{t.name}</span>
                <button
                  type="button"
                  className="shrink-0 text-[var(--muted)] hover:text-[var(--danger)]"
                  onClick={() => onDependenciesChange(blockerIds.filter((id) => id !== t.id))}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {/* Search to add */}
          <div className="border-t border-[var(--border)] px-3 py-2">
            <input
              type="text"
              autoFocus
              placeholder="Aufgabe suchen…"
              value={blockerSearch}
              onChange={(e) => setBlockerSearch(e.target.value)}
              className="hs-input w-full text-[12px]"
            />
            {searchResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto">
                {searchResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="hs-menuitem w-full text-left text-[12px]"
                    onClick={() => {
                      onDependenciesChange([...blockerIds, t.id]);
                      setBlockerSearch("");
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      ) : null}

      {/* Status dropdown (non-blocked) — portal to avoid overflow clipping */}
      {open ? ReactDOM.createPortal(
        <div
          className="hs-menu fixed"
          style={(() => {
            const r = btnRef.current?.getBoundingClientRect();
            return r ? { top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, right: "auto", zIndex: 9999 } : { zIndex: 9999 };
          })()}
          onClick={(e) => e.stopPropagation()}
        >
          {opts.map((s) => {
            const c = statusVisualFromPalette(s, statusPalette);
            return (
              <button
                key={s}
                type="button"
                className="hs-menuitem"
                onClick={() => {
                  const enVal = STATUS_EN[s] ?? s;
                  onChange(enVal);
                  setOpen(false);
                  if (enVal.toLowerCase().includes("block") && onDependenciesChange) {
                    setBlockerOpen(true);
                  }
                }}
              >
                <span className="hs-dot" style={{ background: c.dot }} />
                {STATUS_DE[s] ?? s}
              </button>
            );
          })}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function headerLabel(
  mode: "tasks" | "okr" | "deliverables",
  key: string,
  customColumns: TaskCustomColumnRow[],
  builtinColumnLabels: Record<string, string>,
): string {
  let base: string;
  if (key === COL.grab) base = "";
  else if (key === COL.name) base = "Aufgabe";
  else if (key === COL.tipo) base = mode === "deliverables" ? "OKR" : "Typ";
  else if (key === COL.person) base = "Person";
  else if (key === COL.link) base = "OKR";
  else if (key === COL.boardProj) base = "Board / Projekt";
  else if (key === COL.topic) base = "Thema";
  else if (key === COL.status) base = "Status";
  else if (key === COL.start) base = "Start";
  else if (key === COL.end) base = "Ende";
  else if (key === COL.prog) base = "Fortschritt";
  else if (key === COL.attach) base = "📎";
  else if (key === COL.notes) base = "📝";
  else if (key === COL.actions) base = "";
  else if (key.startsWith("custom:")) {
    const ck = key.slice("custom:".length);
    return customColumns.find((c) => c.col_key === ck)?.label ?? ck;
  } else base = "";
  const o = builtinColumnLabels[key]?.trim();
  if (mode === "tasks" && o && !key.startsWith("custom:")) return o;
  return base;
}

const MAX_SUBTASK_DEPTH = 5;

function rowDepthFromRoot(row: TaskRow, byId: Map<number, TaskRow>): number {
  let d = 0;
  let cur: TaskRow | undefined = row;
  while (cur?.parent_id != null) {
    d++;
    cur = byId.get(cur.parent_id);
    if (d > 64) break;
  }
  return d;
}

function groupKeyForRow(r: TaskRow, gb: GroupBy): string {
  if (gb === "none") return "";
  if (gb === "topic") return (r.topic || "Ohne Thema").trim() || "Ohne Thema";
  if (gb === "quarter") return quarterKeyForRow(r);
  return (r.status || "Ohne Status").trim() || "Ohne Status";
}

function SortableColumnHeaderCell({
  id,
  textAlign,
  label,
  menuButton,
  dropdown,
  resize,
}: {
  id: string;
  textAlign: "left" | "center";
  label: ReactNode;
  menuButton: ReactNode;
  dropdown: ReactNode;
  resize: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : undefined,
  };
  const isIconOnly = typeof label !== "string";
  return (
    <span
      ref={setNodeRef}
      style={{ ...style, textAlign }}
      className="group relative flex min-w-0 items-center px-2 py-1"
      {...attributes}
    >
      {isIconOnly ? (
        <span className="flex flex-1 cursor-grab touch-none select-none items-center justify-center" {...listeners}>
          {label}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span
            className="min-w-0 flex-1 cursor-grab touch-none select-none truncate"
            {...listeners}
          >
            {label}
          </span>
          {menuButton}
        </span>
      )}
      {dropdown}
      {resize}
    </span>
  );
}

function SortableGroupShell({
  id,
  sortable,
  accent,
  children,
}: {
  id: string;
  sortable: boolean;
  accent: string;
  children: (opts: { headListeners?: Record<string, unknown> }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      className="hs-mgroup min-w-max"
      style={{ ...style, ["--group-accent" as string]: accent }}
      {...(sortable ? attributes : {})}
    >
      {children({ headListeners: sortable ? listeners : undefined })}
    </div>
  );
}

function SortableTaskTableRow({
  id,
  className,
  gridTemplateColumns,
  grabHidden,
  renderGrab,
  rest,
}: {
  id: string;
  className: string;
  gridTemplateColumns: string;
  grabHidden: boolean;
  renderGrab: (listeners: Record<string, unknown> | undefined) => ReactNode;
  rest: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: CSSProperties = {
    gridTemplateColumns,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={style}
      {...attributes}
      {...(grabHidden ? listeners : {})}
    >
      {!grabHidden ? renderGrab(listeners) : null}
      {rest}
    </div>
  );
}

function AuthorAvatar({ name, color }: { name?: string; color?: string }) {
  const initials = (name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
      style={{ background: color ?? "var(--accent)" }}
      title={name}
    >
      {initials}
    </div>
  );
}

function NotesPanelInner({
  row,
  onClose,
  onSave,
  assigneeOptions,
}: {
  row: TaskRow;
  onClose: () => void;
  onSave: (serialized: string | null) => Promise<void>;
  assigneeOptions: AssigneeOption[];
}) {
  const [notes, setNotes] = useState<NoteEntry[]>(() => parseNotes(row.notes));
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [currentUser, setCurrentUser] = useState<{ name: string; color?: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const email = data.user.email ?? "";
      const profile = assigneeOptions.find(
        (o) => o.type === "profile" && (o.id === data.user!.id || (o as { email?: string }).email === email)
      );
      if (profile) {
        setCurrentUser({ name: profile.name, color: profile.color });
      } else {
        setCurrentUser({ name: email.split("@")[0] ?? "Ich" });
      }
    });
  }, [assigneeOptions]);

  const save = async (updated: NoteEntry[]) => {
    setNotes(updated);
    await onSave(serializeNotes(updated));
  };

  const addNote = async () => {
    if (!draft.trim()) return;
    const entry: NoteEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: draft.trim(),
      createdAt: new Date().toISOString(),
      author: currentUser?.name,
      authorColor: currentUser?.color,
    };
    await save([...notes, entry]);
    setDraft("");
  };

  const deleteNote = async (id: string) => {
    await save(notes.filter((n) => n.id !== id));
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await save(notes.map((n) => n.id === id ? { ...n, text: editText.trim() } : n));
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex" onClick={onClose}>
      <div className="flex-1 bg-black/20" />
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Notizen</p>
            <h3 className="mt-0.5 text-[15px] font-bold text-[var(--ink)]">{row.name}</h3>
          </div>
          <button type="button" className="hs-iconbtn" onClick={onClose}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* notes list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {notes.length === 0 && (
            <p className="text-[13px] text-[var(--muted)]">Noch keine Notizen.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="flex gap-3 group/note">
              <AuthorAvatar name={n.author} color={n.authorColor} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {n.author && <span className="text-[12px] font-semibold text-[var(--ink)]">{n.author}</span>}
                    <span className="text-[11px] text-[var(--muted)]">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="hs-iconbtn !w-6 !h-6 text-[var(--muted)] hover:text-[var(--ink)]"
                      onClick={() => { setEditingId(n.id); setEditText(n.text); }}
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="hs-iconbtn !w-6 !h-6 text-[var(--muted)] hover:text-[var(--danger)]"
                      onClick={() => void deleteNote(n.id)}
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                {editingId === n.id ? (
                  <div className="rounded-xl border border-[var(--accent)] bg-[var(--bg)]">
                    <textarea
                      autoFocus
                      className="w-full resize-none bg-transparent px-3 pt-3 pb-2 text-[13px] text-[var(--ink)] outline-none"
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 px-3 pb-3">
                      <button type="button" className="hs-btn hs-btn-ghost text-[12px]" onClick={() => setEditingId(null)}>Abbrechen</button>
                      <button type="button" className="hs-btn hs-btn-primary text-[12px]" onClick={() => void saveEdit(n.id)}>Speichern</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                    <p className="whitespace-pre-wrap text-[13px] text-[var(--ink)]">{n.text}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* compose */}
        <div className="border-t border-[var(--border)] px-5 py-4">
          <div className="flex gap-3">
            <AuthorAvatar name={currentUser?.name} color={currentUser?.color} />
            <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] focus-within:border-[var(--accent)] transition-colors">
              <textarea
                className="w-full resize-none bg-transparent px-3 pt-3 pb-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                rows={3}
                placeholder="Neue Notiz verfassen…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void addNote(); }}
              />
              <div className="flex items-center justify-end px-3 pb-3">
                <button
                  type="button"
                  disabled={!draft.trim()}
                  className="hs-btn hs-btn-primary text-[12px] disabled:opacity-40"
                  onClick={() => void addNote()}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  statusConfigBoardId = null,
  groupBy: groupByProp,
  onGroupByChange,
  hiddenColumnKeys = [],
  onHiddenColumnKeysChange,
  builtinColumnLabels = {},
  taskSort = "none",
  suppressBuiltInGroupUi = false,
  boardProjectOptions,
  assigneeOptions = [],
  restrictProjectIds,
  tableStorageScopeSuffix = null,
  defaultProjectIdForNewTasks = null,
  initialColumnOrder = null,
  initialGroupSort = null,
  initialBoardStatuses = null,
  okrContextMap,
}: MainTableViewProps) {
  const router = useRouter();
  const storageKey = `main-${mode}-${departmentId ?? "all"}${tableStorageScopeSuffix ? `-${tableStorageScopeSuffix}` : ""}`;
  const [groupByInternal, setGroupByInternal] = useState<GroupBy>(
    mode === "tasks" ? "topic" : mode === "deliverables" ? "none" : "quarter",
  );
  const groupBy = groupByProp ?? groupByInternal;
  const setGroupBy = useCallback(
    (g: GroupBy) => {
      onGroupByChange?.(g);
      if (groupByProp === undefined) setGroupByInternal(g);
    },
    [groupByProp, onGroupByChange],
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if ((mode === "okr" || mode === "deliverables") && (groupByProp ?? "quarter") === "quarter") {
      const month = new Date().getMonth() + 1;
      const curQ = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
      const allQ = [
        "Q1 01.01. - 31.03.",
        "Q2 01.04. - 30.06.",
        "Q3 01.07. - 30.09.",
        "Q4 01.10. - 31.12.",
        "Kein Datum",
      ];
      const curLabel = allQ[curQ - 1];
      return new Set(allQ.filter((q) => q !== curLabel));
    }
    return new Set();
  });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [expandInit, setExpandInit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notesRow, setNotesRow] = useState<TaskRow | null>(null);
  const [addColOpen, setAddColOpen] = useState(false);
  const [addColStep, setAddColStep] = useState<"select" | "configure">("select");
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<
    "text" | "date" | "status" | "dropdown" | "person" | "priority"
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
  const [boardStatuses, setBoardStatuses] = useState<Record<string, StatusOption[]>>(() =>
    statusConfigBoardId ? (initialBoardStatuses ?? {}) : {},
  );
  const [maxDepthModalOpen, setMaxDepthModalOpen] = useState(false);

  useEffect(() => {
    if (!statusConfigBoardId) {
      setBoardStatuses({});
      return;
    }
    setBoardStatuses(initialBoardStatuses ?? {});
  }, [statusConfigBoardId, initialBoardStatuses]);

  const builtinStatusLabelList = useMemo(() => {
    const pal = boardStatuses[COL.status];
    if (pal?.length) return pal.map((s) => s.label);
    return [...STATUSES];
  }, [boardStatuses]);

  const { widths, updateWidthImmediate, customColumns } = useMainTableSync(
    mode,
    initialMergedWidths,
    initialCustomColumns,
    enableRealtime,
    layoutSyncKey,
  );

  const includeOkrBoardProject = mode === "okr" && boardProjectOptions !== undefined;
  const defaultColKeys = useMemo(
    () =>
      applyStoredColumnOrder(
        defaultMainTableColumnKeys(mode, customColumns, includeOkrBoardProject),
        initialColumnOrder ?? null,
      ),
    [mode, customColumns, includeOkrBoardProject, initialColumnOrder],
  );
  const [colKeys, setColKeys] = useState(defaultColKeys);
  useEffect(() => {
    setColKeys(defaultColKeys);
  }, [layoutSyncKey, defaultColKeys]);

  const hiddenSet = useMemo(() => new Set(hiddenColumnKeys), [hiddenColumnKeys]);
  const visibleColKeys = useMemo(
    () => colKeys.filter((k) => !hiddenSet.has(k)),
    [colKeys, hiddenSet],
  );
  const colTplVisible = useMemo(
    () => gridTemplateFromWidths(visibleColKeys, widths),
    [visibleColKeys, widths],
  );

  const sortableColumnIds = useMemo(
    () => visibleColKeys.filter((k) => k !== COL.grab).map((k) => `col:${k}`),
    [visibleColKeys],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const project = useMemo(() => {
    const dept = (rows: TaskRow[]) =>
      departmentId ? filterRowsByDepartmentId(rows, departmentId) : rows;
    const boardScope = (rows: TaskRow[]) =>
      restrictProjectIds === undefined
        ? rows
        : filterRowsByBoardProjects(rows, restrictProjectIds);
    if (mode === "okr" && okrFilters) {
      return (all: TaskRow[]) =>
        boardScope(dept(filterRowsForOkrView(all, okrFilters)));
    }
    if (mode === "tasks" && taskFilters) {
      return (all: TaskRow[]) => boardScope(dept(filterTaskListRows(all, taskFilters)));
    }
    if (departmentId) {
      return (all: TaskRow[]) => boardScope(dept(all));
    }
    return undefined;
  }, [mode, okrFilters, taskFilters, departmentId, restrictProjectIds]);

  const { allRows, rows: projectedRows } = useTasksRealtime(initialTasks, {
    project,
    enabled: enableRealtime,
  });

  const rowById = useMemo(() => {
    const m = new Map<number, TaskRow>();
    for (const r of allRows) m.set(r.id, r);
    return m;
  }, [allRows]);

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
      if (taskSort === "end")
        return (a.end_date || "9999").localeCompare(b.end_date || "9999");
      if (taskSort === "status")
        return (a.status || "").localeCompare(b.status || "", "de", { sensitivity: "base" });
      return 0;
    };
    copy.sort(cmp);
    return copy;
  }, [projectedRows, taskSort]);

  const forest = useMemo(() => buildTaskForestSubset(rowsForForest), [rowsForForest]);

  const groupOrderList = useMemo(() => {
    if (groupBy === "topic") return initialGroupSort?.topic ?? null;
    if (groupBy === "status") return initialGroupSort?.status ?? null;
    return null;
  }, [groupBy, initialGroupSort]);

  const groups = useMemo(
    () => groupForestBy(forest, groupBy, groupOrderList),
    [forest, groupBy, groupOrderList],
  );

  useLayoutEffect(() => {
    if (expandInit || rowsForForest.length === 0) return;
    const stored = mode === "okr" ? null : loadExpandedIdsFromStorage(storageKey);
    setExpandedIds(stored ?? new Set());
    setExpandInit(true);
  }, [forest, storageKey, expandInit, rowsForForest.length, mode]);

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

  const sortableGroupIndices = useMemo(() => groups.map((_, i) => `grp:${i}`), [groups]);
  const groupSortEnabled =
    groupBy !== "none" && groups.length > 1 && !suppressBuiltInGroupUi;

  const onMainDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const a = String(active.id);
      const o = String(over.id);
      if (a === o) return;

      if (a.startsWith("col:") && o.startsWith("col:")) {
        const ak = a.slice(4);
        const ok = o.slice(4);
        if (ak === COL.grab || ok === COL.grab) return;
        const vis = visibleColKeys;
        const ai = vis.indexOf(ak);
        const aj = vis.indexOf(ok);
        if (ai < 0 || aj < 0) return;
        const full = [...colKeys];
        const fi = full.indexOf(vis[ai]!);
        const fj = full.indexOf(vis[aj]!);
        if (fi < 0 || fj < 0) return;
        const next = arrayMove(full, fi, fj);
        setColKeys(next);
        setError(null);
        const res = await saveMainTableColumnOrder({
          viewKey: mode === "okr" ? "okr" : "tasks",
          keys: next,
          includeOkrBoardProject,
        });
        if (!res.ok) setError(res.message);
        else router.refresh();
        return;
      }

      if (a.startsWith("grp:") && o.startsWith("grp:") && groupBy !== "none") {
        const gi = Number(a.slice(4));
        const gj = Number(o.slice(4));
        if (!Number.isFinite(gi) || !Number.isFinite(gj)) return;
        const keys = groups.map((g) => g.key);
        if (gi < 0 || gi >= keys.length || gj < 0 || gj >= keys.length) return;
        const ordered = arrayMove(keys, gi, gj);
        const groupSort = groupBy === "topic" ? { topic: ordered } : { status: ordered };
        setError(null);
        const res = await saveMainTableGroupSort({
          viewKey: mode === "okr" ? "okr" : "tasks",
          groupSort,
        });
        if (!res.ok) setError(res.message);
        else router.refresh();
        return;
      }

      if (a.startsWith("task:") && o.startsWith("task:")) {
        const idA = Number(a.slice(5));
        const idB = Number(o.slice(5));
        if (!Number.isFinite(idA) || !Number.isFinite(idB)) return;
        const rowA = rowById.get(idA);
        const rowB = rowById.get(idB);
        if (!rowA || !rowB || rowA.parent_id !== rowB.parent_id) return;
        const gkA = groupKeyForRow(rowA, groupBy);
        if (groupKeyForRow(rowB, groupBy) !== gkA) return;
        const parentId = rowA.parent_id;
        const siblings = projectedRows
          .filter((r) => r.parent_id === parentId && groupKeyForRow(r, groupBy) === gkA)
          .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0) || x.id - y.id);
        const oldI = siblings.findIndex((r) => r.id === idA);
        const newI = siblings.findIndex((r) => r.id === idB);
        if (oldI < 0 || newI < 0) return;
        const nextSibs = arrayMove(siblings, oldI, newI);
        const updates = nextSibs.map((r, i) => ({ id: r.id, sort_order: i }));
        setError(null);
        const res = await reorderTaskRows({ updates });
        if (!res.ok) setError(res.message);
        else router.refresh();
      }
    },
    [
      visibleColKeys,
      colKeys,
      mode,
      includeOkrBoardProject,
      router,
      groups,
      groupBy,
      rowById,
      projectedRows,
    ],
  );

  const addSubtask = useCallback(
    async (parent: TaskRow) => {
      if (rowDepthFromRoot(parent, rowById) >= MAX_SUBTASK_DEPTH) {
        setMaxDepthModalOpen(true);
        return;
      }
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
            assigned: parent.assigned ?? null,
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
            name: "Neues Deliverable",
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
            assigned: parent.assigned ?? null,
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
    [mode, departmentId, rowById],
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
      // When grouping by quarter, derive end_date from quarter label
      const quarterEnd: string | null = (() => {
        if (groupBy !== "quarter") return null;
        if (groupKey.startsWith("Q1")) return `${new Date().getFullYear()}-03-31`;
        if (groupKey.startsWith("Q2")) return `${new Date().getFullYear()}-06-30`;
        if (groupKey.startsWith("Q3")) return `${new Date().getFullYear()}-09-30`;
        if (groupKey.startsWith("Q4")) return `${new Date().getFullYear()}-12-31`;
        return null;
      })();

      const res = await insertTaskRow({
        name: mode === "okr" ? "Neues Objective" : "Neue Aufgabe",
        item_kind: itemKind,
        parent_id: null,
        okr_objective_id: null,
        okr_key_result_id: null,
        start_date: today,
        end_date: quarterEnd ?? end.toISOString().slice(0, 10),
        topic: topicVal,
        status: statusVal,
        progress: 0,
        notes: "",
        assigned: null,
        department_id: departmentId ?? null,
        project_id: defaultProjectIdForNewTasks ?? null,
        dependencies: [],
        attachments: [],
        custom_fields: {},
      });
      setBusy(false);
      if (!res.ok) setError(res.message);
    },
    [mode, groupBy, departmentId, defaultProjectIdForNewTasks],
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
      if (groupBy === "status") return statusVisualFromPalette(key, boardStatuses[COL.status]).color;
      if (groupBy === "topic") return topicAccent(key);
      if (groupBy === "quarter") {
        if (key.startsWith("Q1")) return "#7c3aed"; // Violett
        if (key.startsWith("Q2")) return "#2563eb"; // Blau
        if (key.startsWith("Q3")) return "#059669"; // Grün
        if (key.startsWith("Q4")) return "#d97706"; // Orange
        return "#6b7280";
      }
      return "var(--accent)";
    },
    [groupBy, boardStatuses],
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

  function renderOneTaskRow(node: TaskTreeNode, depth: number): ReactNode {
    const r = node.row;
    const hasKids = node.children.length > 0;
    const open = expandedIds.has(r.id);
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
                  {linked.length} {linked.length === 1 ? "Deliverable" : "Deliverables"}
                </span>
              ) : (
                <span className="text-[var(--muted)]">—</span>
              );
            })()
          ) : kind === "objective" ? (
            (() => {
              const krCount = keyResults.filter((k) => k.okr_objective_id === r.id).length;
              return krCount ? (
                <span className="hs-name-kr inline-flex max-w-full">
                  {krCount} {krCount === 1 ? "Key Result" : "Key Results"}
                </span>
              ) : (
                <span className="text-[var(--muted)]">—</span>
              );
            })()
          ) : isOperationalRow(r) && r.okr_key_result_id ? (
            (() => {
              const kr = keyResults.find((k) => k.id === r.okr_key_result_id);
              return (
                <span className="text-[var(--positive)] truncate" title={kr ? `KR #${kr.name}` : `KR #${r.okr_key_result_id}`}>
                  KR #{kr ? kr.name.slice(0, 25) + (kr.name.length > 25 ? "…" : "") : r.okr_key_result_id}
                </span>
              );
            })()
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
      if (c.col_type === "text" || c.col_type === "person") {
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
      if (c.col_type === "status") {
        const palKey = `custom:${c.col_key}`;
        const customPal = boardStatuses[palKey];
        const stOpts = customPal?.length
          ? customPal.map((s) => s.label)
          : c.status_options?.length
            ? c.status_options
            : [...STATUSES];
        const v = raw != null ? String(raw) : stOpts[0] ?? "";
        return (
          <div key={wk} className="hs-mcell hs-mcell-fill !p-0 min-w-0">
            <StatusCell
              value={v}
              options={stOpts}
              statusPalette={customPal?.length ? customPal : null}
              onChange={(s) => void patchCustom(r, c.col_key, s)}
            />
          </div>
        );
      }
      if (c.col_type === "dropdown" || c.col_type === "priority") {
        const opts =
          c.col_type === "dropdown"
            ? c.status_options?.length
              ? c.status_options
              : ["Option 1", "Option 2"]
            : c.status_options?.length
              ? c.status_options
              : ["Niedrig", "Mittel", "Hoch"];
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
      }
      return null;
    });

    const grabHidden = hiddenSet.has(COL.grab);
    return (
      <SortableTaskTableRow
        key={r.id}
        id={`task:${r.id}`}
        className={`hs-mrow min-w-max ${sub ? "hs-msub" : ""}`}
        gridTemplateColumns={mode === "tasks" ? `${colTplVisible} 100px` : colTplVisible}
        grabHidden={grabHidden}
        renderGrab={(listeners) => (
          <div
            className="hs-mcell hs-mcell-grab hs-mcell-center text-[var(--muted)] touch-none"
            {...listeners}
          >
            ···
          </div>
        )}
        rest={
          <>
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
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {(mode === "okr" || mode === "deliverables") && !hiddenSet.has(COL.tipo) ? (
          <div className="hs-mcell">
            {mode === "deliverables" ? (
              (() => {
                const ctx = okrContextMap?.get(r.id);
                return (
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {ctx?.obj ? (
                      <span className="block truncate rounded px-1.5 py-[1px] text-[10px] font-semibold leading-tight" style={{ background: "#EEF2FF", color: "#4338CA", maxWidth: 200 }}>
                        O: {ctx.obj}
                      </span>
                    ) : null}
                    {ctx?.kr ? (
                      <span className="block truncate rounded px-1.5 py-[1px] text-[10px] font-semibold leading-tight" style={{ background: "#ECFDF5", color: "#065F46", maxWidth: 200 }}>
                        KR: {ctx.kr}
                      </span>
                    ) : null}
                    {!ctx?.obj && !ctx?.kr ? (
                      <span className="text-[11px] text-[var(--muted)]">—</span>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              (() => {
                const kind = (r.item_kind || "task").toLowerCase();
                const cfg =
                  kind === "objective"
                    ? { label: "Objective", bg: "#EEF2FF", color: "#4338CA" }
                    : kind === "key_result"
                    ? { label: "Key Result", bg: "#ECFDF5", color: "#065F46" }
                    : { label: "Deliverable", bg: "#FFF7ED", color: "#9A3412" };
                return (
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                );
              })()
            )}
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
        {!hiddenSet.has(COL.status) ? (
          <div className="hs-mcell hs-mcell-fill !p-0">
            <StatusCell
              value={r.status || builtinStatusLabelList[0] || "Not started"}
              options={builtinStatusLabelList}
              statusPalette={boardStatuses[COL.status]}
              onChange={(s) => void patch(r.id, { status: s })}
              dependencies={r.dependencies}
              allRows={allRows}
              onDependenciesChange={(ids) => void patch(r.id, { dependencies: ids })}
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
            {mode === "okr" && kind !== "key_result" ? null : (() => {
              const deliverables = node.children;
              const total = deliverables.length;
              const doneCount = deliverables.filter(c => isDoneStatus(c.row.status)).length;
              const autoPct = total ? Math.round((doneCount / total) * 100) : 0;
              return (
                <div className="hs-prog-cell w-full">
                  <div className="hs-prog">
                    <span className="hs-prog-fill bg-[var(--accent)]" style={{ width: `${autoPct}%` }} />
                  </div>
                  <span className="hs-prog-num">{autoPct}%</span>
                </div>
              );
            })()}
          </div>
        ) : null}
        {!hiddenSet.has(COL.attach) ? (
          <AttachCell
            attachments={r.attachments}
            onChange={(links) => void patch(r.id, { attachments: links })}
          />
        ) : null}
        {(mode === "okr" || mode === "deliverables") && !hiddenSet.has(COL.notes) ? (
          <div className="hs-mcell hs-mcell-center">
            <button
              type="button"
              className="hs-iconbtn hs-notes-btn"
              title={parseNotes(r.notes).length > 0 ? `${parseNotes(r.notes).length} Notiz(en)` : "Notiz hinzufügen"}
              onClick={(e) => {
                e.stopPropagation();
                setNotesRow(r);
              }}
              style={r.notes ? { color: "#2563eb" } : undefined}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {r.notes ? <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#2563eb]" /> : null}
            </button>
          </div>
        ) : null}
        {customCells}
        {(mode === "okr" || mode === "deliverables") && !hiddenSet.has(COL.actions) ? (
          <div className="hs-mcell hs-mcell-center">
            <button
              type="button"
              className="hs-iconbtn !text-[var(--danger)] hover:!text-[var(--danger)]"
              onClick={() => void removeRow(r.id)}
              title="Löschen"
              aria-label="Löschen"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : null}
        <div className="hs-mcell" />
          </>
        }
      />
    );
  }

  function renderTaskRowsNested(nodes: TaskTreeNode[], depth: number): ReactNode {
    if (nodes.length === 0) return null;
    return (
      <SortableContext
        items={nodes.map((n) => `task:${n.row.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {nodes.map((node) => (
          <Fragment key={node.row.id}>
            {renderOneTaskRow(node, depth)}
            {node.children.length > 0 && expandedIds.has(node.row.id)
              ? renderTaskRowsNested(node.children, depth + 1)
              : null}
          </Fragment>
        ))}
      </SortableContext>
    );
  }

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
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Spaltentyp</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: "status" as const, label: "Status", color: "#00c875", icon: "M4 6h16M4 12h12M4 18h8" },
                      { type: "dropdown" as const, label: "Drop-down", color: "#00c875", icon: "M6 9l6 6 6-6" },
                      { type: "text" as const, label: "Text", color: "#fdab3d", icon: "M4 6h16M4 12h16M4 18h10" },
                      { type: "date" as const, label: "Datum", color: "#00c875", icon: "M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
                      { type: "person" as const, label: "Personen", color: "#579bfc", icon: "M16 14a4 4 0 10-8 0M12 10a3 3 0 100-6 3 3 0 000 6z" },
                      { type: "priority" as const, label: "Priorität", color: "#ffcb00", icon: "M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.77l-7-14a2 2 0 00-3.68 0l-7 14A2 2 0 005 19z" },
                    ].map((col) => (
                      <button
                        key={col.type}
                        type="button"
                        onClick={() => {
                          setNewColType(col.type);
                          setAddColStep("configure");
                        }}
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
                    {newColType === "priority" && "Priorität-Spalte"}
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
        <div className="rounded-hs border border-dashed border-[var(--border-2)] bg-[var(--card)] p-10 text-center shadow-card">
          <p className="text-sm font-medium text-[var(--ink-3)]">{emptyMsg}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addTaskToGroup("Planned")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--hover)] disabled:opacity-50"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {mode === "okr" ? "Erstes Objective anlegen" : "Erste Aufgabe anlegen"}
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onMainDragEnd}>
        <div className="hs-mtable overflow-x-auto">
          <div className="hs-mtable-head min-w-max" style={{ gridTemplateColumns: mode === "tasks" ? `${colTplVisible} 100px` : colTplVisible }}>
            <SortableContext items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
            {visibleColKeys.map((key, idx) => {
              const isCustom = key.startsWith("custom:");
              const colId = isCustom ? key.slice("custom:".length) : key;
              const showBuiltinColMenu =
                mode === "tasks" && !isCustom && TASKS_PERSISTABLE_BUILTIN_KEYS.has(key);
              const menuOpen = colMenuOpen === key;
              const headLabelRaw = headerLabel(mode, key, customColumns, builtinColumnLabels);
              const headLabel: ReactNode =
                key === COL.attach ? (
                  <span className="flex w-full items-center justify-center">
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-label="Anhänge"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                ) : key === COL.notes ? (
                  <span className="flex w-full items-center justify-center">
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-label="Notiz"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                ) : key === COL.prog ? "Forts." : headLabelRaw;
              const menuButton =
                idx > 0 ? (
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
                ) : null;
              const menuDropdown = menuOpen ? (
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
                  {(key === COL.status ||
                    (isCustom && customColumns.find((c) => c.col_key === colId)?.col_type === "status")) ? (
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
                          const row = customColumns.find((c) => c.col_key === colId);
                          if (!row) return;
                          const newName = window.prompt("Neuer Spaltenname:", headLabelRaw);
                          if (!newName?.trim()) {
                            setColMenuOpen(null);
                            return;
                          }
                          setError(null);
                          void (async () => {
                            const res = await renameTaskCustomColumn({ id: row.id, label: newName.trim() });
                            if (!res.ok) setError(res.message);
                            else router.refresh();
                          })();
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
                          const meta = customColumns.find((c) => c.col_key === colId);
                          if (!meta) {
                            setColMenuOpen(null);
                            return;
                          }
                          if (window.confirm("Diese Spalte wirklich löschen?")) {
                            setError(null);
                            void (async () => {
                              const res = await deleteTaskCustomColumn({ id: meta.id });
                              if (!res.ok) setError(res.message);
                              else router.refresh();
                            })();
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
                  ) : showBuiltinColMenu ? (
                    <>
                      <div className="my-1 border-t border-[var(--border)]" />
                      {key !== COL.grab ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
                          onClick={() => {
                            const newName = window.prompt("Neuer Spaltenname (leer = Standard):", headLabelRaw);
                            if (newName === null) {
                              setColMenuOpen(null);
                              return;
                            }
                            setError(null);
                            void (async () => {
                              const res = await setTasksBuiltinColumnLabel({
                                colKey: key,
                                label: newName.trim(),
                              });
                              if (!res.ok) setError(res.message);
                              else router.refresh();
                            })();
                            setColMenuOpen(null);
                          }}
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <path d="M15.232 5.232l3.536 3.536M4 20h4l10-10a2.5 2.5 0 00-3.536-3.536L4 16.464V20z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Umbenennen
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--danger)] hover:bg-[var(--hover)]"
                        onClick={() => {
                          onHiddenColumnKeysChange?.([...new Set([...hiddenColumnKeys, key])]);
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
              ) : null;
              const resizeHandle =
                idx < visibleColKeys.length - 1 ? (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-[var(--accent)]/25"
                    onMouseDown={(e) => onResizeMouseDown(e, key)}
                  />
                ) : null;

              if (key === COL.grab) {
                return (
                  <span
                    key={key}
                    className="group relative flex min-w-0 items-center px-2 py-1"
                    style={{ textAlign: idx === 0 || (key as string) === COL.attach || (key as string) === COL.notes ? "center" : "left" }}
                  >
                    <span className="truncate">{headLabel}</span>
                    {menuButton}
                    {menuDropdown}
                    {resizeHandle}
                  </span>
                );
              }

              return (
                <SortableColumnHeaderCell
                  key={key}
                  id={`col:${key}`}
                  textAlign={idx === 0 || key === COL.attach || key === COL.notes ? "center" : "left"}
                  label={headLabel}
                  menuButton={menuButton}
                  dropdown={menuDropdown}
                  resize={resizeHandle}
                />
              );
            })}
            </SortableContext>
            {mode === "tasks" && (
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
            )}
          </div>

          {(() => {
            const cards = groups.map((g, gi) => {
              const collapsed = collapsedGroups.has(g.key);
              const flat = flattenVisible(g.roots, expandedIds);
              const count = flat.length;
              const done = flat.filter(({ node }) => isDoneStatus(node.row.status)).length;
              const pct = count ? Math.round((done / count) * 100) : 0;
              const objectiveCount = mode === "okr" && groupBy === "quarter"
                ? g.roots.filter(({ row }) => normalizeItemKind(row) === "objective").length
                : null;
              const accent = groupAccent(g.key);

              return (
                <SortableGroupShell
                  key={g.key}
                  id={`grp:${gi}`}
                  sortable={groupSortEnabled}
                  accent={accent}
                >
                  {({ headListeners }) => (
                    <>
                      <div className="hs-mgroup-head touch-none" {...(headListeners ?? {})}>
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
                          {objectiveCount !== null
                            ? `${objectiveCount} ${objectiveCount === 1 ? "Objective" : "Objectives"}`
                            : `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`}
                        </span>
                        <div className="hs-mgroup-progress">
                          <span className="hs-mgroup-bar" style={{ width: `${pct}%`, background: accent }} />
                        </div>
                        <span className="hs-mgroup-pct">{pct}%</span>
                      </div>

                      {!collapsed && renderTaskRowsNested(g.roots, 0)}
                      {mode !== "deliverables" && (
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
                      )}
                    </>
                  )}
                </SortableGroupShell>
              );
            });

            return groupSortEnabled ? (
              <SortableContext items={sortableGroupIndices} strategy={verticalListSortingStrategy}>
                {cards}
              </SortableContext>
            ) : (
              cards
            );
          })()}
        </div>
        </DndContext>
      )}

      {notesRow ? (
        <NotesPanelInner
          row={notesRow}
          onClose={() => setNotesRow(null)}
          assigneeOptions={assigneeOptions}
          onSave={async (serialized) => {
            await patch(notesRow.id, { notes: serialized });
            setNotesRow((prev) => prev ? { ...prev, notes: serialized } : null);
          }}
        />
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

      {statusConfigOpen && statusConfigBoardId ? (
        <StatusConfigurator
          boardId={statusConfigBoardId}
          columnKey={statusConfigOpen}
          statuses={boardStatuses[statusConfigOpen] ?? STATUSES.map((s) => ({
            id: s.toLowerCase().replace(/\s+/g, "_"),
            label: s,
            color: statusVisual(s).color,
          }))}
          onClose={() => setStatusConfigOpen(null)}
          onUpdate={(statuses) => {
            setBoardStatuses((prev) => ({ ...prev, [statusConfigOpen]: statuses }));
          }}
        />
      ) : null}

      {maxDepthModalOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setMaxDepthModalOpen(false)}
        >
          <div
            className="max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="max-depth-title"
          >
            <h3 id="max-depth-title" className="mb-2 text-[15px] font-bold text-[var(--ink)]">
              Unterebenen-Limit
            </h3>
            <p className="text-[14px] text-[var(--ink-3)]">
              Es sind maximal {MAX_SUBTASK_DEPTH} Unterebenen erlaubt.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" className="hs-btn hs-btn-primary" onClick={() => setMaxDepthModalOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
