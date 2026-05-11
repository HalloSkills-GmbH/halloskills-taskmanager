import { notFound } from "next/navigation";
import { DepartmentBoardsClient } from "@/components/workspace/DepartmentBoardsClient";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";

export default async function DepartmentBoardsPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const supabase = await createClient();
  const { data: boards, error } = await supabase
    .from("department_boards")
    .select("id,name")
    .eq("department_id", dept.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">Boards · {dept.name}</h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-app-text">
        Pro Board eigener Name und eigene Spalten (Status). Im Kanban erscheinen nur Aufgaben, die
        einem Projekt auf diesem Board zugeordnet sind — Projekt zuerst auf der Board-Seite anlegen.
      </p>
      {error ? (
        <p className="mt-6 rounded-xl border border-[#E0C878]/80 bg-[#FBEBC5]/40 px-4 py-2.5 text-sm text-[#8A6A12]">
          {error.message} — Migration <code className="font-mono text-xs">004</code> ausführen?
        </p>
      ) : null}
      <div className="mt-8">
        <DepartmentBoardsClient
          departmentId={dept.id}
          deptSlug={dept.slug}
          initialBoards={boards ?? []}
        />
      </div>
    </div>
  );
}
