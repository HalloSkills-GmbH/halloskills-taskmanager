"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { insertTaskRow } from "@/app/(app)/okrs/actions";

const QUARTERS = [
  { label: "Q1 (Jan–Mrz)", end: (y: number) => `${y}-03-31`, start: (y: number) => `${y}-01-01` },
  { label: "Q2 (Apr–Jun)", end: (y: number) => `${y}-06-30`, start: (y: number) => `${y}-04-01` },
  { label: "Q3 (Jul–Sep)", end: (y: number) => `${y}-09-30`, start: (y: number) => `${y}-07-01` },
  { label: "Q4 (Okt–Dez)", end: (y: number) => `${y}-12-31`, start: (y: number) => `${y}-10-01` },
];

function currentQuarterIndex() {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return 0;
  if (m <= 6) return 1;
  if (m <= 9) return 2;
  return 3;
}

type Props = {
  departmentId: string;
  compact?: boolean;
};

export function DepartmentAddObjectiveForm({ departmentId, compact = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [quarter, setQuarter] = useState(currentQuarterIndex);
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
          const year = new Date().getFullYear();
          const q = QUARTERS[quarter];
          const res = await insertTaskRow({
            name: trimmed,
            item_kind: "objective",
            parent_id: null,
            okr_objective_id: null,
            okr_key_result_id: null,
            start_date: q.start(year),
            end_date: q.end(year),
            topic: "Ops",
            status: "Planned",
            progress: 0,
            notes: "",
            assigned: [],
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Q2 Umsatz steigern"
          className="hs-input w-full"
          maxLength={500}
          disabled={pending}
        />
      </label>
      <label className="hs-field w-36 shrink-0">
        <span className="hs-field-label">Quartal</span>
        <select
          value={quarter}
          onChange={(e) => setQuarter(Number(e.target.value))}
          className="hs-input w-full"
          disabled={pending}
        >
          {QUARTERS.map((q, i) => (
            <option key={i} value={i}>{q.label}</option>
          ))}
        </select>
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
