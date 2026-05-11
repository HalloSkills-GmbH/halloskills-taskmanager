/** Monday/Asana-inspirierte Tabellen-Utilities (Tailwind-Klassen). */

export const tableShell = "rounded-2xl border border-app-border bg-app-card shadow-card overflow-hidden";

export const tableHeaderRow =
  "sticky top-0 z-[1] flex border-b border-app-border bg-app-card text-[10px] font-bold uppercase tracking-[0.12em] text-app-muted";

export const tableRowBase =
  "flex border-b border-app-border transition-colors hover:bg-app-row/90 last:border-b-0";

export const groupHeaderRow =
  "flex cursor-pointer select-none items-center gap-2 border-b border-app-border-strong bg-app-hover/70 px-4 py-3 text-sm font-bold text-app-ink";

export function statusPillClass(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  if (s.includes("complete")) return "bg-app-st-done text-app-st-done-ink";
  if (s.includes("progress")) return "bg-app-st-progress text-app-st-progress-ink";
  if (s.includes("blocked")) return "bg-app-st-blocked text-app-st-blocked-ink";
  if (s.includes("planned")) return "bg-app-st-planned text-app-st-planned-ink";
  if (s.includes("not")) return "bg-app-st-todo text-app-st-todo-ink";
  return "bg-app-st-default text-app-st-default-ink";
}
