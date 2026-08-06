"use client";

import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { HeroBackground, useHeroCopy } from "./HeroBackground";

/**
 * Home hero — cinematic scenic banner with a minimal greeting overlay.
 * No avatar, designation, punch controls, or widgets.
 */
export function EmpDesktopHomeProfileHero({
  empFullName,
  empPhoto: _empPhoto,
  empInitials: _empInitials,
  designation: _designation,
  department: _department,
  todayStatus: _todayStatus,
  loadingStatus: _loadingStatus,
  onStatusUpdate: _onStatusUpdate,
}: {
  empFullName: string;
  empPhoto: string | null;
  empInitials: string;
  designation?: string | null;
  department?: string | null;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
}) {
  const { greeting, headline } = useHeroCopy(empFullName);

  return (
    <div className="relative overflow-hidden rounded-xl bg-muted shadow-sm">
      {/* Wide cinematic banner (~210px) */}
      <div className="relative h-[200px] w-full sm:h-[212px]">
        <HeroBackground />

        <div className="relative z-10 flex h-full max-w-xl flex-col justify-start px-6 pt-8 sm:px-8 sm:pt-10">
          <p
            className="m-0 text-white"
            style={{
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.15,
              opacity: 0.9,
              textShadow: "0 2px 8px rgba(0,0,0,.25)",
            }}
          >
            {greeting}
          </p>
          <h1
            className="m-0 mt-1.5 text-white"
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 8px rgba(0,0,0,.25)",
            }}
          >
            {headline}
          </h1>
        </div>
      </div>
    </div>
  );
}
