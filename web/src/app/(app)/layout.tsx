import {
  ProductShell,
  type DepartmentNavItem,
  type DeptBoardNavItem,
} from "@/components/layout/ProductShell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | undefined;
  let departments: DepartmentNavItem[] = [];
  let departmentBoardsByDeptId: Record<string, DeptBoardNavItem[]> = {};
  try {
    const supabase = await createClient();
    const [userResult, deptRowsResult, boardRowsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("departments")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("department_boards")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (!userResult.error && userResult.data.user?.email) userEmail = userResult.data.user.email;

    const deptRows = deptRowsResult.data;
    const deptErr = deptRowsResult.error;
    if (!deptErr && deptRows) {
      departments = (deptRows as { id: string; name: string; slug: string; icon?: string; color?: string }[]).map(
        (r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          icon: r.icon ?? undefined,
          color: r.color ?? undefined,
        }),
      );
    }

    const boardRows = boardRowsResult.data;
    const boardErr = boardRowsResult.error;
    if (!boardErr && boardRows) {
      const byDept: Record<string, DeptBoardNavItem[]> = {};
      for (const row of boardRows as {
        id: string;
        name: string;
        department_id: string;
        is_group?: boolean;
        parent_id?: string | null;
        icon?: string;
        color?: string;
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
  } catch (e) {
    console.error("[layout] Supabase Session", e);
    userEmail = undefined;
  }

  return (
    <ProductShell
      userEmail={userEmail}
      departments={departments}
      departmentBoardsByDeptId={departmentBoardsByDeptId}
    >
      {children}
    </ProductShell>
  );
}
