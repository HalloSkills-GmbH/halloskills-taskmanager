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
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-3 rounded-hs border border-[var(--border)] bg-[var(--card)] p-4 shadow-card"
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
        <label className="hs-field min-w-[14rem]">
          <span className="hs-field-label">Neues Board</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (z. B. Sprint, Backlog)"
            className="hs-input w-full"
            maxLength={120}
          />
        </label>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="hs-btn hs-btn-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? "Erstellen…" : "Board erstellen"}
        </button>
        {err ? <p className="w-full text-sm text-[var(--danger,#b42318)]">{err}</p> : null}
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
