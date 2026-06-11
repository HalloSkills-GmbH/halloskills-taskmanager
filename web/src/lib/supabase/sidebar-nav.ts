import { unstable_cache } from "next/cache";
import type { DepartmentNavItem, DeptBoardNavItem } from "@/components/layout/navigation-types";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_SIDEBAR_NAV_TAG = "app-sidebar-nav";

/** Sidebar-Navigation: schlanke Queries + pro Nutzer gecacht (RLS über Session bei Cache-Miss). */
async function fetchSidebarNavRows(supabase: SupabaseClient): Promise<{
  departments: DepartmentNavItem[];
  departmentBoardsByDeptId: Record<string, DeptBoardNavItem[]>;
}> {
  const [deptRowsResult, boardRowsResult] = await Promise.all([
    supabase
      .from("departments")
      .select("id,name,slug,icon,color,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("department_boards")
      .select("id,name,department_id,is_group,parent_id,icon,color,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  let departments: DepartmentNavItem[] = [];
  const deptErr = deptRowsResult.error;
  const deptRows = deptRowsResult.data;
  if (!deptErr && deptRows) {
    departments = (
      deptRows as {
        id: string;
        name: string;
        slug: string;
        icon?: string | null;
        color?: string | null;
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      icon: r.icon ?? undefined,
      color: r.color ?? undefined,
    }));
  }

  let departmentBoardsByDeptId: Record<string, DeptBoardNavItem[]> = {};
  const boardErr = boardRowsResult.error;
  const boardRows = boardRowsResult.data;
  if (!boardErr && boardRows) {
    const byDept: Record<string, DeptBoardNavItem[]> = {};
    for (const row of boardRows as {
      id: string;
      name: string;
      department_id: string;
      is_group?: boolean | null;
      parent_id?: string | null;
      icon?: string | null;
      color?: string | null;
    }[]) {
      const did = row.department_id;
      if (!byDept[did]) byDept[did] = [];
      byDept[did].push({
        id: row.id,
        name: row.name,
        isGroup: row.is_group ?? false,
        parentId: row.parent_id ?? null,
        icon: row.icon ?? undefined,
        color: row.color ?? undefined,
      });
    }
    departmentBoardsByDeptId = byDept;
  }

  return { departments, departmentBoardsByDeptId };
}

/**
 * Cache-Key enthält userId, damit keine Sidebar-Daten zwischen Nutzern vermischt werden.
 * Invalidierung über {@link APP_SIDEBAR_NAV_TAG} bei Workspace-Mutationen.
 */
export async function getCachedSidebarNav(userId: string) {
  const supabase = await createClient();
  return unstable_cache(
    async () => fetchSidebarNavRows(supabase),
    ["app-sidebar-nav", userId],
    { tags: [APP_SIDEBAR_NAV_TAG], revalidate: 90 },
  )();
}
