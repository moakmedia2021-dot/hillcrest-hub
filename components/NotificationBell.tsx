"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, KanbanSquare, CalendarDays, MessagesSquare } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { buildNotifications } from "@/lib/notifications";

const LASTREAD_KEY = "hillcrest-hub:lastread:v1";
const ICON = { task: KanbanSquare, event: CalendarDays, chat: MessagesSquare };

export function NotificationBell() {
  const { data } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [lastRead, setLastRead] = useState<Record<string, string>>({});

  useEffect(() => {
    const read = () => {
      try {
        setLastRead(
          JSON.parse(window.localStorage.getItem(LASTREAD_KEY) || "{}")
        );
      } catch {
        /* ignore */
      }
    };
    read();
    // Refresh when returning to the tab (unread chats may have changed).
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, [open]);

  if (!user) return null;
  const notifs = buildNotifications(data, user, lastRead);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-ink-soft hover:bg-surface-2"
        title="Notifications"
      >
        <Bell size={18} />
        {notifs.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {notifs.length > 9 ? "9+" : notifs.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-80 max-w-[85vw] rounded-2xl border border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-bold text-ink">Notifications</span>
              <span className="text-xs text-ink-soft">{notifs.length}</span>
            </div>
            {notifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-soft">
                You&apos;re all caught up. 🎉
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                {notifs.map((n) => {
                  const Icon = ICON[n.icon];
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            n.urgent
                              ? "bg-red-100 text-danger"
                              : "bg-brand-soft text-brand-dark"
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <span className="text-sm text-ink">{n.text}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
