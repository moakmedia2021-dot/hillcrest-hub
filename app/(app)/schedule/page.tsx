"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { STAGES, type TaskStage, type Platform } from "@/lib/types";
import { dueMeta } from "@/lib/format";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Camera,
  Video,
  Users,
  Globe,
  Music2,
} from "lucide-react";

// Lucide dropped brand logos, so we map platforms to neutral icons.
const PLATFORM_ICON: Record<Platform, typeof Camera> = {
  instagram: Camera,
  youtube: Video,
  facebook: Users,
  tiktok: Music2,
  web: Globe,
};

const toneClass = {
  ok: "bg-slate-100 text-slate-600",
  warn: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  muted: "bg-slate-100 text-slate-500",
} as const;

export default function SchedulePage() {
  const { data, moveTask, deleteTask, addTask } = useStore();
  const { can } = useAuth();
  const manage = can("manage_schedule");
  const [adding, setAdding] = useState(false);

  const stageIndex = (s: TaskStage) => STAGES.findIndex((x) => x.id === s);

  return (
    <>
      <PageHeader
        eyebrow="Social Media Production"
        title="Production Schedule"
        subtitle="Track every piece of content from idea to posted."
        action={
          manage && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Plus size={16} /> New task
            </button>
          )
        }
      />

      <div className="overflow-x-auto p-5 sm:p-8">
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage) => {
            const tasks = data.tasks.filter((t) => t.stage === stage.id);
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">
                      {stage.label}
                    </span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                      {tasks.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {tasks.map((t) => {
                    const who = data.members.find((m) => m.id === t.assigneeId);
                    const due = dueMeta(t.dueDate);
                    const Pi = t.platform ? PLATFORM_ICON[t.platform] : null;
                    const idx = stageIndex(t.stage);
                    return (
                      <div key={t.id} className="card p-3.5 shadow-sm">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-ink">
                            {t.title}
                          </p>
                          {Pi && (
                            <Pi
                              size={15}
                              className="mt-0.5 shrink-0 text-ink-soft"
                            />
                          )}
                        </div>
                        {t.description && (
                          <p className="mb-2 line-clamp-2 text-xs text-ink-soft">
                            {t.description}
                          </p>
                        )}
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${toneClass[due.tone]}`}
                          >
                            {due.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          {who ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar member={who} size={22} />
                              <span className="text-xs text-ink-soft">
                                {who.name.split(" ")[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-soft">
                              Unassigned
                            </span>
                          )}

                          {manage && (
                            <div className="flex items-center gap-0.5">
                              <button
                                disabled={idx === 0}
                                onClick={() =>
                                  moveTask(t.id, STAGES[idx - 1].id)
                                }
                                className="rounded-md p-1 text-ink-soft hover:bg-surface-2 disabled:opacity-30"
                                title="Move back"
                              >
                                <ChevronLeft size={15} />
                              </button>
                              <button
                                disabled={idx === STAGES.length - 1}
                                onClick={() =>
                                  moveTask(t.id, STAGES[idx + 1].id)
                                }
                                className="rounded-md p-1 text-ink-soft hover:bg-surface-2 disabled:opacity-30"
                                title="Move forward"
                              >
                                <ChevronRight size={15} />
                              </button>
                              <button
                                onClick={() => deleteTask(t.id)}
                                className="rounded-md p-1 text-ink-soft hover:bg-red-50 hover:text-danger"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {tasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-ink-soft">
                      Nothing here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {adding && (
        <NewTaskModal onClose={() => setAdding(false)} onCreate={addTask} />
      )}
    </>
  );
}

function NewTaskModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: ReturnType<typeof useStore>["addTask"];
}) {
  const { data } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [stage, setStage] = useState<TaskStage>("idea");

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
      platform: (platform || undefined) as Platform | undefined,
      stage,
    });
    onClose();
  };

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">New production task</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sunday sermon reel"
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${field} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={field}
              >
                <option value="">Unassigned</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className={field}
              >
                <option value="">None</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
                <option value="web">Website</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as TaskStage)}
                className={field}
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}
