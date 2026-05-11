import { notFound } from "next/navigation";
import BoardTasksShell from "@/components/tasks/BoardTasksShell";
import { fetchDepartmentBoardForDept, fetchDepartmentBySlug } from "@/lib/supabase/department-queries";

export default async function DepartmentBoardDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ deptSlug: string; boardId: string }>;
}) {
  const { deptSlug, boardId } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const board = await fetchDepartmentBoardForDept(boardId, dept.id);
  if (!board || board.is_group) notFound();

  return (
    <BoardTasksShell
      boardName={board.name}
      deptDisplayName={dept.name}
      deptSlug={dept.slug}
      boardId={board.id}
    >
      {children}
    </BoardTasksShell>
  );
}
