import {
  ProductShell,
  type DepartmentNavItem,
  type DeptBoardNavItem,
} from "@/components/layout/ProductShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | undefined;
  let departments: DepartmentNavItem[] = [];
  let departmentBoardsByDeptId: Record<string, DeptBoardNavItem[]> = {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.email) userEmail = data.user.email;

    const { data: deptRows, error: deptErr } = await supabase
      .from("departments")
      .select("id,name,slug")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!deptErr && deptRows) {
      departments = deptRows as DepartmentNavItem[];
    }

    const { data: boardRows, error: boardErr } = await supabase
      .from("department_boards")
      .select("id,name,department_id")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!boardErr && boardRows) {
      const byDept: Record<string, DeptBoardNavItem[]> = {};
      for (const row of boardRows as { id: string; name: string; department_id: string }[]) {
        const did = row.department_id;
        if (!byDept[did]) byDept[did] = [];
        byDept[did].push({ id: row.id, name: row.name });
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
