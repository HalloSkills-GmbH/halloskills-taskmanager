"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { OkrFilters } from "@/lib/okr/filters";
import { okrFilterSchema, parseOkrFilters, serializeOkrFilters } from "@/lib/okr/filters";
import { IconFunnel } from "@/components/tasks/TasksMonoToolbar";

const DEFAULT_OKR_BASE = "/okrs";

const defaultOkrFilters = (): OkrFilters =>
  okrFilterSchema.parse({
    q: "",
    type: "all",
    from: null,
    to: null,
    team: null,
    status: null,
  });

function okrFiltersActive(f: OkrFilters): boolean {
  const d = defaultOkrFilters();
  return (
    f.q.trim() !== d.q.trim() ||
    f.type !== d.type ||
    (f.from || "") !== (d.from || "") ||
    (f.to || "") !== (d.to || "") ||
    (f.team || "") !== (d.team || "") ||
    (f.status || "") !== (d.status || "")
  );
}

export function OkrShell({
  children,
  basePath = DEFAULT_OKR_BASE,
  contextLabel,
}: {
  children: React.ReactNode;
  /** z. B. `/d/marketing/okrs` für Abteilungs-OKRs */
  basePath?: string;
  /** Optional: Abteilungsname für Kontext im Titel */
  contextLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const qsKey = searchParams.toString();

  const tabs = useMemo(
    () =>
      [
        { href: `${basePath}/table`, label: "Tabelle" },
        { href: `${basePath}/kanban`, label: "Kanban" },
        { href: `${basePath}/gantt`, label: "Zeitleiste" },
        { href: `${basePath}/calendar`, label: "Kalender" },
      ] as const,
    [basePath],
  );

  const initial = useMemo(() => parseOkrFilters(new URLSearchParams(qsKey)), [qsKey]);

  const [draft, setDraft] = useState<OkrFilters>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const activeFilters = useMemo(() => okrFiltersActive(initial), [initial]);

  const applyFilters = useCallback(() => {
    const qs = serializeOkrFilters(draft);
    const path = pathname || `${basePath}/table`;
    startTransition(() => {
      router.push(qs ? `${path}?${qs}` : path);
    });
  }, [draft, pathname, router, basePath]);

  const resetFilters = useCallback(() => {
    const path = pathname || `${basePath}/table`;
    startTransition(() => {
      router.push(path);
    });
    setDraft(defaultOkrFilters());
  }, [pathname, router, basePath]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] px-[var(--pad-x)] pb-5 pt-8">
        <div className="mx-auto max-w-[1680px]">
          <div className="hs-page-title mb-6">
            <h1>
              Strategische <em>OKRs</em>
              {contextLabel ? (
                <span className="text-[0.65em] font-sans not-italic text-[var(--muted)]">
                  {" "}
                  · {contextLabel}
                </span>
              ) : null}
            </h1>
            <p className="sub">
              Tabelle, Kanban, Zeitleiste und Kalender — Filter in der URL, eingeklappt bis du sie
              brauchst.
            </p>
          </div>
          <nav
            className="hs-tabs inline-flex w-full max-w-4xl flex-wrap gap-y-1"
            aria-label="OKR-Ansichten"
          >
            {tabs.map((t) => {
              const active = pathname === t.href;
              const qs = searchParams.toString();
              const href = qs ? `${t.href}?${qs}` : t.href;
              return (
                <Link key={t.href} href={href} className={`hs-tab ${active ? "active" : ""}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <section className="border-b border-[var(--border)] px-[var(--pad-x)] py-4">
        <div className="mx-auto max-w-[1680px]">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-hs border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left shadow-card transition hover:border-[var(--border-2)]"
            aria-expanded={filtersOpen}
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--ink)]">
              <IconFunnel className="shrink-0 text-[var(--ink-2)]" />
              Filter
              {activeFilters ? (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--accent-ink)]">
                  Aktiv
                </span>
              ) : null}
            </span>
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              {filtersOpen ? "Einklappen" : "Aufklappen"}
            </span>
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-3 rounded-hs border border-[var(--border)] bg-[var(--card)] p-5 shadow-card">
                <div className="flex flex-wrap items-end gap-4">
                  <label className="hs-field min-w-[12rem]">
                    <span className="hs-field-label">Suche</span>
                    <input
                      value={draft.q}
                      onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                      placeholder="Titel, Notizen, Team…"
                      className="hs-input w-full"
                    />
                  </label>
                  <label className="hs-field min-w-[11rem]">
                    <span className="hs-field-label">Typ</span>
                    <select
                      value={draft.type}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          type: e.target.value as OkrFilters["type"],
                        }))
                      }
                      className="hs-select w-full"
                    >
                      <option value="all">Alle OKR-Zeilen + verknüpfte Tasks</option>
                      <option value="objective">Nur Objectives</option>
                      <option value="key_result">Nur Key Results</option>
                      <option value="task">Nur verknüpfte Aufgaben</option>
                    </select>
                  </label>
                  <label className="hs-field">
                    <span className="hs-field-label">Von</span>
                    <input
                      type="date"
                      value={draft.from || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, from: e.target.value || null }))
                      }
                      className="hs-input"
                    />
                  </label>
                  <label className="hs-field">
                    <span className="hs-field-label">Bis</span>
                    <input
                      type="date"
                      value={draft.to || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, to: e.target.value || null }))
                      }
                      className="hs-input"
                    />
                  </label>
                  <label className="hs-field w-28">
                    <span className="hs-field-label">Team</span>
                    <input
                      value={draft.team || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, team: e.target.value || null }))
                      }
                      placeholder="z. B. AHE"
                      className="hs-input w-full"
                    />
                  </label>
                  <label className="hs-field w-40">
                    <span className="hs-field-label">Status</span>
                    <input
                      value={draft.status || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, status: e.target.value || null }))
                      }
                      placeholder="z. B. In Progress"
                      className="hs-input w-full"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyFilters}
                    disabled={pending}
                    className="hs-btn hs-btn-primary disabled:pointer-events-none disabled:opacity-50"
                  >
                    {pending ? "Wird angewendet…" : "Filter anwenden"}
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={pending}
                    className="hs-btn hs-btn-ghost disabled:pointer-events-none disabled:opacity-50"
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-auto px-[var(--pad-x)] py-6">
        <div className="mx-auto max-w-[1680px]">{children}</div>
      </div>
    </div>
  );
}
