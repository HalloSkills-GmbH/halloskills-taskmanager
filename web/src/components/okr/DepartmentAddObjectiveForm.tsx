"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { insertTaskRow } from "@/app/(app)/okrs/actions";

type Props = {
  departmentId: string;
  /** Sekundäre Beschriftung für eingebettete Nutzung (z. B. Vorschau-Karte). */
  compact?: boolean;
};

/** Legt ein Objective mit `department_id` an — gleiche Defaults wie MainTableView (OKR, Wurzelzeile). */
export function DepartmentAddObjectiveForm({ departmentId, compact = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className={compact ? "flex flex-col gap-3" : "flex flex-wrap items-end gap-3"}
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        const trimmed = name.trim();
        if (!trimmed) {
          setErr("Bitte einen Namen eingeben.");
          return;
        }
        start(async () => {
          const today = new Date().toISOString().slice(0, 10);
          const end = new Date();
          end.setDate(end.getDate() + 7);

          const res = await insertTaskRow({
            name: trimmed,
            item_kind: "objective",
            parent_id: null,
            okr_objective_id: null,
            okr_key_result_id: null,
            start_date: today,
            end_date: end.toISOString().slice(0, 10),
            topic: "Ops",
            status: "Planned",
            progress: 0,
            notes: "",
            assigned: "",
            department_id: departmentId,
            project_id: null,
            dependencies: [],
            attachments: [],
            custom_fields: {},
          });

          if (!res.ok) {
            setErr(res.message);
            return;
          }
          setName("");
          router.refresh();
        });
      }}
    >
      {!compact ? (
        <h3 className="w-full text-sm font-bold text-app-ink">Objective anlegen</h3>
      ) : null}
      <label className={`hs-field ${compact ? "w-full" : "min-w-[16rem] flex-1"}`}>
        <span className="hs-field-label">{compact ? "Name des Objectives" : "Objective-Name"}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Q2 Umsatz steigern"
          className="hs-input w-full"
          maxLength={500}
          disabled={pending}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="hs-btn hs-btn-primary shrink-0 disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Speichern…" : "Objective speichern"}
      </button>
      {err ? (
        <p className="w-full text-sm font-medium text-[var(--danger,#b42318)]" role="alert">
          {err}
        </p>
      ) : null}
    </form>
  );
}
