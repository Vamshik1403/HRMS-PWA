"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/app/utils/cn";

/** Configurable local-time → scenic image mapping (24h clock, end exclusive). */
export const HERO_TIME_RANGES = [
  {
    id: "sunrise",
    src: "/img/sunrise.webp",
    fallbackSrc: "/img/sunrise.jpg",
    start: "05:00",
    end: "08:00",
    period: "morning",
    tint: "rgba(255, 140, 60, 0.22)",
    /** Approximate dominant color while the image downloads */
    placeholder: "#3d2a1f",
  },
  {
    id: "daytime-morning",
    src: "/img/daytime.webp",
    fallbackSrc: "/img/daytime.jpg",
    start: "08:00",
    end: "12:00",
    period: "morning",
    tint: "rgba(56, 120, 200, 0.2)",
    placeholder: "#5b8fc7",
  },
  {
    id: "daytime-afternoon",
    src: "/img/daytime.webp",
    fallbackSrc: "/img/daytime.jpg",
    start: "12:00",
    end: "16:30",
    period: "afternoon",
    tint: "rgba(56, 120, 200, 0.2)",
    placeholder: "#5b8fc7",
  },
  {
    id: "sunset",
    src: "/img/sunset.webp",
    fallbackSrc: "/img/sunset.jpg",
    start: "16:30",
    end: "18:45",
    period: "evening",
    tint: "rgba(255, 120, 50, 0.24)",
    placeholder: "#c45a2a",
  },
  {
    id: "moonrise",
    src: "/img/moonrise.webp",
    fallbackSrc: "/img/moonrise.jpg",
    start: "18:45",
    end: "24:00",
    period: "night",
    tint: "rgba(20, 40, 90, 0.32)",
    placeholder: "#0b1630",
  },
  {
    id: "moonset",
    src: "/img/moonset.webp",
    fallbackSrc: "/img/moonset.jpg",
    start: "00:00",
    end: "05:00",
    period: "night",
    tint: "rgba(16, 32, 72, 0.34)",
    placeholder: "#081022",
  },
] as const;

export type HeroSceneId = (typeof HERO_TIME_RANGES)[number]["id"];
export type HeroSceneSrc = (typeof HERO_TIME_RANGES)[number]["src"];
export type HeroPeriod = (typeof HERO_TIME_RANGES)[number]["period"];
type HeroScene = (typeof HERO_TIME_RANGES)[number];

const FADE_MS = 600;
const KEN_BURNS_MS = 30_000;

function parseClockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function resolveHeroScene(date: Date = new Date()): HeroScene {
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

function ensurePreloadLink(href: string, asType: "image", type?: string) {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(`link[rel="preload"][href="${href}"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = asType;
  link.href = href;
  if (type) link.type = type;
  // Hint browsers that this image is critical for LCP.
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);
}

/** Warm the current period image (and quietly warm the others). Call as early as login. */
export function preloadHeroImages(priorityOnly = false) {
  if (typeof window === "undefined") return;
  const current = resolveHeroScene();
  ensurePreloadLink(current.src, "image", "image/webp");
  const warm = (src: string) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  };
  warm(current.src);
  if (priorityOnly) return;
  for (const range of HERO_TIME_RANGES) {
    if (range.src === current.src) continue;
    warm(range.src);
  }
}

function HeroPicture({
  scene,
  className,
  priority = false,
  onLoad,
}: {
  scene: Pick<HeroScene, "src" | "fallbackSrc">;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
}) {
  return (
    <picture>
      <source srcSet={scene.src} type="image/webp" />
      <img
        src={scene.fallbackSrc}
        alt=""
        className={className}
        draggable={false}
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        onLoad={onLoad}
      />
    </picture>
  );
}

/**
 * Full-bleed scenic hero banner driven by local system time.
 * Includes Ken Burns zoom + period color tint. Text overlays sit above this layer.
 */
export function HeroBackground({ className }: { className?: string }) {
  const initial = resolveHeroScene();
  const [scene, setScene] = useState<HeroScene>(() => initial);
  const [outgoingScene, setOutgoingScene] = useState<HeroScene | null>(null);
  const [outgoingVisible, setOutgoingVisible] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [kenBurnsKey, setKenBurnsKey] = useState(0);
  const fadeTimerRef = useRef<number | null>(null);
  const scheduleRef = useRef<number | null>(null);
  const sceneRef = useRef(initial);

  const applyScene = useCallback((next: HeroScene) => {
    if (sceneRef.current.id === next.id) {
      sceneRef.current = next;
      setScene(next);
      return;
    }
    if (fadeTimerRef.current != null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setOutgoingScene(sceneRef.current);
    setOutgoingVisible(true);
    sceneRef.current = next;
    setScene(next);
    setImageReady(false);
    setKenBurnsKey((k) => k + 1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOutgoingVisible(false));
    });
    fadeTimerRef.current = window.setTimeout(() => {
      setOutgoingScene(null);
      fadeTimerRef.current = null;
    }, FADE_MS);
  }, []);

  const syncFromClock = useCallback(() => {
    applyScene(resolveHeroScene());
  }, [applyScene]);

  useEffect(() => {
    // Priority-load the current period image immediately; warm others in background.
    preloadHeroImages(false);
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
      style={{ backgroundColor: scene.placeholder }}
    >
      <div key={kenBurnsKey} className="emp-hero-kenburns absolute inset-0">
        <HeroPicture
          scene={scene}
          priority
          onLoad={() => setImageReady(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            imageReady ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {outgoingScene ? (
        <div
          className={cn(
            "absolute inset-0 z-[1] transition-opacity ease-in-out",
            outgoingVisible ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        >
          <HeroPicture
            scene={outgoingScene}
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      ) : null}

      {/* Period color wash — fades with the scene */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] transition-colors ease-in-out"
        style={{
          backgroundColor: scene.tint,
          transitionDuration: `${FADE_MS}ms`,
        }}
      />

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

/**
 * Enterprise greeting slots (local time):
 * Morning 05:00–11:59 · Afternoon 12:00–16:59 · Evening 17:00–19:59 · Night otherwise.
 * Matches common workplace apps (Outlook / Slack-style dayparts).
 */
export function resolveGreetingPeriod(date: Date = new Date()): HeroPeriod {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

function msUntilNextGreetingChange(date: Date = new Date()): number {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const ms = date.getMilliseconds();
  const boundaries = [5, 12, 17, 20, 24];
  const nextHour = boundaries.find((b) => b > h) ?? 5 + 24;
  const minutesUntil = (nextHour - h) * 60 - m;
  return Math.max(1000, minutesUntil * 60_000 - s * 1000 - ms);
}

export function useHeroCopy(empFullName: string) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sync = () => setNow(new Date());
    sync();
    const id = window.setTimeout(sync, msUntilNextGreetingChange());
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
    const period = resolveGreetingPeriod(now);
    const name = empFullName.trim() || "there";
    return {
      greeting: PERIOD_GREETING[period],
      headline: name,
      period,
    };
  }, [empFullName, now]);
}
