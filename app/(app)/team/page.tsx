"use client";

import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, RoleBadge } from "@/components/Avatar";
import { Mail, Phone } from "lucide-react";

export default function TeamPage() {
  const { data } = useStore();

  // Group by department
  const byDept = data.members.reduce<Record<string, typeof data.members>>(
    (acc, m) => {
      (acc[m.department] ??= []).push(m);
      return acc;
    },
    {}
  );

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Team Directory"
        subtitle="Everyone serving across Hillcrest, by department."
      />

      <div className="space-y-8 p-5 sm:p-8">
        {Object.entries(byDept).map(([dept, members]) => (
          <section key={dept}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              {dept}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <div key={m.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar member={m} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink">
                        {m.name}
                      </div>
                      <div className="truncate text-xs text-ink-soft">
                        {m.title}
                      </div>
                    </div>
                    <RoleBadge role={m.role} />
                  </div>
                  <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                    <a
                      href={`mailto:${m.email}`}
                      className="flex items-center gap-2 text-xs text-ink-soft hover:text-brand"
                    >
                      <Mail size={13} /> {m.email}
                    </a>
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="flex items-center gap-2 text-xs text-ink-soft hover:text-brand"
                      >
                        <Phone size={13} /> {m.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
