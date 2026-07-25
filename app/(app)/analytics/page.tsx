"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { STAGES } from "@/lib/types";
import { Film, Send, CalendarRange, Users } from "lucide-react";

export default function AnalyticsPage() {
  const { data } = useStore();
  const { user, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !can("manage_schedule")) router.replace("/dashboard");
  }, [user, can, router]);
  if (!user || !can("manage_schedule")) return null;

  const liveMessages = data.messages.filter((m) => !m.deleted);
  const posted = data.tasks.filter((t) => t.stage === "posted").length;
  const activeIds = new Set(liveMessages.map((m) => m.authorId));

  const stats = [
    { label: "Content pieces", value: data.tasks.length, icon: Film },
    { label: "Published", value: posted, icon: Send },
    { label: "Events", value: data.events.length, icon: CalendarRange },
    { label: "Active people", value: activeIds.size, icon: Users },
  ];

  // Production pipeline by stage
  const byStage = STAGES.map((s) => ({
    label: s.label,
    count: data.tasks.filter((t) => t.stage === s.id).length,
  }));
  const stageMax = Math.max(1, ...byStage.map((s) => s.count));

  // Top contributors by messages sent
  const contrib = data.members
    .map((m) => ({
      member: m,
      count: liveMessages.filter((x) => x.authorId === m.id).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const contribMax = Math.max(1, ...contrib.map((c) => c.count));

  // Chat activity by channel
  const byChannel = data.channels
    .map((c) => ({
      name: c.name,
      count: liveMessages.filter((m) => m.channelId === c.id).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const chanMax = Math.max(1, ...byChannel.map((c) => c.count));

  return (
    <>
      <PageHeader
        eyebrow="Leadership"
        title="Analytics"
        subtitle="Content output, engagement, and chat activity across the team."
      />

      <div className="space-y-6 p-5 sm:p-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                <s.icon size={18} />
              </div>
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-4 font-bold text-ink">Production pipeline</h2>
            <div className="space-y-2.5">
              {byStage.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-ink-soft">
                    {s.label}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-surface-2">
                    <div
                      className="h-full rounded-md bg-brand"
                      style={{ width: `${(s.count / stageMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm font-semibold text-ink">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-bold text-ink">Top contributors</h2>
            {contrib.length === 0 ? (
              <p className="text-sm text-ink-soft">No chat activity yet.</p>
            ) : (
              <div className="space-y-3">
                {contrib.map((c) => (
                  <div key={c.member.id} className="flex items-center gap-3">
                    <Avatar member={c.member} size={28} />
                    <span className="w-24 shrink-0 truncate text-sm text-ink">
                      {c.member.name.split(" ")[0]}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded-md bg-surface-2">
                      <div
                        className="h-full rounded-md bg-brand"
                        style={{ width: `${(c.count / contribMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold text-ink">Chat activity by channel</h2>
          {byChannel.length === 0 ? (
            <p className="text-sm text-ink-soft">No messages yet.</p>
          ) : (
            <div className="space-y-2.5">
              {byChannel.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-ink-soft">
                    {c.name}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-surface-2">
                    <div
                      className="h-full rounded-md bg-brand-dark"
                      style={{ width: `${(c.count / chanMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
