"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, RoleBadge } from "@/components/Avatar";
import { getSupabase } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/data";
import { Camera, Check, Loader2, Mail, Lock } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { updateProfile } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [title, setTitle] = useState(user?.title ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sb = getSupabase();
    if (!sb) {
      setError("Photo upload needs Supabase (it's on in production).");
      return;
    }
    setUploading(true);
    setError(null);
    const res = await uploadAvatar(sb, user.id, file);
    setUploading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setAvatarUrl(res.url);
    updateProfile(user.id, { avatarUrl: res.url });
  };

  const save = () => {
    updateProfile(user.id, {
      name: name.trim() || user.name,
      username: username.trim() || undefined,
      title: title.trim() || undefined,
      phone: phone.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="My Profile"
        subtitle="Update how you show up to the rest of the team."
      />

      <div className="mx-auto max-w-2xl space-y-6 p-5 sm:p-8">
        {/* Header card */}
        <div className="card flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar member={{ ...user, avatarUrl }} size={88} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-brand text-white shadow hover:bg-brand-dark disabled:opacity-60"
              title="Change photo"
            >
              {uploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Camera size={15} />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />
          </div>
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-bold text-ink">{user.name}</h2>
              <RoleBadge role={user.role} />
            </div>
            {username && (
              <p className="text-sm text-ink-soft">@{username}</p>
            )}
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-soft sm:justify-start">
              <Mail size={13} /> {user.email}
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Edit form */}
        <div className="card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Full name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. malachi"
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Title / role
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Videographer"
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Department
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink-soft">
                <Lock size={13} />
                {user.department || "Unassigned"}
                <span className="ml-auto text-xs">set by an admin</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 555 0101"
                className={field}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A sentence or two about you and what you serve in."
              className={`${field} resize-none`}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-sm font-medium text-ok">
                <Check size={15} /> Saved
              </span>
            )}
            <button
              onClick={save}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
