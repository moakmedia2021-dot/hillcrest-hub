"use client";

// ─────────────────────────────────────────────
// Demo data layer.
// Everything the UI needs goes through this provider.
// Persistence is localStorage today; swap the read/write
// internals for Supabase later without touching components.
// ─────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SEED } from "./seed";
import type {
  AppData,
  Channel,
  Message,
  ProductionTask,
  Member,
  TaskStage,
  ChurchEvent,
  EventTemplate,
} from "./types";
import { SUPABASE_ENABLED } from "./supabase/config";
import { getSupabase } from "./supabase/client";
import { loadAll, subscribe, writes } from "./supabase/data";

const STORAGE_KEY = "hillcrest-hub:data:v1";

function load(): AppData {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merge with SEED so data saved before a field existed still loads.
      const parsed = JSON.parse(raw) as Partial<AppData>;
      return { ...SEED, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return SEED;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// The live client when Supabase is on, else null (demo mode). Actions update
// local state optimistically and, when live, also persist; realtime reconciles.
const live = () => (SUPABASE_ENABLED ? getSupabase() : null);

interface StoreValue {
  data: AppData;
  // messages
  sendMessage: (channelId: string, authorId: string, body: string) => void;
  // tasks
  addTask: (t: Omit<ProductionTask, "id" | "createdAt">) => void;
  moveTask: (taskId: string, stage: TaskStage) => void;
  updateTask: (taskId: string, patch: Partial<ProductionTask>) => void;
  deleteTask: (taskId: string) => void;
  // members
  setMemberRole: (memberId: string, role: Member["role"]) => void;
  // channels
  addChannel: (c: Omit<Channel, "id">) => void;
  // events
  createEvent: (input: {
    title: string;
    category: ChurchEvent["category"];
    date: string;
    time?: string;
    location?: string;
    ownerId?: string;
    notes?: string;
    template?: EventTemplate;
  }) => string;
  updateEvent: (eventId: string, patch: Partial<ChurchEvent>) => void;
  deleteEvent: (eventId: string) => void;
  toggleEventTask: (eventId: string, taskId: string) => void;
  assignEventTask: (
    eventId: string,
    taskId: string,
    assigneeId: string
  ) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(SEED);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate after mount. Supabase mode loads live data + subscribes to
  // realtime; demo mode reads localStorage. (avoids SSR mismatch either way)
  useEffect(() => {
    const sb = SUPABASE_ENABLED ? getSupabase() : null;
    if (sb) {
      let unsub = () => {};
      const refresh = () => loadAll(sb).then(setData).catch(() => {});
      refresh().then(() => {
        unsub = subscribe(sb, refresh);
      });
      setHydrated(true);
      return () => unsub();
    }
    setData(load());
    setHydrated(true);
  }, []);

  // Demo mode persists to localStorage. Supabase mode persists via each action.
  useEffect(() => {
    if (!hydrated || SUPABASE_ENABLED) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      sendMessage: (channelId, authorId, body) => {
        const sb = live();
        if (sb) {
          writes.sendMessage(sb, channelId, authorId, body.trim());
          return;
        }
        const msg: Message = {
          id: uid(),
          channelId,
          authorId,
          body: body.trim(),
          createdAt: new Date().toISOString(),
        };
        setData((d) => ({ ...d, messages: [...d.messages, msg] }));
      },
      addTask: (t) => {
        const sb = live();
        if (sb) {
          writes.addTask(sb, t);
          return;
        }
        const task: ProductionTask = {
          ...t,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        setData((d) => ({ ...d, tasks: [task, ...d.tasks] }));
      },
      moveTask: (taskId, stage) => {
        const sb = live();
        if (sb) writes.moveTask(sb, taskId, stage);
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, stage } : t)),
        }));
      },
      updateTask: (taskId, patch) =>
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        })),
      deleteTask: (taskId) => {
        const sb = live();
        if (sb) writes.deleteTask(sb, taskId);
        setData((d) => ({
          ...d,
          tasks: d.tasks.filter((t) => t.id !== taskId),
        }));
      },
      setMemberRole: (memberId, role) => {
        const sb = live();
        if (sb) writes.setMemberRole(sb, memberId, role);
        setData((d) => ({
          ...d,
          members: d.members.map((m) =>
            m.id === memberId ? { ...m, role } : m
          ),
        }));
      },
      addChannel: (c) =>
        setData((d) => ({
          ...d,
          channels: [...d.channels, { ...c, id: uid() }],
        })),
      createEvent: (input) => {
        const id = uid();
        // Turn template items into event tasks, computing due dates from the
        // event date minus each item's offset.
        const tasks =
          input.template?.items.map((it) => {
            const due = new Date(input.date);
            due.setDate(due.getDate() - it.offsetDays);
            return {
              id: uid(),
              label: it.label,
              done: false,
              dueDate: due.toISOString().slice(0, 10),
            };
          }) ?? [];
        const event: ChurchEvent = {
          id,
          title: input.title,
          category: input.category,
          date: input.date,
          time: input.time,
          location: input.location,
          ownerId: input.ownerId,
          notes: input.notes,
          templateId: input.template?.id,
          tasks,
          createdAt: new Date().toISOString(),
        };
        const sb = live();
        if (sb) writes.createEvent(sb, event);
        setData((d) => ({ ...d, events: [...d.events, event] }));
        return id;
      },
      updateEvent: (eventId, patch) =>
        setData((d) => ({
          ...d,
          events: d.events.map((e) =>
            e.id === eventId ? { ...e, ...patch } : e
          ),
        })),
      deleteEvent: (eventId) => {
        const sb = live();
        if (sb) writes.deleteEvent(sb, eventId);
        setData((d) => ({
          ...d,
          events: d.events.filter((e) => e.id !== eventId),
        }));
      },
      toggleEventTask: (eventId, taskId) => {
        const sb = live();
        if (sb) {
          const cur = data.events
            .find((e) => e.id === eventId)
            ?.tasks.find((t) => t.id === taskId);
          if (cur) writes.toggleEventTask(sb, taskId, !cur.done);
        }
        setData((d) => ({
          ...d,
          events: d.events.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  tasks: e.tasks.map((t) =>
                    t.id === taskId ? { ...t, done: !t.done } : t
                  ),
                }
              : e
          ),
        }));
      },
      assignEventTask: (eventId, taskId, assigneeId) => {
        const sb = live();
        if (sb) writes.assignEventTask(sb, taskId, assigneeId);
        setData((d) => ({
          ...d,
          events: d.events.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  tasks: e.tasks.map((t) =>
                    t.id === taskId ? { ...t, assigneeId } : t
                  ),
                }
              : e
          ),
        }));
      },
      reset: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setData(SEED);
      },
    }),
    [data]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Convenience selectors
export function useMember(id?: string): Member | undefined {
  const { data } = useStore();
  return data.members.find((m) => m.id === id);
}

export function channelsForMember(data: AppData, memberId: string): Channel[] {
  return data.channels.filter(
    (c) => c.memberIds.includes("*") || c.memberIds.includes(memberId)
  );
}
