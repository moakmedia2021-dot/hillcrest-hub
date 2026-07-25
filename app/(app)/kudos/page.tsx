"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/format";
import { Heart, Send } from "lucide-react";

export default function KudosPage() {
  const { data, giveKudos } = useStore();
  const { user } = useAuth();
  const [toId, setToId] = useState("");
  const [message, setMessage] = useState("");

  if (!user) return null;
  const others = data.members.filter((m) => m.id !== user.id);
  const feed = [...data.kudos].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );

  const submit = () => {
    if (!toId || !message.trim()) return;
    giveKudos(user.id, toId, message.trim());
    setToId("");
    setMessage("");
  };

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <>
      <PageHeader
        eyebrow="Recognition"
        title="Kudos"
        subtitle="Celebrate your team. A little encouragement goes a long way."
      />

      <div className="mx-auto max-w-2xl space-y-6 p-5 sm:p-8">
        {/* Give kudos */}
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
            <Heart size={16} className="text-brand" /> Give a shout-out
          </h2>
          <div className="space-y-3">
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className={field}
            >
              <option value="">Who deserves recognition?</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="What did they do great?"
              className={`${field} resize-none`}
            />
            <button
              onClick={submit}
              disabled={!toId || !message.trim()}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
            >
              <Send size={15} /> Send kudos
            </button>
          </div>
        </div>

        {/* Feed */}
        {feed.length === 0 ? (
          <p className="text-center text-sm text-ink-soft">
            No kudos yet — be the first to encourage someone. 💙
          </p>
        ) : (
          <div className="space-y-3">
            {feed.map((k) => {
              const from = data.members.find((m) => m.id === k.fromId);
              const to = data.members.find((m) => m.id === k.toId);
              return (
                <div key={k.id} className="card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    {from && <Avatar member={from} size={26} />}
                    <span className="font-semibold text-ink">
                      {from?.name.split(" ")[0] ?? "Someone"}
                    </span>
                    <Heart size={13} className="text-brand" />
                    <span className="font-semibold text-ink">
                      {to?.name ?? "a teammate"}
                    </span>
                    <span className="ml-auto text-xs text-ink-soft">
                      {relativeTime(k.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-ink">{k.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
