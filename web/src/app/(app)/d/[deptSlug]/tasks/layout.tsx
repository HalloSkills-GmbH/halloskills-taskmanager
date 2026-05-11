import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeptTasksShell } from "@/components/tasks/DeptTasksShell";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";

export default async function DepartmentTasksLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-[var(--muted)]">Aufgaben werden geladen…</div>}
    >
      <DeptTasksShell deptSlug={dept.slug}>{children}</DeptTasksShell>
    </Suspense>
  );
}
