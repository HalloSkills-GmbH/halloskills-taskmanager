"use client";

import { useEffect, useRef, useState, useTransition } from "react";

const ICON_OPTIONS = [
  { id: "building", label: "Gebäude" },
  { id: "board", label: "Board" },
  { id: "folder", label: "Ordner" },
  { id: "star", label: "Stern" },
  { id: "heart", label: "Herz" },
  { id: "flag", label: "Flagge" },
  { id: "bolt", label: "Blitz" },
  { id: "target", label: "Ziel" },
  { id: "chart", label: "Chart" },
  { id: "users", label: "Team" },
  { id: "briefcase", label: "Koffer" },
  { id: "rocket", label: "Rakete" },
  { id: "globe", label: "Globus" },
  { id: "code", label: "Code" },
  { id: "megaphone", label: "Megafon" },
  { id: "calendar", label: "Kalender" },
];

const COLOR_OPTIONS = [
  "#579bfc", "#00c875", "#00d2d2", "#a25ddc",
  "#e2445c", "#ff158a", "#ff5ac4", "#fdab3d",
  "#ffcb00", "#cab641", "#9cd326", "#037f4c",
  "#175a63", "#c4c4c4", "#808080", "#333333",
];

export function SidebarIcon({ icon, className = "" }: { icon: string; className?: string }) {
  const cls = className || "w-4 h-4";
  switch (icon) {
    case "building":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M4 21h16M6 21V8l6-4 6 4v13M10 21v-4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "board":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="5" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="5" width="4" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="17" y="5" width="3" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "folder":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M3 7v13a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-7l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "star":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "heart":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "flag":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "target":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "chart":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "briefcase":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "rocket":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "globe":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "code":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "megaphone":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path d="M3 11h2a5 5 0 015 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-6zM21 5v12a2 2 0 01-2 2h-1a2 2 0 01-2-2V7a2 2 0 012-2h1a2 2 0 012 2zM5 9l11-4v14L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

/** Benannte Tailwind-Gruppe, damit `group-hover` bei verschachtelten Zeilen nur die jeweilige Zeile trifft. */
type SidebarMenuHoverGroup = "sidebar-dept" | "sidebar-folder" | "sidebar-board";

type SidebarItemMenuProps = {
  itemType: "department" | "board" | "group";
  currentName: string;
  currentIcon: string;
  currentColor: string;
  onUpdate: (data: { name?: string; icon?: string; color?: string; sort_order?: number }) => Promise<{ ok: boolean; message?: string }>;
  onDelete: () => Promise<{ ok: boolean; message?: string }>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Wenn gesetzt, nur bei Hover über die gleichnamige `group/…`-Zeile einblenden (wichtig für Board-Zeilen in Ordnern). */
  hoverGroup?: SidebarMenuHoverGroup;
};

export function SidebarItemMenu({
  itemType,
  currentName,
  currentIcon,
  currentColor,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  hoverGroup,
}: SidebarItemMenuProps) {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<"rename" | "icon" | "color" | null>(null);
  const [editName, setEditName] = useState(currentName);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSubMenu(null);
      setEditName(currentName);
    }
  }, [open, currentName]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleRename = () => {
    if (!editName.trim() || editName === currentName) {
      setSubMenu(null);
      return;
    }
    startTransition(async () => {
      await onUpdate({ name: editName.trim() });
      setSubMenu(null);
      setOpen(false);
    });
  };

  const handleIconChange = (icon: string) => {
    startTransition(async () => {
      await onUpdate({ icon });
      setSubMenu(null);
      setOpen(false);
    });
  };

  const handleColorChange = (color: string) => {
    startTransition(async () => {
      await onUpdate({ color });
      setSubMenu(null);
      setOpen(false);
    });
  };

  const handleDelete = () => {
    if (!confirm(`"${currentName}" wirklich löschen?`)) return;
    startTransition(async () => {
      await onDelete();
      setOpen(false);
    });
  };

  const typeLabel = itemType === "department" ? "Abteilung" : itemType === "board" ? "Board" : "Gruppe";

  const triggerHoverClasses =
    hoverGroup === "sidebar-dept"
      ? "opacity-0 transition group-hover/sidebar-dept:opacity-100"
      : hoverGroup === "sidebar-folder"
        ? "opacity-0 transition group-hover/sidebar-folder:opacity-100"
        : hoverGroup === "sidebar-board"
          ? "opacity-0 transition group-hover/sidebar-board:opacity-100"
          : "opacity-0 transition group-hover:opacity-100";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-[var(--hover)] ${triggerHoverClasses}`}
        aria-label="Menü"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-[100] mt-1 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {subMenu === "rename" ? (
            <div className="p-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setSubMenu(null);
                }}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubMenu(null)}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--hover)]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleRename}
                  disabled={pending || !editName.trim()}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : subMenu === "icon" ? (
            <div className="p-2">
              <p className="mb-2 px-1 text-[11px] font-semibold text-[var(--muted)]">Icon wählen</p>
              <div className="grid grid-cols-4 gap-1">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleIconChange(opt.id)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                      currentIcon === opt.id
                        ? "bg-[var(--accent)] text-white"
                        : "hover:bg-[var(--hover)]"
                    }`}
                    title={opt.label}
                  >
                    <SidebarIcon icon={opt.id} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : subMenu === "color" ? (
            <div className="p-2">
              <p className="mb-2 px-1 text-[11px] font-semibold text-[var(--muted)]">Farbe wählen</p>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    className={`h-7 w-7 rounded-lg transition ${
                      currentColor === c ? "ring-2 ring-[var(--ink)] ring-offset-2" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">
                {typeLabel}
              </div>
              <button
                type="button"
                onClick={() => setSubMenu("rename")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <path d="M15.232 5.232l3.536 3.536M4 20h4l10-10a2.5 2.5 0 00-3.536-3.536L4 16.464V20z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Umbenennen
              </button>
              <button
                type="button"
                onClick={() => setSubMenu("icon")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
              >
                <SidebarIcon icon={currentIcon} className="h-3.5 w-3.5" />
                Icon ändern
              </button>
              <button
                type="button"
                onClick={() => setSubMenu("color")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
              >
                <span className="h-3.5 w-3.5 rounded" style={{ background: currentColor }} />
                Farbe ändern
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
              {onMoveUp && canMoveUp ? (
                <button
                  type="button"
                  onClick={() => {
                    onMoveUp();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Nach oben
                </button>
              ) : null}
              {onMoveDown && canMoveDown ? (
                <button
                  type="button"
                  onClick={() => {
                    onMoveDown();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--hover)]"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Nach unten
                </button>
              ) : null}
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--danger)] hover:bg-[var(--hover)]"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <path d="M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M4 7h16M10 11v6M14 11v6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Löschen
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
