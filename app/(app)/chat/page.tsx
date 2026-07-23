"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/format";
import { containsProfanity } from "@/lib/profanity";
import { isImageSafe } from "@/lib/nsfw";
import { getSupabase } from "@/lib/supabase/client";
import { uploadChatImage } from "@/lib/supabase/data";
import {
  Megaphone,
  Hash,
  Users2,
  Send,
  Pin,
  Lock,
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  ArrowUpDown,
  ImagePlus,
  X,
  Loader2,
  Check,
  Eraser,
} from "lucide-react";
import type { Channel } from "@/lib/types";

const LASTREAD_KEY = "hillcrest-hub:lastread:v1";

type SortMode = "recent" | "unread" | "name" | "dms";
const SORTS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "Recent activity" },
  { id: "unread", label: "Unread first" },
  { id: "name", label: "Name (A–Z)" },
  { id: "dms", label: "Direct messages" },
];

function channelIcon(kind: Channel["kind"]) {
  if (kind === "announcement") return Megaphone;
  if (kind === "department") return Users2;
  if (kind === "direct") return Users2;
  return Hash;
}

export default function ChatPage() {
  const { user, can } = useAuth();
  const { data, sendMessage, deleteMessage, clearChat } = useStore();
  const isAdmin = user?.role === "admin";

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [lastRead, setLastRead] = useState<Record<string, string>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setLastRead(JSON.parse(window.localStorage.getItem(LASTREAD_KEY) || "{}"));
    } catch {
      /* ignore */
    }
  }, []);

  const markRead = (channelId: string) => {
    setLastRead((prev) => {
      const next = { ...prev, [channelId]: new Date().toISOString() };
      window.localStorage.setItem(LASTREAD_KEY, JSON.stringify(next));
      return next;
    });
  };

  const unreadCount = (channelId: string) => {
    const since = lastRead[channelId];
    return data.messages.filter(
      (m) =>
        m.channelId === channelId &&
        m.authorId !== user?.id &&
        (!since || m.createdAt > since)
    ).length;
  };

  const lastMsgAt = (channelId: string) => {
    let latest = "";
    for (const m of data.messages)
      if (m.channelId === channelId && m.createdAt > latest) latest = m.createdAt;
    return latest;
  };

  // Channels I'm allowed to see (admins see all; the server RLS also enforces).
  const myChannels = useMemo(() => {
    if (!user) return [];
    let list = data.channels.filter(
      (c) =>
        c.memberIds.includes("*") ||
        c.memberIds.includes(user.id) ||
        isAdmin
    );
    if (sortMode === "dms") list = list.filter((c) => c.kind === "direct");
    const sorted = [...list];
    if (sortMode === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === "unread")
      sorted.sort((a, b) => unreadCount(b.id) - unreadCount(a.id));
    else
      sorted.sort((a, b) => (lastMsgAt(a.id) < lastMsgAt(b.id) ? 1 : -1));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.channels, data.messages, user, isAdmin, sortMode, lastRead]);

  const active =
    myChannels.find((c) => c.id === activeId) ?? myChannels[0] ?? null;

  const messages = useMemo(
    () =>
      data.messages
        .filter((m) => m.channelId === active?.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [data.messages, active?.id]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.id]);

  // Mark the open channel read when it changes or new messages land.
  useEffect(() => {
    if (active) markRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, messages.length]);

  if (!user || !active) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <p className="text-ink-soft">No chats yet.</p>
          {isAdmin && (
            <button
              onClick={() => setCreating(true)}
              className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Create a chat
            </button>
          )}
          {creating && (
            <NewChatModal onClose={() => setCreating(false)} onOpen={setActiveId} />
          )}
        </div>
      </div>
    );
  }

  const isAnnouncement = active.kind === "announcement";
  const canPost = !isAnnouncement || can("post_announcement");

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || !canPost) return;
    if (containsProfanity(text)) {
      flashNotice("Message blocked — please keep the language clean. 🙏");
      return;
    }
    sendMessage(active.id, user.id, text);
    setDraft("");
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canPost) return;
    const sb = getSupabase();
    if (!sb) {
      flashNotice("Image sending needs Supabase (it's on in production).");
      return;
    }
    setImgBusy(true);
    setNotice("Checking image…");
    const check = await isImageSafe(file);
    if (!check.safe) {
      setImgBusy(false);
      flashNotice(check.reason ?? "That image can't be sent.");
      return;
    }
    const up = await uploadChatImage(sb, user.id, file);
    setImgBusy(false);
    if (up.error || !up.url) {
      flashNotice(up.error ?? "Upload failed.");
      return;
    }
    setNotice(null);
    sendMessage(active.id, user.id, draft.trim(), up.url);
    setDraft("");
  };

  return (
    <div className="flex h-screen">
      {/* Channel list */}
      <div
        className={`w-full shrink-0 border-r border-line bg-surface md:w-72 ${
          showThreadMobile ? "hidden md:block" : "block"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow mb-0.5">Messages</p>
            <h1 className="text-lg font-bold text-ink">Chats</h1>
          </div>
          <div className="flex items-center gap-1">
            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="rounded-lg p-2 text-ink-soft hover:bg-surface-2"
                title="Sort chats"
              >
                <ArrowUpDown size={17} />
              </button>
              {sortOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSortOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-surface p-1 shadow-lg">
                    {SORTS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSortMode(s.id);
                          setSortOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                          sortMode === s.id
                            ? "bg-brand-soft text-brand-dark"
                            : "text-ink hover:bg-surface-2"
                        }`}
                      >
                        {s.label}
                        {sortMode === s.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* New chat (admins) */}
            {isAdmin && (
              <button
                onClick={() => setCreating(true)}
                className="rounded-lg bg-brand p-2 text-white hover:bg-brand-dark"
                title="New chat"
              >
                <Plus size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto p-2">
          {myChannels.map((c) => {
            const Icon = channelIcon(c.kind);
            const last = [...data.messages]
              .filter((m) => m.channelId === c.id)
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
            const unread = unreadCount(c.id);
            const activeState = c.id === active.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveId(c.id);
                  setShowThreadMobile(true);
                  markRead(c.id);
                }}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  activeState ? "bg-brand-soft" : "hover:bg-surface-2"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    c.kind === "announcement"
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-ink-soft"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {c.name}
                    </span>
                    {unread > 0 && (
                      <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {last
                      ? last.deleted
                        ? "Message deleted"
                        : last.imageUrl && !last.body
                          ? "📷 Photo"
                          : last.body
                      : c.description ?? "No messages yet"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div
        className={`flex min-w-0 flex-1 flex-col bg-bg ${
          showThreadMobile ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3.5 sm:px-6">
          <button
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2 md:hidden"
            onClick={() => setShowThreadMobile(false)}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-bold text-ink">{active.name}</h2>
              {isAnnouncement && (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase text-brand-dark">
                  Broadcast
                </span>
              )}
              {!active.memberIds.includes("*") && (
                <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                  <Lock size={9} /> Private
                </span>
              )}
            </div>
            {active.description && (
              <p className="truncate text-xs text-ink-soft">
                {active.description}
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Clear ALL messages in "${active.name}"? This permanently deletes the history for everyone.`
                  )
                )
                  clearChat(active.id);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-danger/40 hover:bg-red-50 hover:text-danger"
              title="Clear chat (admin)"
            >
              <Eraser size={14} /> Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.map((m) => {
            const who = data.members.find((x) => x.id === m.authorId);
            const mine = m.authorId === user.id;
            const canDelete = !m.deleted && (mine || isAdmin);
            const deleter = data.members.find((x) => x.id === m.deletedById);
            const isRevealed = revealed.has(m.id);
            return (
              <div key={m.id} className="group flex gap-3">
                {who && <Avatar member={who} size={36} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {who?.name}
                      {mine && (
                        <span className="ml-1 text-xs font-normal text-ink-soft">
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {relativeTime(m.createdAt)}
                    </span>
                    {m.pinned && <Pin size={12} className="text-brand" />}
                    {canDelete && (
                      <button
                        onClick={() => deleteMessage(m.id, user.id)}
                        className="ml-auto rounded p-1 text-ink-soft/40 transition hover:bg-red-50 hover:text-danger"
                        title="Delete message"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {m.deleted ? (
                    <div className="mt-0.5">
                      <p className="flex items-center gap-1.5 text-sm italic text-ink-soft">
                        <Trash2 size={12} />
                        {deleter
                          ? `${deleter.name.split(" ")[0]} deleted this message`
                          : "This message was deleted"}
                      </p>
                      {isAdmin && (m.originalBody ?? "") !== "" && (
                        <div className="mt-1">
                          <button
                            onClick={() =>
                              setRevealed((s) => {
                                const n = new Set(s);
                                if (n.has(m.id)) n.delete(m.id);
                                else n.add(m.id);
                                return n;
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark"
                          >
                            {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                            {isRevealed ? "Hide" : "Show deleted (admin only)"}
                          </button>
                          {isRevealed && (
                            <p className="mt-1 rounded-md border border-dashed border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink">
                              {m.originalBody}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {m.body && (
                        <p className="mt-0.5 text-sm leading-relaxed text-ink">
                          {m.body}
                        </p>
                      )}
                      {m.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imageUrl}
                          alt="shared"
                          className="mt-1.5 max-h-72 max-w-xs rounded-xl border border-line object-cover"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface p-3 sm:p-4">
          {notice && (
            <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-center text-xs font-medium text-ink-soft">
              {notice}
            </p>
          )}
          {canPost ? (
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickImage}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={imgBusy}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:bg-surface-2 disabled:opacity-50"
                title="Send a photo"
              >
                {imgBusy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ImagePlus size={18} />
                )}
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder={
                  isAnnouncement
                    ? "Write an announcement to the whole team…"
                    : `Message ${active.name}…`
                }
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40"
              >
                <Send size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 py-3 text-sm text-ink-soft">
              <Lock size={14} />
              Only leadership can post announcements.
            </div>
          )}
        </div>
      </div>

      {creating && (
        <NewChatModal onClose={() => setCreating(false)} onOpen={setActiveId} />
      )}
    </div>
  );
}

function NewChatModal({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { user } = useAuth();
  const { data, createChat } = useStore();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const others = data.members.filter((m) => m.id !== user?.id);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const isDm = selected.size === 1 && !name.trim();
  const canCreate = selected.size >= 1 && (name.trim() !== "" || selected.size === 1);

  const create = async () => {
    if (!user || !canCreate) return;
    setBusy(true);
    const memberIds = [user.id, ...Array.from(selected)];
    const other = data.members.find((m) => selected.has(m.id));
    const chatName = name.trim() || (isDm && other ? other.name : "New chat");
    const id = await createChat({
      name: chatName,
      kind: isDm ? "direct" : "team",
      memberIds,
    });
    setBusy(false);
    onClose();
    if (id) onOpen(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line p-5">
          <div>
            <h2 className="text-lg font-bold text-ink">New chat</h2>
            <p className="text-xs text-ink-soft">
              Only people you add can see this chat.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Chat name {isDm && "(optional for a 1:1)"}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Worship Planning"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-ink-soft">
              Add people ({selected.size} selected)
            </label>
            <div className="space-y-1">
              {others.map((m) => {
                const on = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      on
                        ? "border-brand bg-brand-soft/50"
                        : "border-line hover:bg-surface-2"
                    }`}
                  >
                    <Avatar member={m} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">
                        {m.name}
                      </div>
                      <div className="truncate text-xs text-ink-soft">
                        {m.title ?? m.department}
                      </div>
                    </div>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                        on ? "border-brand bg-brand text-white" : "border-line"
                      }`}
                    >
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-line p-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!canCreate || busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Create chat
          </button>
        </div>
      </div>
    </div>
  );
}
