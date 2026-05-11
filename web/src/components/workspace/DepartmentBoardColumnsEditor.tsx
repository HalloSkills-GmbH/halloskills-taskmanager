"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateDepartmentBoardColumns } from "@/lib/workspace/actions";
import type { DepartmentBoardColumn } from "@/types/departments";

export function DepartmentBoardColumnsEditor({
  boardId,
  initialColumns,
}: {
  boardId: string;
  initialColumns: DepartmentBoardColumn[];
}) {
  const router = useRouter();
  const [cols, setCols] = useState<DepartmentBoardColumn[]>(initialColumns);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setCols(initialColumns);
  }, [initialColumns]);

  const save = () => {
    setMsg(null);
    const cleaned = cols
      .map((c, i) => ({
        id: c.id?.trim() || `col-${i}`,
        title: c.title.trim(),
      }))
      .filter((c) => c.title.length > 0);
    if (cleaned.length === 0) {
      setMsg("Mindestens eine Spalte mit Titel.");
      return;
    }
    start(async () => {
      const res = await updateDepartmentBoardColumns({ boardId, columns: cleaned });
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setCols(cleaned);
      setMsg("Gespeichert.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-hs border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
      <h3 className="text-sm font-bold text-[var(--ink)]">Board-Spalten</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Jeder Titel entspricht einem möglichen{" "}
        <strong className="text-[var(--ink-2)]">Status</strong> der Aufgabe (Drag &amp; Drop setzt den
        Status).
      </p>
      <ul className="mt-4 space-y-2">
        {cols.map((c, i) => (
          <li key={`${c.id}-${i}`} className="flex gap-2">
            <input
              value={c.title}
              onChange={(e) =>
                setCols((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                )
              }
              className="hs-input flex-1"
              placeholder="Spaltentitel"
              maxLength={80}
            />
            <button
              type="button"
              className="hs-btn hs-btn-ghost shrink-0 px-2"
              onClick={() => setCols((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Spalte entfernen"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="hs-btn hs-btn-ghost"
          onClick={() => setCols((prev) => [...prev, { id: `col-${prev.length}`, title: "" }])}
        >
          + Spalte
        </button>
        <button
          type="button"
          disabled={pending}
          className="hs-btn hs-btn-primary disabled:opacity-50"
          onClick={() => save()}
        >
          {pending ? "Speichern…" : "Spalten speichern"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs font-medium text-[var(--muted)]">{msg}</p> : null}
    </div>
  );
}
