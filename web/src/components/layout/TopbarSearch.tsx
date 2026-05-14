"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { globalSearch, type SearchResultItem, type SearchResults } from "@/lib/search/actions";

type Variant = "topbar" | "sidebar";

function IconTask() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--accent)]">
      <path d="M9 11l2 2 4-4M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconOkr() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--warning)]">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--info)]">
      <rect x="4" y="5" width="5" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="5" width="4" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="5" width="3" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ResultItem({
  item,
  onSelect,
}: {
  item: SearchResultItem;
  onSelect: () => void;
}) {
  const href =
    item.type === "board" && item.departmentSlug
      ? `/d/${item.departmentSlug}/boards/${item.id}`
      : item.type === "okr"
      ? item.departmentSlug
        ? `/d/${item.departmentSlug}/okrs/table`
        : "/okrs/table"
      : item.departmentSlug
      ? `/d/${item.departmentSlug}/tasks`
      : "/tasks";

  const icon = item.type === "okr" ? <IconOkr /> : item.type === "board" ? <IconBoard /> : <IconTask />;
  const kindLabel =
    item.type === "okr"
      ? item.itemKind === "objective"
        ? "Objective"
        : item.itemKind === "keyresult"
        ? "Key Result"
        : "OKR"
      : item.type === "board"
      ? "Board"
      : "Aufgabe";

  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-[var(--hover)]"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--ink)]">{item.name}</div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
          <span>{kindLabel}</span>
          {item.departmentName ? (
            <>
              <span>·</span>
              <span>{item.departmentName}</span>
            </>
          ) : null}
          {item.boardName ? (
            <>
              <span>·</span>
              <span className="truncate">{item.boardName}</span>
            </>
          ) : null}
        </div>
      </div>
      {item.status ? (
        <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-3)]">
          {item.status}
        </span>
      ) : null}
    </Link>
  );
}

export function TopbarSearch({ variant = "topbar" }: { variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    startTransition(async () => {
      const res = await globalSearch(q);
      setResults(res);
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      runSearch(value);
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, runSearch]);

  const handleClose = () => {
    setOpen(false);
    setValue("");
    setResults(null);
  };

  const formClass =
    variant === "sidebar"
      ? "hs-search hs-search--sidebar w-full max-w-none flex-none"
      : "hs-search max-w-[360px] flex-1";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={formClass}
        style={{ cursor: "pointer" }}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="min-w-0 flex-1 text-left text-[var(--muted)]">Suchen…</span>
        <kbd className="hidden sm:inline">⌘ K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 pt-[10vh] backdrop-blur-[2px]">
          <div
            ref={modalRef}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--muted)]">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Aufgaben, OKRs, Boards suchen…"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                autoComplete="off"
              />
              {pending ? (
                <span className="shrink-0 text-[12px] text-[var(--muted)]">...</span>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {value.trim().length < 2 ? (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">
                  Mindestens 2 Zeichen eingeben…
                </div>
              ) : results === null || pending ? (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">
                  Suche läuft…
                </div>
              ) : results.total === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">
                  Keine Ergebnisse für „{value}“
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {results.tasks.length > 0 ? (
                    <div className="p-2">
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        Aufgaben ({results.tasks.length})
                      </div>
                      {results.tasks.map((item) => (
                        <ResultItem key={item.id} item={item} onSelect={handleClose} />
                      ))}
                    </div>
                  ) : null}
                  {results.okrs.length > 0 ? (
                    <div className="p-2">
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        OKRs ({results.okrs.length})
                      </div>
                      {results.okrs.map((item) => (
                        <ResultItem key={item.id} item={item} onSelect={handleClose} />
                      ))}
                    </div>
                  ) : null}
                  {results.boards.length > 0 ? (
                    <div className="p-2">
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        Boards ({results.boards.length})
                      </div>
                      {results.boards.map((item) => (
                        <ResultItem key={item.id} item={item} onSelect={handleClose} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--muted)]">
              <span className="font-medium">↑↓</span> Navigieren · <span className="font-medium">Enter</span> Öffnen · <span className="font-medium">ESC</span> Schließen
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
