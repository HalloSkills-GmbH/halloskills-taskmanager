import { ProductSidebar } from "@/components/layout/ProductShell";
import { getCachedSidebarNav } from "@/lib/supabase/sidebar-nav";
import { createClient } from "@/lib/supabase/server";

/** Async Server-Komponente für Suspense-Streaming der Sidebar. */
export async function AppSidebarLoader() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult.user?.id ?? "anon";
  const userEmail = userResult.user?.email;

  const { departments, departmentBoardsByDeptId } = await getCachedSidebarNav(userId);

  return (
    <ProductSidebar
      userEmail={userEmail}
      departments={departments}
      departmentBoardsByDeptId={departmentBoardsByDeptId}
    />
  );
}
