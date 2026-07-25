"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Users,
  CalendarRange,
  KanbanSquare,
  BookOpen,
  MessagesSquare,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar } from "./Avatar";

export function GlobalSearch() {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return null;
    const has = (s?: string) => (s ?? "").toLowerCase().includes(query);
    return {
      people: data.members
        .filter((m) => has(m.name) || has(m.username) || has(m.title) || has(m.department))
        .slice(0, 6),
      events: data.events.filter((e) => has(e.title) || has(e.location)).slice(0, 6),
      tasks: data.tasks.filter((t) => has(t.title) || has(t.description)).slice(0, 6),
      resources: data.resources
        .filter((r) => has(r.title) || has(r.description))
        .slice(0, 6),
      chats: data.channels.filter((c) => has(c.name)).slice(0, 6),
    };
  }, [query, data]);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const total = results
    ? results.people.length +
      results.events.length +
      results.tasks.length +
      results.resources.length +
      results.chats.length
    : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-ink-soft hover:bg-surface-2"
        title="Search (⌘K)"
      >
        <Search size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
          onClick={close}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={18} className="text-ink-soft" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people, events, tasks, resources, chats…"
                className="flex-1 bg-transparent py-3.5 text-sm text-ink outline-none"
              />
              <button
                onClick={close}
                className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {!results ? (
                <p className="px-4 py-8 text-center text-sm text-ink-soft">
                  Start typing to search across the hub.
                </p>
              ) : total === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-soft">
                  No matches for “{q}”.
                </p>
              ) : (
                <div className="p-2">
                  <Group label="People" icon={Users}>
                    {results.people.map((m) => (
                      <Row key={m.id} href="/team" onNav={close}>
                        <Avatar member={m} size={26} />
                        <span className="truncate">{m.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-ink-soft">
                          {m.department}
                        </span>
                      </Row>
                    ))}
                  </Group>
                  <Group label="Events" icon={CalendarRange}>
                    {results.events.map((e) => (
                      <Row key={e.id} href={`/events/${e.id}`} onNav={close}>
                        <span className="truncate">{e.title}</span>
                      </Row>
                    ))}
                  </Group>
                  <Group label="Tasks" icon={KanbanSquare}>
                    {results.tasks.map((t) => (
                      <Row key={t.id} href="/schedule" onNav={close}>
                        <span className="truncate">{t.title}</span>
                      </Row>
                    ))}
                  </Group>
                  <Group label="Resources" icon={BookOpen}>
                    {results.resources.map((r) => (
                      <Row key={r.id} href="/resources" onNav={close}>
                        <span className="truncate">{r.title}</span>
                      </Row>
                    ))}
                  </Group>
                  <Group label="Chats" icon={MessagesSquare}>
                    {results.chats.map((c) => (
                      <Row key={c.id} href="/chat" onNav={close}>
                        <span className="truncate">{c.name}</span>
                      </Row>
                    ))}
                  </Group>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Users;
  children: React.ReactNode[];
}) {
  if (children.length === 0) return null;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-soft/70">
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  href,
  onNav,
  children,
}: {
  href: string;
  onNav: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNav}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}
