/** Farben für Status-Zellen (Monday-Stil, angelehnt an HalloSkills-HTML-Referenz). */

export type StatusVisual = { color: string; soft: string; dot: string };

const FALLBACK: StatusVisual = {
  color: "#64748B",
  soft: "#E2E8F0",
  dot: "#94A3B8",
};

const MAP: Record<string, StatusVisual> = {
  "not started": {
    color: "#64748B",
    soft: "#E2E8F0",
    dot: "#94A3B8",
  },
  planned: {
    color: "#3B82F6",
    soft: "#DBEAFE",
    dot: "#2563EB",
  },
  "in progress": {
    color: "#D97706",
    soft: "#FEF3C7",
    dot: "#F59E0B",
  },
  complete: {
    color: "#047857",
    soft: "#D1FAE5",
    dot: "#10B981",
  },
  blocked: {
    color: "#B91C1C",
    soft: "#FEE2E2",
    dot: "#EF4444",
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

/** Akzentfarbe für Gruppenköpfe (Thema = Hash-Farbe). */
export function topicAccent(topic: string): string {
  const t = topic.trim() || "—";
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 46%)`;
}
