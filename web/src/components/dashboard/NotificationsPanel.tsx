"use client";

import { useRouter } from "next/navigation";
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
  dept_slug?: string | null;
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  assigned: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#7c3aed" strokeWidth={2} />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" />
      </svg>
    ),
    label: "Zuweisung",
  },
  note_added: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <path d="M8 12h8M8 8h5M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="#0369a1" strokeWidth={2} strokeLinecap="round" />
      </svg>
    ),
    label: "Notiz",
  },
  task_changed: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#c2410c" strokeWidth={2} strokeLinecap="round" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#c2410c" strokeWidth={2} strokeLinecap="round" />
      </svg>
    ),
    label: "Änderung",
  },
};

const TYPE_BG: Record<string, string> = {
  assigned:     "#f5f3ff",
  note_added:   "#eff6ff",
  task_changed: "#fff7ed",
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

function capitalize(s: string | null) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function NotificationsPanel({ notifications }: { notifications: TaskNotification[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleClick = (n: TaskNotification) => {
    if (!n.read_at) {
      startTransition(async () => { await markNotificationRead(n.id); });
    }
    const href = n.dept_slug
      ? `/d/${n.dept_slug}/okrs/table`
      : `/okrs/table`;
    router.push(href);
  };

  const handleMarkAllRead = () => {
    startTransition(async () => { await markAllNotificationsRead(); });
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-app-ink">
          Benachrichtigungen
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-white">
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
        <div className="rounded-2xl border border-app-border bg-white px-5 py-4 text-sm text-app-muted shadow-card">
          Keine Benachrichtigungen.
        </div>
      ) : (
        <div className="rounded-2xl border border-app-border bg-white shadow-card divide-y divide-[#f0f0f0] overflow-hidden">
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.task_changed;
            const isUnread = !n.read_at;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f9fafb]"
                style={{ background: isUnread ? "#fff" : "#fff" }}
              >
                {/* Icon */}
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: TYPE_BG[n.type] ?? "#f3f4f6" }}
                >
                  {cfg.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  {n.actor_name && (
                    <p className="text-[12px] font-semibold text-app-muted">
                      {capitalize(n.actor_name)} · {cfg.label}
                    </p>
                  )}
                  <p className={`text-[13px] leading-snug ${isUnread ? "font-semibold text-app-ink" : "font-normal text-app-text"}`}>
                    {n.message}
                  </p>
                  <p className="mt-0.5 text-[11px] text-app-muted">{formatDate(n.created_at)}</p>
                </div>

                {/* Unread dot */}
                <div className="mt-2 flex shrink-0 items-center gap-1.5">
                  {isUnread && (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  )}
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="text-[#d1d5db]">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
