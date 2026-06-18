"use client";

import { useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(app)/dashboard/actions";

export type TaskNotification = {
  id: number;
  type: "note_added" | "task_changed" | "assigned";
  message: string | null;
  actor_name: string | null;
  task_id: number;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<string, { icon: string; bg: string; color: string }> = {
  note_added:   { icon: "✏️", bg: "#eff6ff", color: "#1d4ed8" },
  task_changed: { icon: "🔄", bg: "#fff7ed", color: "#c2410c" },
  assigned:     { icon: "👤", bg: "#f0fdf4", color: "#15803d" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Gestern";
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function NotificationsPanel({ notifications }: { notifications: TaskNotification[] }) {
  const [, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkRead = (id: number) => {
    startTransition(async () => { await markNotificationRead(id); });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => { await markAllNotificationsRead(); });
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-app-ink">
          Benachrichtigungen
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-app-brand hover:underline"
          >
            Alle als gelesen markieren
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-app-border bg-app-card px-5 py-4 text-sm text-app-muted shadow-card">
          Keine Benachrichtigungen.
        </div>
      ) : (
        <div className="rounded-2xl border border-app-border bg-app-card shadow-card divide-y divide-[#f0f0f0] overflow-hidden">
          {notifications.map((n) => {
            const style = TYPE_ICON[n.type] ?? TYPE_ICON.task_changed;
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${isUnread ? "bg-[#f8faff]" : "bg-white"}`}
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
                  style={{ background: style.bg }}
                >
                  {style.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-snug ${isUnread ? "font-semibold text-app-ink" : "text-app-text"}`}>
                    {n.message}
                  </p>
                  <p className="mt-0.5 text-[11px] text-app-muted">{formatDate(n.created_at)}</p>
                </div>
                {isUnread && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] hover:opacity-70"
                    title="Als gelesen markieren"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
