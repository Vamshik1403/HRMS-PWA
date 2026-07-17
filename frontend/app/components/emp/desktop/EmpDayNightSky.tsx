"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/app/utils/cn";

type Celestial = {
  visible: boolean;
  x: number;
  y: number;
  opacity: number;
  scale: number;
};

function hoursDecimal(now: Date) {
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

function sunPosition(h: number): Celestial {
  if (h < 5 || h >= 19) {
    return { visible: false, x: 0, y: 0, opacity: 0, scale: 1 };
  }

  const progress = (h - 5) / 14;
  const x = 8 + progress * 84;
  const y = 72 - Math.sin(progress * Math.PI) * 58;

  let opacity = 1;
  if (h < 6) opacity = h - 5;
  else if (h > 18) opacity = 19 - h;

  const scale = 0.85 + Math.sin(progress * Math.PI) * 0.2;

  return { visible: true, x, y, opacity: Math.max(0, Math.min(1, opacity)), scale };
}

function moonPosition(h: number): Celestial {
  if (h >= 5 && h < 19) {
    return { visible: false, x: 0, y: 0, opacity: 0, scale: 1 };
  }

  const nightHours = h >= 19 ? h - 19 : h + 5;
  const progress = nightHours / 10;
  const x = 88 - progress * 78;
  const y = 74 - Math.sin(progress * Math.PI) * 52;

  let opacity = 1;
  if (h >= 19 && h < 20) opacity = h - 19;
  else if (h >= 4 && h < 5) opacity = 5 - h;

  return { visible: true, x, y, opacity: Math.max(0, Math.min(1, opacity)), scale: 0.9 };
}

function skyTone(h: number) {
  if (h >= 5 && h < 7) {
    return "from-[#7eb8f7] via-[#a8d4ff] to-[#ffe8c8]";
  }
  if (h >= 7 && h < 17) {
    return "from-[#5ba3f5] via-[#8ec8ff] to-[#d4ebff]";
  }
  if (h >= 17 && h < 19) {
    return "from-[#f59a5a] via-[#f7b88a] to-[#6b8fd4]";
  }
  return "from-[#0f172a] via-[#1e293b] to-[#334155]";
}

export function EmpDayNightSky({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const h = hoursDecimal(now);
  const sun = useMemo(() => sunPosition(h), [h]);
  const moon = useMemo(() => moonPosition(h), [h]);
  const isNight = h < 5 || h >= 19;

  return (
    <div
      className={cn(
        "relative h-[4.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-2xl border border-border/50 shadow-inner",
        className,
      )}
      aria-hidden
    >
      <div className={cn("absolute inset-0 bg-gradient-to-b transition-colors duration-[3s]", skyTone(h))} />

      {/* Horizon haze */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-1/2",
          isNight ? "bg-gradient-to-t from-slate-900/50 to-transparent" : "bg-gradient-to-t from-white/25 to-transparent",
        )}
      />

      {/* Clouds */}
      <div
        className={cn(
          "absolute left-[8%] top-[58%] h-3 w-8 rounded-full opacity-90",
          isNight ? "bg-slate-600/70" : "bg-white/90",
          "animate-[cloud-drift_14s_ease-in-out_infinite]",
        )}
      />
      <div
        className={cn(
          "absolute left-[18%] top-[52%] h-2.5 w-6 rounded-full opacity-80",
          isNight ? "bg-slate-500/60" : "bg-white/80",
          "animate-[cloud-drift_18s_ease-in-out_infinite_reverse]",
        )}
      />
      <div
        className={cn(
          "absolute right-[12%] top-[60%] h-3.5 w-9 rounded-full opacity-85",
          isNight ? "bg-slate-600/65" : "bg-white/85",
          "animate-[cloud-drift_16s_ease-in-out_infinite]",
        )}
      />
      <div
        className={cn(
          "absolute left-[42%] top-[64%] h-2 w-7 rounded-full opacity-75",
          isNight ? "bg-slate-500/55" : "bg-white/75",
          "animate-[cloud-drift_20s_ease-in-out_infinite_reverse]",
        )}
      />

      {/* Sun */}
      {sun.visible ? (
        <div
          className="absolute transition-all duration-[30s] ease-linear"
          style={{
            left: `${sun.x}%`,
            top: `${sun.y}%`,
            opacity: sun.opacity,
            transform: `translate(-50%, -50%) scale(${sun.scale})`,
          }}
        >
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-amber-300/35 blur-sm" />
            <div className="size-5 rounded-full bg-gradient-to-br from-amber-200 to-orange-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
          </div>
        </div>
      ) : null}

      {/* Moon */}
      {moon.visible ? (
        <div
          className="absolute transition-all duration-[30s] ease-linear"
          style={{
            left: `${moon.x}%`,
            top: `${moon.y}%`,
            opacity: moon.opacity,
            transform: `translate(-50%, -50%) scale(${moon.scale})`,
          }}
        >
          <div className="relative size-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 shadow-[0_0_8px_rgba(226,232,240,0.5)]" />
            <div className="absolute left-1 top-1 size-1 rounded-full bg-slate-400/40" />
            <div className="absolute right-0.5 bottom-1 size-0.5 rounded-full bg-slate-400/35" />
          </div>
        </div>
      ) : null}

      {/* Stars at night */}
      {isNight ? (
        <>
          <div className="absolute left-[15%] top-[18%] size-0.5 rounded-full bg-white/80" />
          <div className="absolute left-[35%] top-[28%] size-0.5 rounded-full bg-white/60" />
          <div className="absolute left-[55%] top-[12%] size-0.5 rounded-full bg-white/70" />
          <div className="absolute left-[72%] top-[22%] size-0.5 rounded-full bg-white/50" />
          <div className="absolute left-[82%] top-[35%] size-0.5 rounded-full bg-white/65" />
        </>
      ) : null}
    </div>
  );
}
