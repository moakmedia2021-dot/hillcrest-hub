"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { allDepartments } from "@/lib/departments";

// A department dropdown with an inline "Add new…" option so admins can create
// new ministries on the spot. `className` lets callers match surrounding inputs.
export function DepartmentSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (dept: string) => void;
  className?: string;
}) {
  const { data } = useStore();
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState("");

  const options = allDepartments(data.members);
  const cls =
    className ??
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && fresh.trim()) {
              onChange(fresh.trim());
              setAdding(false);
            }
          }}
          placeholder="New department"
          className={cls}
        />
        <button
          onClick={() => {
            if (fresh.trim()) onChange(fresh.trim());
            setAdding(false);
          }}
          className="shrink-0 rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Add
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setFresh("");
          setAdding(true);
        } else onChange(e.target.value);
      }}
      className={cls}
    >
      {!options.includes(value) && value && <option value={value}>{value}</option>}
      {options.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      <option value="__new__">+ Add new department…</option>
    </select>
  );
}
