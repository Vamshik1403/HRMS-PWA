"use client";

import { Icon } from "@iconify/react";

function formatDisplay(value: string) {
  if (!value) return { main: "Select date", sub: "" };
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { main: value, sub: "" };
  return {
    main: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    sub: d.toLocaleDateString("en-IN", { weekday: "short" }),
  };
}

/** Native date picker with mobile-friendly visible display (avoids brown joined native chrome). */
export function EmpMobileDateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const { main, sub } = formatDisplay(value);

  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-semibold text-gray-500 mb-1.5 block">{label}</span>
      <div className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 min-h-[48px] shadow-sm emp-mobile-date-field">
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          aria-label={label}
        />
        <div className="flex-1 min-w-0 pointer-events-none z-0">
          <p className={`text-[14px] font-semibold truncate ${value ? "text-gray-900" : "text-gray-400"}`}>
            {main}
          </p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <Icon
          icon="solar:calendar-bold-duotone"
          className="w-5 h-5 text-[#2563eb] shrink-0 pointer-events-none z-0"
        />
      </div>
    </label>
  );
}
