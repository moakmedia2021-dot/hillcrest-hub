"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { getSupabase } from "@/lib/supabase/client";
import {
  actionToTask,
  loadPrivateNote,
  savePrivateNote,
} from "@/lib/supabase/data";
import type { MeetingKind } from "@/lib/types";
import {
  Plus,
  X,
  Check,
  Trash2,
  Users,
  UserRound,
  Lock,
  KanbanSquare,
  Target,
  Loader2,
} from "lucide-react";

const pretty = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export default function MeetingsPage() {
  const { data } = useStore();
  const { user } = useAuth();
  const [tab, setTab] = useState<MeetingKind>("staff");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!user) return null;

  const list = data.meetings
    .filter((m) => m.kind === tab)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const open = data.meetings.find((m) => m.id === openId) ?? list[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Meetings"
        title={tab === "staff" ? "Staff Meetings" : "1-on-1s"}
        subtitle="Agenda, notes, and action items that turn into real tasks."
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus size={16} /> New meeting
          </button>
        }
      />

      <div className="space-y-5 p-4 sm:p-8">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(
            [
              ["staff", "Staff meetings", Users],
              ["one_on_one", "1-on-1s", UserRound],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setOpenId(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                tab === id
                  ? "bg-brand text-white"
                  : "text-ink-soft hover:bg-surface-2"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-bold text-ink">
              No {tab === "staff" ? "staff meetings" : "1-on-1s"} yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
              {tab === "staff"
                ? "Create one and your team can add agenda items all week."
                : "Set one up with someone you lead. Only the two of you can see it."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* List */}
            <div className="card h-fit overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h2 className="font-bold text-ink">Recent</h2>
              </div>
              <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
                {list.map((m) => {
                  const partner = data.members.find(
                    (x) =>
                      x.id === (m.withId === user.id ? m.ownerId : m.withId)
                  );
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setOpenId(m.id)}
                        className={`w-full px-5 py-3 text-left transition ${
                          open?.id === m.id ? "bg-brand-soft" : "hover:bg-surface-2"
                        }`}
                      >
                        <div className="truncate text-sm font-semibold text-ink">
                          {m.title}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {pretty(m.date)}
                          {m.kind === "one_on_one" && partner
                            ? ` · with ${partner.name.split(" ")[0]}`
                            : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Detail */}
            <div className="lg:col-span-2">
              {open && <MeetingDetail key={open.id} meetingId={open.id} />}
            </div>
          </div>
        )}
      </div>

      {creating && (
        <NewMeetingModal
          kind={tab}
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      )}
    </>
  );
}

function MeetingDetail({ meetingId }: { meetingId: string }) {
  const {
    data,
    setMeetingNotes,
    addAgendaItem,
    setAgendaDiscussed,
    deleteAgendaItem,
    addActionItem,
    setActionDone,
    deleteActionItem,
    deleteMeeting,
    addGoal,
    setGoalStatus,
  } = useStore();
  const { user } = useAuth();

  const m = data.meetings.find((x) => x.id === meetingId);
  const [agenda, setAgenda] = useState("");
  const [action, setAction] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState(m?.notes ?? "");
  const [priv, setPriv] = useState("");
  const [privLoaded, setPrivLoaded] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [pushing, setPushing] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return setPrivLoaded(true);
    loadPrivateNote(sb, meetingId)
      .then((b) => setPriv(b))
      .finally(() => setPrivLoaded(true));
  }, [meetingId]);

  if (!m || !user) return null;

  const items = data.agendaItems.filter((a) => a.meetingId === m.id);
  const actions = data.actionItems.filter((a) => a.meetingId === m.id);
  const partner = data.members.find(
    (x) => x.id === (m.withId === user.id ? m.ownerId : m.withId)
  );
  const goals = partner
    ? data.goals.filter((g) => g.memberId === partner.id && g.status === "active")
    : [];

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand sm:text-sm";

  const saveNotes = (v: string) => {
    setNotes(v);
    setMeetingNotes(m.id, v);
  };

  const savePriv = async (v: string) => {
    setPriv(v);
    const sb = getSupabase();
    if (sb) await savePrivateNote(sb, m.id, user.id, v);
  };

  const pushToBoard = async (id: string) => {
    const sb = getSupabase();
    if (!sb) return;
    setPushing(id);
    await actionToTask(sb, id);
    setPushing(null);
  };

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{m.title}</h2>
            <p className="text-sm text-ink-soft">
              {pretty(m.date)}
              {partner ? ` · with ${partner.name}` : ""}
            </p>
          </div>
          {m.ownerId === user.id && (
            <button
              onClick={() => {
                if (confirm(`Delete "${m.title}"?`)) deleteMeeting(m.id);
              }}
              className="rounded-lg p-2 text-ink-soft hover:bg-red-50 hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Agenda */}
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
          Agenda
        </p>
        {items.length === 0 && (
          <p className="mb-2 text-sm text-ink-soft">
            Nothing yet — add talking points any time before the meeting.
          </p>
        )}
        <ul className="mb-3 space-y-1.5">
          {items.map((a) => {
            const by = data.members.find((x) => x.id === a.addedById);
            return (
              <li key={a.id} className="flex items-start gap-2.5">
                <button
                  onClick={() => setAgendaDiscussed(a.id, !a.discussed)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                    a.discussed
                      ? "border-brand bg-brand text-white"
                      : "border-line hover:border-brand"
                  }`}
                >
                  {a.discussed && <Check size={11} strokeWidth={3} />}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    a.discussed ? "text-ink-soft line-through" : "text-ink"
                  }`}
                >
                  {a.text}
                  {by && (
                    <span className="ml-1.5 text-xs text-ink-soft">
                      — {by.name.split(" ")[0]}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => deleteAgendaItem(a.id)}
                  className="rounded p-1 text-ink-soft/50 hover:text-danger"
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <input
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addAgendaItem(m.id, agenda, user.id);
                setAgenda("");
              }
            }}
            placeholder="Add a talking point…"
            className={field}
          />
          <button
            onClick={() => {
              addAgendaItem(m.id, agenda, user.id);
              setAgenda("");
            }}
            disabled={!agenda.trim()}
            className="rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
          Shared notes
        </p>
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          rows={4}
          placeholder="What was discussed…"
          className={`${field} resize-none`}
        />

        {m.kind === "one_on_one" && (
          <>
            <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
              <Lock size={12} /> Private notes — only you can read these
            </p>
            <textarea
              value={priv}
              onChange={(e) => savePriv(e.target.value)}
              disabled={!privLoaded}
              rows={3}
              placeholder="Your own observations…"
              className={`${field} resize-none bg-surface-2`}
            />
          </>
        )}
      </div>

      {/* Action items */}
      <div className="card p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
          Action items
        </p>
        {actions.length === 0 && (
          <p className="mb-2 text-sm text-ink-soft">
            Nothing assigned yet.
          </p>
        )}
        <ul className="mb-3 space-y-2">
          {actions.map((a) => {
            const who = data.members.find((x) => x.id === a.assigneeId);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setActionDone(a.id, !a.done)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                    a.done
                      ? "border-brand bg-brand text-white"
                      : "border-line hover:border-brand"
                  }`}
                >
                  {a.done && <Check size={11} strokeWidth={3} />}
                </button>
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    a.done ? "text-ink-soft line-through" : "text-ink"
                  }`}
                >
                  {a.text}
                </span>
                {who && <Avatar member={who} size={22} />}
                <button
                  onClick={() => pushToBoard(a.id)}
                  disabled={pushing === a.id}
                  title="Add to the production board"
                  className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-surface-2"
                >
                  {pushing === a.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <KanbanSquare size={12} />
                  )}
                  Task
                </button>
                <button
                  onClick={() => deleteActionItem(a.id)}
                  className="rounded p-1 text-ink-soft/50 hover:text-danger"
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Who's doing what…"
            className={`${field} min-w-[12rem] flex-1`}
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={`${field} max-w-[10rem]`}
          >
            <option value="">Assign…</option>
            {data.members.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!action.trim()) return;
              addActionItem({
                meetingId: m.id,
                text: action.trim(),
                assigneeId: assignee || undefined,
              });
              setAction("");
              setAssignee("");
            }}
            disabled={!action.trim()}
            className="rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Goals (1-on-1 only) */}
      {m.kind === "one_on_one" && partner && (
        <div className="card p-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Target size={12} /> {partner.name.split(" ")[0]}&apos;s goals
          </p>
          <ul className="mb-3 space-y-1.5">
            {goals.length === 0 && (
              <p className="text-sm text-ink-soft">No active goals.</p>
            )}
            {goals.map((g) => (
              <li key={g.id} className="flex items-center gap-2.5">
                <button
                  onClick={() => setGoalStatus(g.id, "done")}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line hover:border-brand"
                  title="Mark achieved"
                />
                <span className="flex-1 text-sm text-ink">{g.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && goalText.trim()) {
                  addGoal(partner.id, goalText);
                  setGoalText("");
                }
              }}
              placeholder="Add a goal…"
              className={field}
            />
            <button
              onClick={() => {
                if (!goalText.trim()) return;
                addGoal(partner.id, goalText);
                setGoalText("");
              }}
              disabled={!goalText.trim()}
              className="rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewMeetingModal({
  kind,
  onClose,
  onCreated,
}: {
  kind: MeetingKind;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data, addMeeting } = useStore();
  const { user } = useAuth();
  const [title, setTitle] = useState(
    kind === "staff" ? "Weekly Staff Meeting" : ""
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [withId, setWithId] = useState("");

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand sm:text-sm";

  const others = data.members.filter((m) => m.id !== user?.id);
  const partner = data.members.find((m) => m.id === withId);
  const canCreate =
    kind === "staff" ? title.trim() !== "" : withId !== "";

  const create = () => {
    if (!user || !canCreate) return;
    addMeeting({
      kind,
      title:
        title.trim() ||
        (partner ? `${user.name.split(" ")[0]} ↔ ${partner.name.split(" ")[0]}` : "1-on-1"),
      date,
      ownerId: user.id,
      withId: kind === "one_on_one" ? withId : undefined,
    });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">
            {kind === "staff" ? "New staff meeting" : "New 1-on-1"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {kind === "one_on_one" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                With
              </label>
              <select
                value={withId}
                onChange={(e) => setWithId(e.target.value)}
                className={field}
              >
                <option value="">Choose someone…</option>
                {others.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Title {kind === "one_on_one" && "(optional)"}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === "staff" ? "Weekly Staff Meeting" : "Auto-named"
              }
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </div>

          {kind === "one_on_one" && (
            <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-soft">
              <Lock size={13} className="mt-0.5 shrink-0" />
              Only you and this person can see this meeting — not even church
              admins.
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!canCreate}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
