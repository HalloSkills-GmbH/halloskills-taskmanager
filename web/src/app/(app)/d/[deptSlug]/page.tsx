import Link from "next/link";
import { notFound } from "next/navigation";
import { DepartmentAddObjectiveForm } from "@/components/okr/DepartmentAddObjectiveForm";
import { DepartmentOkrPreview } from "@/components/okr/DepartmentOkrPreview";
import { normalizeItemKind } from "@/lib/okr/queries";
import { fetchDepartmentBySlug } from "@/lib/supabase/department-queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/types/tasks";

export default async function DepartmentHubPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>;
}) {
  const { deptSlug } = await params;
  const dept = await fetchDepartmentBySlug(deptSlug);
  if (!dept) notFound();

  const supabase = await createClient();
  const [tasksRes, boardsRes] = await Promise.all([
    supabase.from("tasks").select("id,item_kind").eq("department_id", dept.id),
    supabase.from("department_boards").select("id,name").eq("department_id", dept.id).order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);

  const tasks = (tasksRes.data ?? []) as Pick<TaskRow, "id" | "item_kind">[];
  const objectives = tasks.filter((t) => normalizeItemKind(t as TaskRow) === "objective");
  const boards = boardsRes.data ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-14 pt-8">
      <h1 className="text-[1.85rem] font-bold tracking-tight text-app-ink">{dept.name}</h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-app-text">
        Abteilungsbereich: Aufgaben und OKRs nur für Zeilen mit dieser Abteilung. Boards sind
        pro Abteilung frei benennbar; Spalten entsprechen Status-Werten beim Kanban.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wide text-app-muted">Zeilen</p>
          <p className="mt-2 text-2xl font-bold text-app-ink">{tasks.length}</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wide text-app-muted">Objectives</p>
          <p className="mt-2 text-2xl font-bold text-app-ink">{objectives.length}</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wide text-app-muted">Boards</p>
          <p className="mt-2 text-2xl font-bold text-app-ink">{boards.length}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/d/${dept.slug}/tasks`}
          className="rounded-xl border border-app-border bg-app-card px-4 py-2.5 text-sm font-bold shadow-sm hover:border-app-brand-soft"
        >
          Aufgaben
        </Link>
        <Link
          href={`/d/${dept.slug}/okrs/table`}
          className="rounded-xl border border-app-border bg-app-card px-4 py-2.5 text-sm font-bold shadow-sm hover:border-app-brand-soft"
        >
          OKRs
        </Link>
        <Link
          href={`/d/${dept.slug}/boards`}
          className="rounded-xl border border-app-border bg-app-card px-4 py-2.5 text-sm font-bold shadow-sm hover:border-app-brand-soft"
        >
          Board-Übersicht
        </Link>
      </div>

      <section className="mt-10 rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
        <DepartmentAddObjectiveForm departmentId={dept.id} />
        <p className="mt-4 text-xs leading-relaxed text-app-muted">
          Key Results und operative Aufgaben legst du in der{" "}
          <Link href={`/d/${dept.slug}/okrs/table`} className="font-semibold text-app-brand hover:underline">
            OKR-Tabelle
          </Link>{" "}
          unter einem Objective an (Zeile aufklappen oder Aktionen in der Tabelle).
        </p>
      </section>

      <DepartmentOkrPreview departmentId={dept.id} deptSlug={dept.slug} />

      {boards.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-app-muted">Abteilungs-Boards</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/d/${dept.slug}/boards/${b.id}`}
                  className="block rounded-2xl border border-app-border bg-app-card p-4 shadow-card transition hover:border-app-brand-soft"
                >
                  <span className="font-bold text-app-ink">{b.name}</span>
                  <span className="mt-1 block text-xs text-app-muted">Kanban öffnen</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-app-muted">
        Hinweis: Objectives kannst du direkt oben anlegen. Für reine Aufgaben ohne OKR nutze{" "}
        <Link href={`/d/${dept.slug}/tasks`} className="font-semibold text-app-brand hover:underline">
          Aufgaben
        </Link>
        ; Zeilen aus der globalen Liste ohne Abteilung kannst du dort weiterhin per Abteilungsfeld zuordnen.
      </p>
    </div>
  );
}
