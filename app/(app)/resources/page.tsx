"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { allDepartments } from "@/lib/departments";
import type { ResourceKind } from "@/lib/types";
import {
  Plus,
  X,
  Link2,
  FileText,
  Video,
  StickyNote,
  File,
  Trash2,
  ExternalLink,
  Globe,
} from "lucide-react";

const KIND_ICON: Record<ResourceKind, typeof Link2> = {
  link: Link2,
  file: File,
  video: Video,
  doc: FileText,
  note: StickyNote,
};

export default function ResourcesPage() {
  const { data, deleteResource } = useStore();
  const { user, can } = useAuth();
  const canManage = can("manage_schedule"); // Team Lead and up
  const seeAll = !!user && user.role !== "volunteer";
  const [adding, setAdding] = useState(false);

  const visible = data.resources.filter(
    (r) => !r.department || seeAll || r.department === user?.department
  );

  // Group: "For everyone" first, then by department.
  const groups: Record<string, typeof visible> = {};
  for (const r of visible) {
    const key = r.department ?? "For everyone";
    (groups[key] ??= []).push(r);
  }
  const orderedKeys = Object.keys(groups).sort((a, b) =>
    a === "For everyone" ? -1 : b === "For everyone" ? 1 : a.localeCompare(b)
  );

  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Resources & Tutorials"
        subtitle="Guides, brand assets, tutorials, and links for your team."
        action={
          canManage && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Plus size={16} /> Add resource
            </button>
          )
        }
      />

      <div className="space-y-8 p-5 sm:p-8">
        {visible.length === 0 && (
          <p className="text-sm text-ink-soft">
            No resources yet.{" "}
            {canManage && "Add the first one for your team."}
          </p>
        )}

        {orderedKeys.map((key) => (
          <section key={key}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              {key === "For everyone" ? <Globe size={14} /> : null}
              {key}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups[key].map((r) => {
                const Icon = KIND_ICON[r.kind];
                const owner = data.members.find((m) => m.id === r.createdById);
                const inner = (
                  <>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                        <Icon size={17} />
                      </div>
                      {r.url && (
                        <ExternalLink
                          size={15}
                          className="mt-1 text-ink-soft/50"
                        />
                      )}
                    </div>
                    <h3 className="font-semibold leading-snug text-ink">
                      {r.title}
                    </h3>
                    {r.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                        {r.description}
                      </p>
                    )}
                    <div className="mt-2 text-[11px] uppercase tracking-wide text-ink-soft/70">
                      {r.kind}
                      {owner && ` · ${owner.name.split(" ")[0]}`}
                    </div>
                  </>
                );
                return (
                  <div key={r.id} className="group relative">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card block p-4 transition hover:border-brand hover:shadow-sm"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className="card p-4">{inner}</div>
                    )}
                    {canManage && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${r.title}"?`)) deleteResource(r.id);
                        }}
                        className="absolute right-2 top-2 rounded-lg bg-surface p-1.5 text-ink-soft opacity-0 shadow-sm transition hover:text-danger group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {adding && <AddResourceModal onClose={() => setAdding(false)} />}
    </>
  );
}

function AddResourceModal({ onClose }: { onClose: () => void }) {
  const { data, addResource } = useStore();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<ResourceKind>("link");
  const [department, setDepartment] = useState("");

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  const submit = () => {
    if (!title.trim()) return;
    addResource({
      title: title.trim(),
      description: description.trim() || undefined,
      url: url.trim() || undefined,
      kind,
      department: department || undefined,
      createdById: user?.id,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Add resource</h2>
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
              placeholder="e.g. Editing Tutorial"
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
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Link (optional)
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Type
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ResourceKind)}
                className={field}
              >
                <option value="link">Link</option>
                <option value="doc">Doc / Guide</option>
                <option value="video">Video / Tutorial</option>
                <option value="file">File / Asset</option>
                <option value="note">Note</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Who can see it
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={field}
              >
                <option value="">Everyone</option>
                {allDepartments(data.members).map((d) => (
                  <option key={d} value={d}>
                    {d} only
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
            Add resource
          </button>
        </div>
      </div>
    </div>
  );
}
