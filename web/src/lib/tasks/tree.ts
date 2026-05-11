import type { TaskRow } from "@/types/tasks";

export type TaskTreeNode = {
  row: TaskRow;
  children: TaskTreeNode[];
};

/** Baut einen Wald aus `parent_id` (null = Wurzel). Geschwister nach `id`. */
export function buildTaskForest(rows: TaskRow[]): TaskTreeNode[] {
  const childrenByParent = new Map<number | "root", TaskRow[]>();

  for (const r of rows) {
    const p = r.parent_id;
    const key = p == null ? "root" : p;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(r);
  }

  for (const list of childrenByParent.values()) {
    list.sort((a, b) => {
      const sa = a.sort_order ?? 0;
      const sb = b.sort_order ?? 0;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });
  }

  const roots = childrenByParent.get("root") ?? [];

  function toNode(row: TaskRow): TaskTreeNode {
    const kids = childrenByParent.get(row.id) ?? [];
    return { row, children: kids.map(toNode) };
  }

  return roots.map(toNode);
}

/** Wald nur aus `rows`; fehlende Eltern werden wie Wurzel behandelt (OKR-/Listen-Filter). */
export function buildTaskForestSubset(rows: TaskRow[]): TaskTreeNode[] {
  const ids = new Set(rows.map((r) => r.id));
  const normalized: TaskRow[] = rows.map((r) =>
    r.parent_id != null && ids.has(r.parent_id) ? r : { ...r, parent_id: null },
  );
  return buildTaskForest(normalized);
}

export function collectIdsWithChildren(forest: TaskTreeNode[]): Set<number> {
  const s = new Set<number>();
  function walk(n: TaskTreeNode) {
    if (n.children.length) {
      s.add(n.row.id);
      n.children.forEach(walk);
    }
  }
  forest.forEach(walk);
  return s;
}

export type GroupedForest = { key: string; roots: TaskTreeNode[] };

export function groupForestBy(
  forest: TaskTreeNode[],
  groupBy: "none" | "topic" | "status",
  groupOrder?: string[] | null,
): GroupedForest[] {
  if (groupBy === "none") {
    return [{ key: "Alle Aufgaben", roots: forest }];
  }
  const map = new Map<string, TaskTreeNode[]>();
  for (const node of forest) {
    const raw =
      groupBy === "topic"
        ? (node.row.topic || "Ohne Thema").trim() || "Ohne Thema"
        : (node.row.status || "Ohne Status").trim() || "Ohne Status";
    if (!map.has(raw)) map.set(raw, []);
    map.get(raw)!.push(node);
  }
  const entries = [...map.entries()];
  const order = groupOrder?.length ? groupOrder : null;
  if (order) {
    entries.sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      const aKnown = ia !== -1;
      const bKnown = ib !== -1;
      if (aKnown && bKnown) return ia - ib;
      if (aKnown && !bKnown) return -1;
      if (!aKnown && bKnown) return 1;
      return a.localeCompare(b, "de");
    });
  } else {
    entries.sort(([a], [b]) => a.localeCompare(b, "de"));
  }
  return entries.map(([key, roots]) => ({ key, roots }));
}

const EXPAND_KEY = "halloskills-main-table-expanded";

/** `null`: noch nie gespeichert → UI kann alle Klappknoten standardmäßig öffnen. */
export function loadExpandedIdsFromStorage(mode: string): Set<number> | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${EXPAND_KEY}:${mode}`);
  if (raw === null) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveExpandedIds(mode: string, ids: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${EXPAND_KEY}:${mode}`, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}
