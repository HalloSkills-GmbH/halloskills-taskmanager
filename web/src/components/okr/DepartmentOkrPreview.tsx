import Link from "next/link";
import { fetchDepartmentOkrSnapshot } from "@/lib/okr/department-okr-snapshot";

const MAX_EACH = 5;

export async function DepartmentOkrPreview({
  departmentId,
  deptSlug,
  title = "OKRs in dieser Abteilung",
}: {
  departmentId: string;
  deptSlug: string;
  title?: string;
}) {
  const { objectives, keyResults } = await fetchDepartmentOkrSnapshot(departmentId);
  const okrHref = `/d/${deptSlug}/okrs/table`;

  if (objectives.length === 0 && keyResults.length === 0) {
    return (
      <section className="mt-10 rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-app-ink">{title}</h2>
          <Link
            href={okrHref}
            className="text-sm font-bold text-app-brand hover:underline"
          >
            OKRs verwalten →
          </Link>
        </div>
        <p className="mt-3 text-sm text-app-muted">
          Noch keine Objectives oder Key Results mit dieser Abteilung verknüpft.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-app-ink">{title}</h2>
        <Link href={okrHref} className="text-sm font-bold text-app-brand hover:underline">
          Alle OKRs →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-app-muted">
            Objectives
          </h3>
          <ul className="mt-2 space-y-2">
            {objectives.slice(0, MAX_EACH).map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-app-border bg-app-hover/40 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-app-ink">{o.name}</span>
                <span className="mt-0.5 block text-xs text-app-muted">
                  {o.status || "—"}
                  {o.progress != null ? ` · ${o.progress}%` : ""}
                </span>
              </li>
            ))}
          </ul>
          {objectives.length > MAX_EACH ? (
            <p className="mt-2 text-xs text-app-muted">
              +{objectives.length - MAX_EACH} weitere in der OKR-Tabelle
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-app-muted">
            Key Results
          </h3>
          <ul className="mt-2 space-y-2">
            {keyResults.slice(0, MAX_EACH).map((kr) => (
              <li
                key={kr.id}
                className="rounded-xl border border-app-border bg-app-hover/40 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-app-ink">{kr.name}</span>
                <span className="mt-0.5 block text-xs text-app-muted">
                  {kr.status || "—"}
                  {kr.progress != null ? ` · ${kr.progress}%` : ""}
                </span>
              </li>
            ))}
          </ul>
          {keyResults.length > MAX_EACH ? (
            <p className="mt-2 text-xs text-app-muted">
              +{keyResults.length - MAX_EACH} weitere in der OKR-Tabelle
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
