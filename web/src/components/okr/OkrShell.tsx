"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { OkrFilters } from "@/lib/okr/filters";
import { okrFilterSchema, parseOkrFilters, serializeOkrFilters } from "@/lib/okr/filters";
import { IconFunnel } from "@/components/tasks/TasksMonoToolbar";
import { useSetPageTitle } from "@/components/layout/PageTitleContext";

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

  useSetPageTitle(contextLabel ? `OKRs · ${contextLabel}` : "OKRs");

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
      <header className="border-b border-[var(--border)] px-[var(--pad-x)] py-3">
        <div className="mx-auto flex max-w-[1680px] items-center gap-4">
          <nav
            className="hs-tabs inline-flex flex-wrap gap-y-1"
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
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={`hs-btn flex items-center gap-2 ${activeFilters ? "!border-[var(--accent)] !bg-[var(--accent-soft)]" : "hs-btn-ghost"}`}
                aria-expanded={filtersOpen}
              >
                <IconFunnel className="shrink-0" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilters ? (
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                    1
                  </span>
                ) : null}
              </button>
              {filtersOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-[480px] rounded-hs border border-[var(--border)] bg-[var(--card)] p-4 shadow-pop">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[var(--ink)]">Filter</span>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="hs-field">
                      <span className="hs-field-label">Suche</span>
                      <input
                        value={draft.q}
                        onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                        placeholder="Titel, Notizen…"
                        className="hs-input w-full"
                      />
                    </label>
                    <label className="hs-field">
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
                        <option value="all">Alle</option>
                        <option value="objective">Objectives</option>
                        <option value="key_result">Key Results</option>
                        <option value="task">Aufgaben</option>
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
                        className="hs-input w-full"
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
                        className="hs-input w-full"
                      />
                    </label>
                    <label className="hs-field">
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
                    <label className="hs-field">
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
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetFilters}
                      disabled={pending}
                      className="hs-btn hs-btn-ghost text-[12px] disabled:opacity-50"
                    >
                      Zurücksetzen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyFilters();
                        setFiltersOpen(false);
                      }}
                      disabled={pending}
                      className="hs-btn hs-btn-primary text-[12px] disabled:opacity-50"
                    >
                      {pending ? "…" : "Anwenden"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-[var(--pad-x)] py-4">
        <div className="mx-auto max-w-[1680px]">{children}</div>
      </div>
    </div>
  );
}
