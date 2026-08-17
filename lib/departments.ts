import type { AppData, Member } from "./types";

// Offered during setup and when an admin adds a ministry. These are only
// SUGGESTIONS — each church ends up with its own list in the departments table.
export const DEPARTMENT_SUGGESTIONS = [
  "Leadership",
  "Creative",
  "Worship",
  "Kids",
  "Youth",
  "Young Adults",
  "Hospitality",
  "Security",
  "Outreach",
  "Prayer",
  "Men's Ministry",
  "Women's Ministry",
  "Facilities",
  "Care",
];

// The departments THIS church actually has. Falls back to whatever its people
// are already assigned to, so nothing disappears before setup runs.
export function allDepartments(data: AppData): string[] {
  const set = new Set<string>();
  for (const d of data.departments ?? []) set.add(d.name);
  for (const m of data.members) if (m.department) set.add(m.department);
  for (const c of data.channels) if (c.department) set.add(c.department);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Convenience for the few places that only have members handy.
export function departmentsFromMembers(members: Member[]): string[] {
  const set = new Set<string>();
  for (const m of members) if (m.department) set.add(m.department);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
