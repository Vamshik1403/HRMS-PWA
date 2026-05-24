"use client";

import { TIMEZONE_OPTIONS } from "@/app/utils/timezoneOptions";

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimezoneSelect({ value, onChange, className }: TimezoneSelectProps) {
  return (
    <select
      className={className ?? "w-full rounded-md border px-3 py-2"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">-- Select Time Zone --</option>
      {TIMEZONE_OPTIONS.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
    </select>
  );
}
