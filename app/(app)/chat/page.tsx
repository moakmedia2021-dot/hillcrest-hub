"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useStore, channelsForMember } from "@/lib/store";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/format";
import {
  Megaphone,
  Hash,
  Users2,
  Send,
  Pin,
  Lock,
  ArrowLeft,
} from "lucide-react";
import type { Channel } from "@/lib/types";

function channelIcon(kind: Channel["kind"]) {
  if (kind === "announcement") return Megaphone;
  if (kind === "department") return Users2;
  return Hash;
}

export default function ChatPage() {
  const { user, can } = useAuth();
  const { data, sendMessage } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const myChannels = useMemo(
    () => (user ? channelsForMember(data, user.id) : []),
    [data, user]
  );

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

  if (!user || !active) return null;

  const isAnnouncement = active.kind === "announcement";
  const canPost = !isAnnouncement || can("post_announcement");

  const submit = () => {
    if (!draft.trim() || !canPost) return;
    sendMessage(active.id, user.id, draft);
    setDraft("");
  };

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen">
      {/* Channel list */}
      <div
        className={`w-full shrink-0 border-r border-line bg-surface md:w-72 ${
          showThreadMobile ? "hidden md:block" : "block"
        }`}
      >
        <div className="border-b border-line px-5 py-4">
          <p className="eyebrow mb-0.5">Messages</p>
          <h1 className="text-lg font-bold text-ink">Channels</h1>
        </div>
        <div className="p-2">
          {myChannels.map((c) => {
            const Icon = channelIcon(c.kind);
            const last = [...data.messages]
              .filter((m) => m.channelId === c.id)
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
            const activeState = c.id === active.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveId(c.id);
                  setShowThreadMobile(true);
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
                  <div className="truncate text-sm font-semibold text-ink">
                    {c.name}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {last ? last.body : c.description}
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-bold text-ink">{active.name}</h2>
              {isAnnouncement && (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase text-brand-dark">
                  Broadcast
                </span>
              )}
            </div>
            {active.description && (
              <p className="truncate text-xs text-ink-soft">
                {active.description}
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.map((m) => {
            const who = data.members.find((x) => x.id === m.authorId);
            const mine = m.authorId === user.id;
            return (
              <div key={m.id} className="flex gap-3">
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
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink">
                    {m.body}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface p-3 sm:p-4">
          {canPost ? (
            <div className="flex items-end gap-2">
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
    </div>
  );
}
