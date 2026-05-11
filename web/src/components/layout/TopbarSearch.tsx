"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

type Variant = "topbar" | "sidebar";

/**
 * Globale Suche: auf OKR-Routen und Aufgaben-Routen wird `q` in der URL gesetzt;
 * sonst Navigation zu `/tasks` mit Suchbegriff.
 */
export function TopbarSearch({ variant = "topbar" }: { variant?: Variant }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const syncFromUrl = useCallback(() => {
    const q = searchParams.get("q") ?? "";
    setValue(q);
  }, [searchParams]);

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  const runSearch = useCallback(() => {
    const q = value.trim();
    startTransition(() => {
      const mergeQ = (path: string) => {
        const next = new URLSearchParams(searchParams.toString());
        if (q) next.set("q", q);
        else next.delete("q");
        const qs = next.toString();
        router.push(qs ? `${path}?${qs}` : path);
      };

      if (pathname.includes("/okrs")) {
        mergeQ(pathname);
        return;
      }
      if (pathname === "/tasks" || pathname.startsWith("/tasks/")) {
        mergeQ(pathname);
        return;
      }
      if (/^\/d\/[^/]+\/tasks(\/.*)?$/.test(pathname)) {
        mergeQ(pathname);
        return;
      }
      if (q) {
        router.push(`/tasks?q=${encodeURIComponent(q)}`);
      } else {
        router.push("/tasks");
      }
    });
  }, [pathname, router, searchParams, value]);

  const formClass =
    variant === "sidebar"
      ? "hs-search hs-search--sidebar w-full max-w-none flex-none"
      : "hs-search max-w-[360px] flex-1";

  return (
    <form
      className={formClass}
      onSubmit={(e) => {
        e.preventDefault();
        runSearch();
      }}
      role="search"
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Aufgaben, OKRs, Personen suchen…"
        className="min-w-0 flex-1"
        autoComplete="off"
        aria-label="Suche"
      />
      <kbd className="hidden sm:inline">⌘ K</kbd>
      <button
        type="submit"
        disabled={pending}
        className="hs-btn hs-btn-primary !px-3 !py-1.5 !text-[11px] shadow-none sm:hidden"
      >
        {pending ? "…" : "Los"}
      </button>
    </form>
  );
}
