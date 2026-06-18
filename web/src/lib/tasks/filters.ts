import { z } from "zod";
import type { TaskRow } from "@/types/tasks";

export const taskListFilterSchema = z.object({
  q: z.string().default(""),
  status: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  /** Teilstring auf `assigned` (Person), URL-Param `assignee`. */
  assignee: z.string().nullable().optional(),
});

export type TaskListFilters = z.infer<typeof taskListFilterSchema>;

export function parseTaskListFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): TaskListFilters {
  const get = (key: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
    const raw = sp[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };
  return taskListFilterSchema.parse({
    q: get("q") ?? "",
    status: get("status") ?? null,
    topic: get("topic") ?? null,
    assignee: get("assignee") ?? null,
  });
}

export function serializeTaskListFilters(f: TaskListFilters): string {
  const u = new URLSearchParams();
  if (f.q) u.set("q", f.q);
  if (f.status) u.set("status", f.status);
  if (f.topic) u.set("topic", f.topic);
  if (f.assignee) u.set("assignee", f.assignee);
  return u.toString();
}

export function taskListFiltersActive(f: TaskListFilters): boolean {
  return !!(f.q.trim() || f.status || f.topic || f.assignee);
}

export function filterTaskListRows(rows: TaskRow[], f: TaskListFilters): TaskRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status && (r.status || "").trim() !== f.status.trim()) return false;
    if (f.topic) {
      const t = (r.topic || "").toLowerCase();
      if (!t.includes(f.topic.trim().toLowerCase())) return false;
    }
    if (f.assignee) {
      const a = (Array.isArray(r.assigned) ? r.assigned.join(" ") : r.assigned || "").toLowerCase();
      if (!a.includes(f.assignee.trim().toLowerCase())) return false;
    }
    if (!q) return true;
    const assignedStr = Array.isArray(r.assigned) ? r.assigned.join(" ") : (r.assigned || "");
    const hay = `${r.name} ${r.notes || ""} ${r.topic || ""} ${assignedStr}`.toLowerCase();
    return hay.includes(q);
  });
}
