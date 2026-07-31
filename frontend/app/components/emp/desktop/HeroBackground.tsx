"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/app/utils/cn";

/** Configurable local-time → scenic image mapping (24h clock, end exclusive). */
export const HERO_TIME_RANGES = [
  {
    id: "sunrise",
    src: "/img/sunrise.png",
    start: "05:00",
    end: "08:00",
    period: "morning",
    tint: "rgba(255, 140, 60, 0.22)",
  },
  {
    id: "daytime",
    src: "/img/daytime.png",
    start: "08:00",
    end: "16:30",
    period: "afternoon",
    tint: "rgba(56, 120, 200, 0.2)",
  },
  {
    id: "sunset",
    src: "/img/sunset.png",
    start: "16:30",
    end: "18:45",
    period: "evening",
    tint: "rgba(255, 120, 50, 0.24)",
  },
  {
    id: "moonrise",
    src: "/img/moonrise.png",
    start: "18:45",
    end: "24:00",
    period: "night",
    tint: "rgba(20, 40, 90, 0.32)",
  },
  {
    id: "moonset",
    src: "/img/moonset.png",
    start: "00:00",
    end: "05:00",
    period: "night",
    tint: "rgba(16, 32, 72, 0.34)",
  },
] as const;

export type HeroSceneId = (typeof HERO_TIME_RANGES)[number]["id"];
export type HeroSceneSrc = (typeof HERO_TIME_RANGES)[number]["src"];
export type HeroPeriod = (typeof HERO_TIME_RANGES)[number]["period"];

const FADE_MS = 600;
const KEN_BURNS_MS = 30_000;

function parseClockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function resolveHeroScene(date: Date = new Date()) {
  const minutes = minutesOfDay(date);
  for (const range of HERO_TIME_RANGES) {
    const start = parseClockToMinutes(range.start);
    const end = parseClockToMinutes(range.end);
    if (minutes >= start && minutes < end) return range;
  }
  return HERO_TIME_RANGES[0];
}

function msUntilNextRangeChange(date: Date = new Date()): number {
  const minutes = minutesOfDay(date);
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();
  const boundaries = HERO_TIME_RANGES.map((r) => parseClockToMinutes(r.start)).sort(
    (a, b) => a - b,
  );
  let nextBoundary = boundaries.find((b) => b > minutes);
  let minutesUntil: number;
  if (nextBoundary == null) {
    nextBoundary = boundaries[0];
    minutesUntil = 24 * 60 - minutes + nextBoundary;
  } else {
    minutesUntil = nextBoundary - minutes;
  }
  return Math.max(1000, minutesUntil * 60_000 - seconds * 1000 - ms);
}

function preloadHeroImages() {
  for (const range of HERO_TIME_RANGES) {
    const img = new Image();
    img.src = range.src;
  }
}

/**
 * Full-bleed scenic hero banner driven by local system time.
 * Includes Ken Burns zoom + period color tint. Text overlays sit above this layer.
 */
export function HeroBackground({ className }: { className?: string }) {
  const initial = resolveHeroScene();
  const [currentSrc, setCurrentSrc] = useState<HeroSceneSrc>(() => initial.src);
  const [currentTint, setCurrentTint] = useState(initial.tint);
  const [outgoingSrc, setOutgoingSrc] = useState<HeroSceneSrc | null>(null);
  const [outgoingTint, setOutgoingTint] = useState<string | null>(null);
  const [outgoingVisible, setOutgoingVisible] = useState(false);
  const [kenBurnsKey, setKenBurnsKey] = useState(0);
  const fadeTimerRef = useRef<number | null>(null);
  const scheduleRef = useRef<number | null>(null);
  const tintRef = useRef(initial.tint);

  const applyScene = useCallback((scene: (typeof HERO_TIME_RANGES)[number]) => {
    setCurrentSrc((prev) => {
      if (prev === scene.src) {
        tintRef.current = scene.tint;
        setCurrentTint(scene.tint);
        return prev;
      }
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setOutgoingSrc(prev);
      setOutgoingTint(tintRef.current);
      setOutgoingVisible(true);
      tintRef.current = scene.tint;
      setCurrentTint(scene.tint);
      setKenBurnsKey((k) => k + 1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOutgoingVisible(false));
      });
      fadeTimerRef.current = window.setTimeout(() => {
        setOutgoingSrc(null);
        setOutgoingTint(null);
        fadeTimerRef.current = null;
      }, FADE_MS);
      return scene.src;
    });
  }, []);

  const syncFromClock = useCallback(() => {
    applyScene(resolveHeroScene());
  }, [applyScene]);

  useEffect(() => {
    preloadHeroImages();
    syncFromClock();

    const scheduleNext = () => {
      if (scheduleRef.current != null) window.clearTimeout(scheduleRef.current);
      scheduleRef.current = window.setTimeout(() => {
        syncFromClock();
        scheduleNext();
      }, msUntilNextRangeChange());
    };

    scheduleNext();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFromClock();
        scheduleNext();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (scheduleRef.current != null) window.clearTimeout(scheduleRef.current);
      if (fadeTimerRef.current != null) window.clearTimeout(fadeTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncFromClock]);

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      aria-hidden
    >
      <div key={kenBurnsKey} className="emp-hero-kenburns absolute inset-0">
        <img
          src={currentSrc}
          alt=""
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
      </div>

      {outgoingSrc ? (
        <img
          src={outgoingSrc}
          alt=""
          className={cn(
            "absolute inset-0 z-[1] size-full object-cover transition-opacity ease-in-out",
            outgoingVisible ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDuration: `${FADE_MS}ms` }}
          draggable={false}
        />
      ) : null}

      {/* Period color wash — fades with the scene */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] transition-colors ease-in-out"
        style={{
          backgroundColor: currentTint,
          transitionDuration: `${FADE_MS}ms`,
        }}
      />
      {outgoingTint ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[2] transition-opacity ease-in-out",
            outgoingVisible ? "opacity-100" : "opacity-0",
          )}
          style={{
            backgroundColor: outgoingTint,
            transitionDuration: `${FADE_MS}ms`,
          }}
        />
      ) : null}

      {/* Left readability gradient (~35%) */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 35%, transparent 55%)",
        }}
      />

      <style>{`
        @keyframes emp-hero-kenburns {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .emp-hero-kenburns {
          animation: emp-hero-kenburns ${KEN_BURNS_MS}ms ease-in-out infinite;
          transform-origin: center center;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .emp-hero-kenburns {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const PERIOD_GREETING: Record<HeroPeriod, string> = {
  morning: "Good Morning,",
  afternoon: "Good Afternoon,",
  evening: "Good Evening,",
  night: "Good Night,",
};

function firstNameFrom(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function useHeroCopy(empFullName: string) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sync = () => setNow(new Date());
    sync();
    const id = window.setTimeout(sync, msUntilNextRangeChange());
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const poll = window.setInterval(sync, 60_000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return useMemo(() => {
    const period = resolveHeroScene(now).period;
    const first = firstNameFrom(empFullName);
    return {
      greeting: PERIOD_GREETING[period],
      headline: `Welcome back, ${first}.`,
      period,
    };
  }, [empFullName, now]);
}
