import { initials } from "@/lib/format";
import type { Member, Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";

export function Avatar({
  member,
  size = 36,
}: {
  member: Pick<Member, "name" | "avatarColor">;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: member.avatarColor,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {initials(member.name)}
    </span>
  );
}

const ROLE_STYLE: Record<Role, string> = {
  admin: "bg-brand-soft text-brand-dark",
  pastor: "bg-violet-100 text-violet-700",
  lead: "bg-amber-100 text-amber-700",
  volunteer: "bg-slate-100 text-slate-600",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${ROLE_STYLE[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
