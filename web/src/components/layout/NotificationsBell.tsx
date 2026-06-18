"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactDOM from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, markAllNotificationsRead } from "@/app/(app)/dashboard/actions";

type Notif = {
  id: number;
  type: string;
  message: string | null;
  actor_name: string | null;
  task_id: number;
  read_at: string | null;
  created_at: string;
  tasks?: { department_id?: string | null; item_kind?: string | null } | null;
};

type Tab = "all" | "unread";

const TYPE_LABEL: Record<string, string> = {
  assigned:     "hat dich einer Aufgabe zugewiesen",
  note_added:   "hat eine Notiz hinzugefügt",
  task_changed: "hat eine Aufgabe geändert",
};

const TYPE_AVATAR_BG: Record<string, string> = {
  assigned:     "#ede9fe",
  note_added:   "#dbeafe",
  task_changed: "#ffedd5",
};
const TYPE_AVATAR_COLOR: Record<string, string> = {
  assigned:     "#7c3aed",
  note_added:   "#1d4ed8",
  task_changed: "#c2410c",
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function formatDate(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Gestern";
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

function groupByDay(notifications: Notif[]): { label: string; items: Notif[] }[] {
  const groups: Map<string, Notif[]> = new Map();
  const now = new Date();

  for (const n of notifications) {
    const d = new Date(n.created_at);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    let label: string;
    if (diffDays === 0) label = "Heute";
    else if (diffDays === 1) label = "Gestern";
    else if (diffDays < 7) label = "Letzte 7 Tage";
    else label = "Älter";

    const arr = groups.get(label) ?? [];
    arr.push(n);
    groups.set(label, arr);
  }

  const ORDER = ["Heute", "Gestern", "Letzte 7 Tage", "Älter"];
  return ORDER.filter((l) => groups.has(l)).map((l) => ({ label: l, items: groups.get(l)! }));
}

export function NotificationsBell({ deptSlugs }: { deptSlugs: Record<string, string> }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const unread = notifications.filter((n) => !n.read_at);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("task_notifications")
        .select("id,type,message,actor_name,task_id,read_at,created_at,tasks(department_id,item_kind)")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setNotifications((data ?? []) as Notif[]);
    }
    load();

    let userId: string | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      const channel = supabase
        .channel("notif-bell")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "task_notifications", filter: `user_id=eq.${userId}` },
          () => load(),
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  const handleOpen = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((v) => !v);
  };

  const handleClick = (n: Notif) => {
    if (!n.read_at) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      startTransition(async () => { await markNotificationRead(n.id); });
    }
    const deptId = n.tasks?.department_id;
    const slug = deptId ? deptSlugs[deptId] : null;
    const isOkr = ["objective", "key_result"].includes(n.tasks?.item_kind ?? "");
    const href = slug
      ? isOkr ? `/d/${slug}/okrs/table` : `/d/${slug}/tasks`
      : isOkr ? `/okrs/table` : `/tasks`;
    setOpen(false);
    router.push(href);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    startTransition(async () => { await markAllNotificationsRead(); });
  };

  const visible = tab === "unread" ? unread : notifications;
  const grouped = groupByDay(visible);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="hs-iconbtn relative"
        title="Benachrichtigungen"
        aria-label="Benachrichtigungen"
        onClick={handleOpen}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 22a2 2 0 002-2H10a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        {unread.length > 0 && (
          <span className="absolute right-[3px] top-[3px] h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {open && rect &&
        ReactDOM.createPortal(
          <>
            {/* backdrop */}
            <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />

            {/* panel */}
            <div
              className="fixed z-[999] flex w-[380px] flex-col rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl overflow-hidden"
              style={{
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
                maxHeight: "calc(100vh - 80px)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3.5">
                <span className="text-[15px] font-bold text-[#1a1f36]">Benachrichtigungen</span>
                <div className="flex items-center gap-2">
                  {unread.length > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1f36] transition-colors"
                    >
                      Alle gelesen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setOpen(false); router.push("/dashboard"); }}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1f36] transition-colors"
                  >
                    Alle anzeigen
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-0 border-b border-[#f0f0f0] px-4">
                {(["all", "unread"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`relative pb-2.5 pt-2.5 mr-5 text-[12px] font-semibold transition-colors ${
                      tab === t
                        ? "text-[#1a1f36] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-[#1a1f36] after:content-['']"
                        : "text-[#9ca3af] hover:text-[#6b7280]"
                    }`}
                  >
                    {t === "all" ? "Alle" : `Ungelesen${unread.length > 0 ? ` (${unread.length})` : ""}`}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="overflow-y-auto">
                {visible.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-[#9ca3af]">
                    {tab === "unread" ? "Keine ungelesenen Benachrichtigungen." : "Keine Benachrichtigungen."}
                  </p>
                ) : (
                  grouped.map((group) => (
                    <div key={group.label}>
                      <p className="bg-[#f9fafb] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9ca3af]">
                        {group.label}
                      </p>
                      {group.items.map((n) => {
                        const isUnread = !n.read_at;
                        const initials = getInitials(n.actor_name);
                        const bg = TYPE_AVATAR_BG[n.type] ?? "#f3f4f6";
                        const color = TYPE_AVATAR_COLOR[n.type] ?? "#6b7280";
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleClick(n)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f9fafb] ${isUnread ? "bg-[#fafbff]" : "bg-white"}`}
                          >
                            {/* Avatar */}
                            <div
                              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                              style={{ background: bg, color }}
                            >
                              {initials}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] leading-snug text-[#374151]">
                                <span className="font-semibold text-[#1a1f36]">
                                  {n.actor_name ? n.actor_name.charAt(0).toUpperCase() + n.actor_name.slice(1) : "Jemand"}
                                </span>{" "}
                                {TYPE_LABEL[n.type] ?? n.type}
                              </p>
                              {n.message && (
                                <p className="mt-0.5 truncate text-[12px] text-[#6b7280]">{n.message}</p>
                              )}
                              <p className="mt-1 text-[11px] text-[#9ca3af]">{formatDate(n.created_at)}</p>
                            </div>

                            {/* Unread dot */}
                            {isUnread && (
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#3b82f6]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
