import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";
import { normalizeItemKind } from "./queries";

export type OkrSnapshotRow = Pick<
  TaskRow,
  "id" | "name" | "status" | "progress" | "item_kind"
>;

export async function fetchDepartmentOkrSnapshot(departmentId: string): Promise<{
  objectives: OkrSnapshotRow[];
  keyResults: OkrSnapshotRow[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id,name,status,progress,item_kind,department_id")
    .eq("department_id", departmentId)
    .order("id");
  if (error || !data) {
    return { objectives: [], keyResults: [] };
  }
  const rows = data as OkrSnapshotRow[];
  return {
    objectives: rows.filter((r) => normalizeItemKind(r as TaskRow) === "objective"),
    keyResults: rows.filter((r) => normalizeItemKind(r as TaskRow) === "key_result"),
  };
}
