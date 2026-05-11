"use client";

import { useCallback, useState, useTransition } from "react";
import { saveBoardColumnConfig } from "@/lib/board-config/actions";
import type { StatusOption } from "@/types/profiles";

const DEFAULT_STATUSES: StatusOption[] = [
  { id: "not_started", label: "Not started", color: "#c4c4c4" },
  { id: "planned", label: "Planned", color: "#579bfc" },
  { id: "in_progress", label: "In Progress", color: "#fdab3d" },
  { id: "complete", label: "Complete", color: "#00c875" },
  { id: "blocked", label: "Blocked", color: "#e2445c" },
];

const COLOR_PALETTE = [
  "#00c875", "#00d2d2", "#579bfc", "#a25ddc",
  "#e2445c", "#ff158a", "#fdab3d", "#ffcb00",
  "#cab641", "#9cd326", "#037f4c", "#c4c4c4",
];

interface StatusConfiguratorProps {
  boardId: string;
  columnKey: string;
  statuses: StatusOption[];
  onClose: () => void;
  onUpdate: (statuses: StatusOption[]) => void;
}

export function StatusConfigurator({
  boardId,
  columnKey,
  statuses: initialStatuses,
  onClose,
  onUpdate,
}: StatusConfiguratorProps) {
  const [statuses, setStatuses] = useState<StatusOption[]>(
    initialStatuses.length > 0 ? initialStatuses : DEFAULT_STATUSES
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#00c875");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#00c875");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const res = await saveBoardColumnConfig({
        board_id: boardId,
        column_key: columnKey,
        config: { statuses },
      });
      if (res.ok) {
        onUpdate(statuses);
        onClose();
      } else {
        setError(res.message);
      }
    });
  }, [boardId, columnKey, statuses, onClose, onUpdate]);

  const handleAdd = useCallback(() => {
    if (!newLabel.trim()) return;
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Math.random().toString(36).slice(2, 6);
    const newStatus: StatusOption = { id, label: newLabel.trim(), color: newColor };
    setStatuses((prev) => [...prev, newStatus]);
    setNewLabel("");
    setNewColor("#00c875");
  }, [newLabel, newColor]);

  const handleDelete = useCallback((id: string) => {
    if (statuses.length <= 1) {
      setError("Mindestens ein Status muss existieren");
      return;
    }
    setStatuses((prev) => prev.filter((s) => s.id !== id));
  }, [statuses.length]);

  const handleStartEdit = useCallback((status: StatusOption) => {
    setEditingId(status.id);
    setEditLabel(status.label);
    setEditColor(status.color);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !editLabel.trim()) return;
    setStatuses((prev) =>
      prev.map((s) =>
        s.id === editingId ? { ...s, label: editLabel.trim(), color: editColor } : s
      )
    );
    setEditingId(null);
  }, [editingId, editLabel, editColor]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-[15px] font-bold text-[var(--ink)]">Status-Optionen anpassen</h3>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Diese Einstellungen gelten nur für dieses Board.
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-5">
          {error ? (
            <div className="mb-4 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-[12px] text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                {editingId === status.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-7 w-7 shrink-0 rounded-md border border-[var(--border)]"
                        style={{ background: editColor }}
                        title="Farbe unten wählen"
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[13px] outline-none focus:border-[var(--accent)]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--hover)]"
                      >
                        Abbrechen
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 pl-0 sm:pl-9">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`h-5 w-5 rounded ${editColor === c ? "ring-2 ring-[var(--accent)] ring-offset-1" : ""}`}
                          style={{ background: c }}
                          aria-label={`Farbe ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <span
                      className="h-7 w-7 shrink-0 rounded-md"
                      style={{ background: status.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]">
                      {status.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(status)}
                      className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                      title="Bearbeiten"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M15.232 5.232l3.536 3.536M4 20h4l10-10a2.5 2.5 0 00-3.536-3.536L4 16.464V20z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(status.id)}
                      className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      title="Löschen"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M4 7h16M10 11v6M14 11v6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-[11px] font-semibold text-[var(--muted)]">Neuen Status hinzufügen</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  className="h-8 w-8 rounded-md"
                  style={{ background: newColor }}
                />
              </div>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Status-Name…"
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newLabel.trim()}
                className="rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`h-5 w-5 rounded ${newColor === c ? "ring-2 ring-[var(--accent)] ring-offset-1" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button type="button" className="hs-btn hs-btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="hs-btn hs-btn-primary"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
