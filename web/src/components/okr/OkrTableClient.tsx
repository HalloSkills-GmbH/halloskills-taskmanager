"use client";

import { useMemo, useState } from "react";
import { insertTaskRow } from "@/app/(app)/okrs/actions";
import { createClient } from "@/lib/supabase/client";
import type { OkrFilters } from "@/lib/okr/filters";
import type { TaskCustomColumnRow } from "@/types/main-table";
import type { TaskRow } from "@/types/tasks";
import { MainTableView } from "@/components/tasks/MainTableView";

type Props = {
  initialAll: TaskRow[];
  filters: OkrFilters;
  initialCustomColumns: TaskCustomColumnRow[];
  initialMergedWidths: Record<string, number>;
  layoutSyncKey: string;
  departmentId?: string | null;
  boardProjectOptions?: { id: string; label: string }[];
};

export function OkrTableClient({
  initialAll,
  filters,
  initialCustomColumns,
  initialMergedWidths,
  layoutSyncKey,
  departmentId = null,
  boardProjectOptions,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.id ?? 0) + 1;
  };

  const addObjective = async () => {
    setBusy(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    const id = await nextId();
    const res = await insertTaskRow({
      id,
      name: "Neues Objective",
      item_kind: "objective",
      start_date: today,
      end_date: end.toISOString().slice(0, 10),
      status: "Planned",
      progress: 0,
      notes: "",
      topic: "Ops",
      assigned: "",
      parent_id: null,
      okr_objective_id: null,
      okr_key_result_id: null,
      department_id: departmentId ?? null,
      dependencies: [],
      attachments: [],
    });
    setBusy(false);
    if (!res.ok) setError(res.message);
  };

  const addKeyResult = async () => {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("tasks")
      .select("*")
      .order("id");
    if (e || !data) {
      setBusy(false);
      setError(e?.message || "Lesen fehlgeschlagen");
      return;
    }
    const allRows = data as TaskRow[];
    const objs = allRows.filter(
      (r) => (r.item_kind || "task").toLowerCase() === "objective",
    );
    if (!objs.length) {
      setBusy(false);
      setError("Bitte zuerst ein Objective anlegen.");
      return;
    }
    const oid =
      objs.length === 1
        ? objs[0]!.id
        : Number(
            window.prompt(
              `Objective-ID (${objs.map((o) => `${o.id}: ${o.name}`).join(" | ")}):`,
              String(objs[0]!.id),
            ),
          );
    if (!Number.isFinite(oid)) {
      setBusy(false);
      return;
    }
    const obj = objs.find((o) => o.id === oid);
    if (!obj) {
      setBusy(false);
      setError("Objective-ID ungültig.");
      return;
    }
    const id = await nextId();
    const res = await insertTaskRow({
      id,
      name: "Neues Key Result",
      item_kind: "key_result",
      start_date: obj.start_date,
      end_date: obj.end_date,
      status: "Planned",
      progress: 0,
      notes: "",
      topic: obj.topic,
      assigned: "",
      parent_id: oid,
      okr_objective_id: oid,
      okr_key_result_id: null,
      department_id: departmentId ?? null,
      dependencies: [],
      attachments: [],
    });
    setBusy(false);
    if (!res.ok) setError(res.message);
  };

  return (
    <div>
      <div className="hs-page-head mb-6 !mt-0">
        <div className="hs-page-title">
          <h1 className="!font-display !text-[clamp(26px,2.5vw,34px)] !font-normal italic">
            OKR-<em>Raster</em>
          </h1>
          <p className="sub">
            Haupttabelle mit Hierarchie und Realtime. Weitere Ansichten (Kanban, Zeitleiste,
            Kalender) findest du in den Tabs oben.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void addObjective()}
          className="hs-btn hs-btn-primary disabled:pointer-events-none disabled:opacity-50"
        >
          + Objective
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void addKeyResult()}
          className="hs-btn hs-btn-ghost disabled:pointer-events-none disabled:opacity-50"
        >
          + Key Result
        </button>
      </div>
      {error ? (
        <div
          className="mb-4 rounded-hs border px-4 py-2.5 text-sm font-medium"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
            background: "color-mix(in oklab, var(--danger) 12%, var(--card))",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      ) : null}
      <MainTableView
        mode="okr"
        initialTasks={initialAll}
        enableRealtime
        okrFilters={filters}
        initialCustomColumns={initialCustomColumns}
        initialMergedWidths={initialMergedWidths}
        layoutSyncKey={layoutSyncKey}
        departmentId={departmentId}
        boardProjectOptions={boardProjectOptions}
      />
    </div>
  );
}
