import type { Member } from "./types";

// Ministries/departments available everywhere. Admins can add more on the fly
// (typing a new one assigns + creates it). These always show as options.
export const DEFAULT_DEPARTMENTS = [
  "Leadership",
  "Creative",
  "Worship",
  "Youth",
  "Kids",
  "Young Adults",
  "Men's Ministry",
  "Women's Ministry",
  "Hospitality",
  "Security",
  "Veterans",
  "Outreach",
];

// The full set of departments = defaults plus any already assigned to people.
export function allDepartments(members: Member[]): string[] {
  const set = new Set(DEFAULT_DEPARTMENTS);
  for (const m of members) if (m.department) set.add(m.department);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
