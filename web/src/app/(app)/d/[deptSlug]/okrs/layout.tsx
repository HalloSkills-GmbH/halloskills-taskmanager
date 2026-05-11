import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeptOkrShellBridge } from "@/components/okr/DeptOkrShellBridge";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";

export default async function DepartmentOkrsLayout({
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
      fallback={<div className="p-6 text-sm text-[var(--muted)]">OKRs werden geladen…</div>}
    >
      <DeptOkrShellBridge deptName={dept.name}>{children}</DeptOkrShellBridge>
    </Suspense>
  );
}
