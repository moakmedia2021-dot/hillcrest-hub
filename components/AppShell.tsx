"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  MessagesSquare,
  KanbanSquare,
  Users,
  Shield,
  CalendarRange,
  CalendarDays,
  BookOpen,
  Mail,
  MessageSquareText,
  FolderSync,
  CloudCog,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar, RoleBadge } from "./Avatar";
import { NotificationBell } from "./NotificationBell";

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat & Announcements", icon: MessagesSquare },
  { href: "/schedule", label: "Production Schedule", icon: KanbanSquare },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/planning-center", label: "Planning Center", icon: FolderSync },
  { href: "/team", label: "Team Directory", icon: Users },
];

const SOON_NAV = [
  { label: "OneDrive Files", icon: CloudCog },
  { label: "Team Email", icon: Mail },
  { label: "SMS Reminders", icon: MessageSquareText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const nav = [...MAIN_NAV];
  if (can("view_admin")) nav.push({ href: "/admin", label: "Admin", icon: Shield });

  const SidebarInner = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white font-bold">
          H
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[15px] font-bold text-ink">Hillcrest Hub</div>
          <div className="text-[11px] text-ink-soft">Team Workspace</div>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        <div className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-widest text-ink-soft/70">
          Coming soon
        </div>
        {SOON_NAV.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft/50"
            title="Planned for a later phase"
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink-soft/60">
              Soon
            </span>
          </div>
        ))}
      </nav>

      {/* User → tap to open your profile */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2"
            title="View your profile"
          >
            <Avatar member={user} size={38} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">
                {user.name}
              </div>
              <div className="mt-0.5">
                <RoleBadge role={user.role} />
              </div>
            </div>
          </Link>
          <button
            onClick={() => {
              signOut();
              router.push("/");
            }}
            className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-danger"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface md:block">
        <div className="sticky top-0 h-screen">{SidebarInner}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-line bg-surface shadow-xl">
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-ink hover:bg-surface-2"
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
              H
            </div>
            <span className="font-bold text-ink">Hillcrest Hub</span>
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
