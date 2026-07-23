// Small formatting helpers shared across the app.

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function dueMeta(iso?: string): { label: string; tone: "ok" | "warn" | "danger" | "muted" } {
  if (!iso) return { label: "No due date", tone: "muted" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "danger" };
  if (days === 0) return { label: "Due today", tone: "warn" };
  if (days === 1) return { label: "Due tomorrow", tone: "warn" };
  if (days <= 3) return { label: `Due in ${days}d`, tone: "warn" };
  return { label: shortDate(iso), tone: "ok" };
}
