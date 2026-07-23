"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import {
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  type Role,
  type Permission,
} from "@/lib/types";
import { Check, Minus, RotateCcw } from "lucide-react";

const ROLES: Role[] = ["admin", "pastor", "lead", "volunteer"];

const PERM_LABEL: Record<Permission, string> = {
  manage_users: "Manage users & roles",
  post_announcement: "Post announcements",
  manage_schedule: "Manage production schedule",
  manage_events: "Plan & manage events",
  manage_channels: "Create teams / departments",
  view_admin: "Access admin area",
};

const ALL_PERMS = Object.keys(PERM_LABEL) as Permission[];

export default function AdminPage() {
  const { user, can } = useAuth();
  const { data, setMemberRole, setMemberDepartment, approveMember, reset } =
    useStore();
  const pending = data.members.filter((m) => m.approved === false);
  const router = useRouter();

  useEffect(() => {
    if (user && !can("view_admin")) router.replace("/dashboard");
  }, [user, can, router]);

  if (!user || !can("view_admin")) return null;
  const canManage = can("manage_users");

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Roles & Permissions"
        subtitle="Control who can do what across the workspace."
        action={
          <button
            onClick={() => {
              if (confirm("Reset all demo data to defaults?")) reset();
            }}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            <RotateCcw size={15} /> Reset demo
          </button>
        }
      />

      <div className="space-y-8 p-5 sm:p-8">
        {/* Pending approvals */}
        {pending.length > 0 && (
          <section className="card overflow-hidden ring-2 ring-amber-200">
            <div className="border-b border-line bg-amber-50 px-5 py-3.5">
              <h2 className="font-bold text-ink">
                Pending approvals ({pending.length})
              </h2>
              <p className="text-xs text-ink-soft">
                New sign-ups waiting for you to let them in.
              </p>
            </div>
            <ul className="divide-y divide-line">
              {pending.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar member={m} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {m.name}
                    </div>
                    <div className="truncate text-xs text-ink-soft">
                      {m.email}
                    </div>
                  </div>
                  <button
                    onClick={() => approveMember(m.id, true)}
                    className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Member roles */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Team members</h2>
            <p className="text-xs text-ink-soft">
              {canManage
                ? "Set each person's department and role. Pick “+ Add new department” to create one."
                : "You can view roles. Only Admins can change them."}
            </p>
          </div>
          <ul className="divide-y divide-line">
            {data.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <Avatar member={m} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {m.name}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {m.title ?? m.role} · {m.department}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <DepartmentSelect
                      value={m.department}
                      onChange={(dept) => setMemberDepartment(m.id, dept)}
                      className="w-40 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand"
                    />
                    <select
                      value={m.role}
                      onChange={(e) =>
                        setMemberRole(m.id, e.target.value as Role)
                      }
                      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-ink-soft">
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Permission matrix */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Permission matrix</h2>
            <p className="text-xs text-ink-soft">
              What each role can do. This is the source of truth for access.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-5 py-3 font-semibold text-ink-soft">
                    Permission
                  </th>
                  {ROLES.map((r) => (
                    <th
                      key={r}
                      className="px-4 py-3 text-center font-semibold text-ink"
                    >
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMS.map((perm) => (
                  <tr key={perm} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-ink">{PERM_LABEL[perm]}</td>
                    {ROLES.map((r) => {
                      const has = ROLE_PERMISSIONS[r].includes(perm);
                      return (
                        <td key={r} className="px-4 py-3 text-center">
                          {has ? (
                            <Check
                              size={17}
                              className="mx-auto text-ok"
                              strokeWidth={3}
                            />
                          ) : (
                            <Minus
                              size={16}
                              className="mx-auto text-line"
                              strokeWidth={3}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
