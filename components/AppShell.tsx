"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessagesSquare,
  KanbanSquare,
  Users,
  Shield,
  BarChart3,
  Building2,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  NotebookPen,
  Briefcase,
  FlaskConical,
  Award,
  BookOpen,
  Mail,
  MessageSquareText,
  FolderSync,
  CloudCog,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import { Logo } from "./Logo";
import { Avatar, RoleBadge } from "./Avatar";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";

type Item = { href: string; label: string; icon: typeof Users };

const DASHBOARD: Item = {
  href: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
};

const SOON_NAV = [
  { label: "OneDrive Files", icon: CloudCog },
  { label: "Team Email", icon: Mail },
  { label: "SMS Reminders", icon: MessageSquareText },
];

const NAV_KEY = "hillcrest-hub:nav-collapsed:v1";
// Tidier by default: these two start collapsed.
const DEFAULT_COLLAPSED: Record<string, boolean> = {
  Integrations: true,
  "Coming soon": true,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, can, previewRole, setPreview } = useAuth();
  const { data } = useStore();
  const churchName = data.org?.name ?? "Hillcrest Hub";
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] =
    useState<Record<string, boolean>>(DEFAULT_COLLAPSED);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(NAV_KEY) || "null");
      if (saved) setCollapsed(saved);
    } catch {
      /* ignore */
    }
  }, []);

  if (!user) return null;

  // The menu is built per role, so a volunteer never wades through tools
  // meant for staff.
  const isLead = can("manage_schedule");
  const isStaff = can("view_staff");

  const groups: { label: string; items: Item[] }[] = [];

  // Everyone: what am I doing, and where do I talk?
  groups.push({
    label: "My Serving",
    items: [
      { href: "/my-sunday", label: "My Sunday", icon: CalendarCheck },
      { href: "/serving", label: "My Availability", icon: CalendarDays },
      { href: "/calendar", label: "Calendar", icon: CalendarRange },
    ],
  });

  groups.push({
    label: "Community",
    items: [
      { href: "/chat", label: "Chat & Announcements", icon: MessagesSquare },
      { href: "/kudos", label: "Kudos", icon: Award },
      { href: "/team", label: "Team Directory", icon: Users },
      { href: "/resources", label: "Resources", icon: BookOpen },
    ],
  });

  // Team Leads run their department.
  if (isLead) {
    groups.push({
      label: "Lead My Team",
      items: [
        { href: "/roster", label: "Roster Builder", icon: ClipboardList },
        { href: "/schedule", label: "Production Schedule", icon: KanbanSquare },
        { href: "/events", label: "Events", icon: CalendarRange },
      ],
    });
  }

  // Staff get their own workspace.
  if (isStaff) {
    const staffItems: Item[] = [
      { href: "/staff", label: "Staff Hub", icon: Briefcase },
      { href: "/meetings", label: "Meetings & 1-on-1s", icon: NotebookPen },
    ];
    if (isLead)
      staffItems.push({
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
      });
    staffItems.push({
      href: "/planning-center",
      label: "Planning Center",
      icon: FolderSync,
    });
    groups.push({ label: "Staff", items: staffItems });
  }

  if (can("view_admin"))
    groups.push({
      label: "Church Admin",
      items: [{ href: "/admin", label: "Admin", icon: Shield }],
    });

  // Internal platform team only — never shown to churches.
  if (user.platformAdmin)
    groups.push({
      label: "Platform",
      items: [
        { href: "/app-admin", label: "App Admin", icon: Building2 },
        { href: "/demo", label: "Demo Mode", icon: FlaskConical },
      ],
    });

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const toggleGroup = (label: string) =>
    setCollapsed((c) => {
      const next = { ...c, [label]: !c[label] };
      try {
        window.localStorage.setItem(NAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const NavLink = ({ href, label, icon: Icon }: Item) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        isActive(href)
          ? "bg-brand text-white shadow-sm"
          : "text-ink-soft hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );

  const Group = ({
    label,
    children,
    hasActive,
  }: {
    label: string;
    children: React.ReactNode;
    hasActive: boolean;
  }) => {
    const openGroup = hasActive || !collapsed[label];
    return (
      <div>
        <button
          onClick={() => toggleGroup(label)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-soft/70 transition hover:text-ink-soft"
        >
          {label}
          <ChevronDown
            size={13}
            className={`transition-transform ${openGroup ? "" : "-rotate-90"}`}
          />
        </button>
        {openGroup && <div className="mt-0.5 space-y-0.5">{children}</div>}
      </div>
    );
  };

  const SidebarInner = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5 px-5 py-5">
        <div className="hh-gradient flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm shadow-brand/30">
          <Logo className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className="hh-gradient-text truncate text-[15px] font-bold"
            title={churchName}
          >
            {churchName}
          </div>
          <div className="text-[11px] text-ink-soft">Team Workspace</div>
        </div>
        <GlobalSearch />
        <NotificationBell />
      </div>

      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          <NavLink {...DASHBOARD} />
        </div>

        {groups.map((g) => (
          <Group
            key={g.label}
            label={g.label}
            hasActive={g.items.some((i) => isActive(i.href))}
          >
            {g.items.map((i) => (
              <NavLink key={i.href} {...i} />
            ))}
          </Group>
        ))}

        <Group label="Coming soon" hasActive={false}>
          {SOON_NAV.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft/50"
              title="Planned for a later phase"
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink-soft/60">
                Soon
              </span>
            </div>
          ))}
        </Group>
      </nav>

      {/* User → tap to open your profile */}
      <div className="shrink-0 border-t border-line p-3">
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
          <ThemeToggle />
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
            <div className="hh-gradient flex h-7 w-7 items-center justify-center rounded-md text-white">
              <Logo className="h-4 w-4" />
            </div>
            <span className="hh-gradient-text truncate font-bold">
              {churchName}
            </span>
          </div>
          <div className="ml-auto flex items-center">
            <GlobalSearch />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {previewRole && (
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900">
            <FlaskConical size={15} className="shrink-0" />
            <span className="min-w-0 flex-1">
              Previewing as <b>{ROLE_LABEL[previewRole]}</b> — menus and pages
              reflect this role.
            </span>
            <button
              onClick={() => setPreview(null)}
              className="shrink-0 rounded-lg bg-amber-200 px-2.5 py-1 text-xs font-bold hover:bg-amber-300"
            >
              Exit preview
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
