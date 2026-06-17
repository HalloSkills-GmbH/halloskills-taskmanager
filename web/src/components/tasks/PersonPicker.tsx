"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { AssigneeOption } from "@/types/profiles";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#00c875", "#579bfc", "#a25ddc", "#e2445c",
    "#ff158a", "#fdab3d", "#ffcb00", "#037f4c",
  ];
  return colors[Math.abs(hash) % colors.length];
}

interface PersonPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: AssigneeOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function PersonPicker({
  value,
  onChange,
  options,
  placeholder = "Person zuweisen…",
  disabled = false,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value || o.name === value);

  const openDropdown = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
    setOpen(true);
  }, []);

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const profiles = filtered.filter((o) => o.type === "profile");
  const groups = filtered.filter((o) => o.type === "group");

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSelect = useCallback(
    (option: AssigneeOption) => {
      onChange(option.id);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="hs-cell-person flex items-center gap-2"
        title={selected?.name || placeholder}
      >
        {selected ? (
          <span
            className="hs-avatar flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: selected.color || hashColor(selected.name) }}
          >
            {getInitials(selected.name)}
          </span>
        ) : (
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-dashed border-[var(--border-2)] text-[var(--muted)]">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </button>

      {open && dropdownPos
        ? ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-[280px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-pop"
          style={{ top: dropdownPos.top, left: dropdownPos.left, transform: "translateX(-50%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[var(--border)] p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {selected ? (
              <div className="border-b border-[var(--border)] p-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-[var(--danger)] hover:bg-[var(--hover)]"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Zuweisung entfernen
                </button>
              </div>
            ) : null}

            {profiles.length > 0 ? (
              <div className="p-2">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  Personen
                </div>
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--hover)] ${
                      selected?.id === p.id ? "bg-[var(--accent-soft)]" : ""
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: p.color || hashColor(p.name) }}
                    >
                      {getInitials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {groups.length > 0 ? (
              <div className="border-t border-[var(--border)] p-2">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  Gruppen
                </div>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelect(g)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--hover)] ${
                      selected?.id === g.id ? "bg-[var(--accent-soft)]" : ""
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                      style={{ background: g.color || "#579bfc" }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]">
                      {g.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {profiles.length === 0 && groups.length === 0 ? (
              <div className="p-4 text-center text-[13px] text-[var(--muted)]">
                {search ? "Keine Ergebnisse" : "Keine Personen verfügbar"}
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
