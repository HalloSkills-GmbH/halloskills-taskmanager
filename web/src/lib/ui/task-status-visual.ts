/** Farben für Status-Zellen (Monday-Stil, angelehnt an HalloSkills-HTML-Referenz). */

import type { StatusOption } from "@/types/profiles";

export type StatusVisual = { color: string; soft: string; dot: string };

const FALLBACK: StatusVisual = {
  color: "#64748B",
  soft: "#E2E8F0",
  dot: "#94A3B8",
};

const MAP: Record<string, StatusVisual> = {
  "not started": {
    color: "#64748B",
    soft: "#F1F5F9",
    dot: "#94A3B8",
  },
  planned: {
    color: "#1d4ed8",
    soft: "#dbeafe",
    dot: "#2563EB",
  },
  "in progress": {
    color: "#854d0e",
    soft: "#fef9c3",
    dot: "#D97706",
  },
  complete: {
    color: "#15803d",
    soft: "#f0fdf4",
    dot: "#16a34a",
  },
  blocked: {
    color: "#be123c",
    soft: "#fff1f2",
    dot: "#e11d48",
  },
};

export function statusVisual(status: string | null | undefined): StatusVisual {
  const key = (status || "").trim().toLowerCase();
  if (!key) return FALLBACK;
  if (MAP[key]) return MAP[key];
  if (key.includes("complete")) return MAP.complete;
  if (key.includes("progress")) return MAP["in progress"];
  if (key.includes("planned")) return MAP.planned;
  if (key.includes("block")) return MAP.blocked;
  if (key.includes("not")) return MAP["not started"];
  return FALLBACK;
}

/**
 * Farben aus der Board-Spaltenkonfiguration (`board_column_config`), falls das Label (oder die id) passt.
 * Sonst Fallback über `statusVisual`.
 */
export function statusVisualFromPalette(
  value: string | null | undefined,
  palette: StatusOption[] | undefined | null,
): StatusVisual {
  const v = (value || "").trim();
  if (palette && palette.length > 0 && v) {
    const lower = v.toLowerCase();
    const hit =
      palette.find((s) => s.label.trim().toLowerCase() === lower) ??
      palette.find((s) => s.id.trim().toLowerCase() === lower);
    if (hit?.color) {
      const color = hit.color;
      return { color, soft: color, dot: color };
    }
  }
  return statusVisual(value);
}

/** Akzentfarbe für Gruppenköpfe (Thema = Hash-Farbe). */
export function topicAccent(topic: string): string {
  const t = topic.trim() || "—";
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 46%)`;
}
