"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDepartmentBoard } from "@/lib/workspace/actions";
import type { DepartmentBoardRow } from "@/types/departments";

export function DepartmentBoardsClient({
  departmentId,
  deptSlug,
  initialBoards,
}: {
  departmentId: string;
  deptSlug: string;
  initialBoards: Pick<DepartmentBoardRow, "id" | "name">[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2 rounded-hs border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          start(async () => {
            const res = await createDepartmentBoard({ departmentId, name });
            if (!res.ok) {
              setErr(res.message);
              return;
            }
            setName("");
            router.push(`/d/${deptSlug}/boards/${res.id}`);
            router.refresh();
          });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Neues Board / Projekt…"
          className="hs-input min-w-0 flex-1 !py-2 !text-[13px]"
          maxLength={120}
          aria-label="Name des neuen Boards"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="hs-iconbtn shrink-0 disabled:pointer-events-none disabled:opacity-50"
          title="Board erstellen"
          aria-label="Board erstellen"
        >
          {pending ? (
            <span className="text-[11px] text-[var(--muted)]">…</span>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        {err ? <p className="w-full basis-full text-sm text-[var(--danger,#b42318)]">{err}</p> : null}
      </form>

      {initialBoards.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Noch keine Boards — lege eines an und passe die Spalten auf der Board-Seite an (Status-Werte
          der Karten).
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initialBoards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/d/${deptSlug}/boards/${b.id}`}
                className="block rounded-hs border border-[var(--border)] bg-[var(--card)] p-4 shadow-card transition hover:border-[var(--border-2)]"
              >
                <span className="font-bold text-[var(--ink)]">{b.name}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">Bearbeiten &amp; Spalten</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
