"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LogIn, LogOut } from "lucide-react";
import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { useEmpPunch } from "../../../hooks/useEmpPunch";
import { Button } from "../../ui/button";
import { NoticeBanner } from "../../ui/notice-banner";
import { cn } from "@/app/utils/cn";

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 20) return "Good evening";
  return "Good night";
}

function formatTimer(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")} : ${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
}

type CelestialState = {
  body: "sun" | "moon";
  /** % clipped from bottom — hides portion behind / below cloud horizon */
  bottomClip: number;
  /** % clipped from top — moon rising from behind cloud */
  topClip: number;
  opacity: number;
  cloudTopPercent: number;
};

const SUN_TOP_PERCENT = 22;
/** Sun disc height as % of the hero scene */
const SUN_HEIGHT_PERCENT = 58;
/** Extra visible sun so the disc meets the cloud (no gap above cloud) */
const SUN_CLOUD_OVERLAP = 14;

function getCloudTopPercent(t: number): number {
  // Morning — cloud sits low, sun fully clear above it
  if (t >= 5 && t < 12) return 78;
  // Afternoon — cloud rises, sun becomes half obscured
  if (t >= 12 && t < 17) {
    const p = (t - 12) / 5;
    return 78 - p * 26;
  }
  // Evening — cloud covers sun as it sets
  if (t >= 17 && t < 20) {
    const p = (t - 17) / 3;
    return 52 - p * 34;
  }
  // Night — cloud holds position while moon rises
  return 38;
}

function getCelestialState(date: Date): CelestialState {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const t = hours + minutes / 60;
  const cloudTopPercent = getCloudTopPercent(t);

  const sunBottom = SUN_TOP_PERCENT + SUN_HEIGHT_PERCENT;
  const cloudTop = cloudTopPercent;

  if (t >= 5 && t < 20) {
    let bottomClip = 0;
    if (cloudTop < sunBottom) {
      const visibleHeight = Math.max(0, cloudTop - SUN_TOP_PERCENT);
      bottomClip = Math.min(100, Math.max(0, 100 - (visibleHeight / SUN_HEIGHT_PERCENT) * 100));
      bottomClip = Math.max(0, bottomClip - SUN_CLOUD_OVERLAP);
    }

    let opacity = 1;
    if (t >= 17) {
      const p = (t - 17) / 3;
      if (bottomClip > 85) opacity = Math.max(0, 1 - (bottomClip - 85) / 15);
      opacity = Math.min(opacity, Math.max(0, 1 - p * 0.35));
    }

    return { body: "sun", bottomClip, topClip: 0, opacity, cloudTopPercent };
  }

  const nightProgress = t >= 20 ? (t - 20) / 9 : (t + 4) / 9;
  const clamped = Math.min(1, Math.max(0, nightProgress));
  const topClip = Math.max(0, 100 - clamped * 108);

  return {
    body: "moon",
    bottomClip: 0,
    topClip,
    opacity: Math.min(1, 0.12 + clamped * 0.95),
    cloudTopPercent,
  };
}

function HeroCloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      width={172}
      height={64}
      viewBox="0 0 172 64"
      fill="none"
      aria-hidden
    >
      <defs>
        <filter id="hero-single-cloud-blur" x="-15%" y="-50%" width="130%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <linearGradient id="hero-single-cloud-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#FFF9F0" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      <g filter="url(#hero-single-cloud-blur)">
        <ellipse cx="48" cy="36" rx="28" ry="16" fill="url(#hero-single-cloud-fill)" />
        <ellipse cx="78" cy="28" rx="34" ry="20" fill="url(#hero-single-cloud-fill)" />
        <ellipse cx="112" cy="34" rx="28" ry="17" fill="url(#hero-single-cloud-fill)" />
        <ellipse cx="138" cy="38" rx="22" ry="13" fill="url(#hero-single-cloud-fill)" />
        <ellipse cx="88" cy="42" rx="42" ry="13" fill="url(#hero-single-cloud-fill)" />
      </g>
    </svg>
  );
}

function HeroSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" fill="none" aria-hidden>
      <defs>
        <radialGradient id="hero-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD34D" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#FFD34D" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFD34D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hero-sun-body" cx="38%" cy="34%" r="62%">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="42%" stopColor="#FFD34D" />
          <stop offset="88%" stopColor="#FFC83D" />
          <stop offset="100%" stopColor="#F5B82E" />
        </radialGradient>
      </defs>
      <circle cx="70" cy="70" r="68" fill="url(#hero-sun-glow)" />
      <circle cx="70" cy="70" r="52" fill="url(#hero-sun-body)" />
    </svg>
  );
}

function HeroMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden>
      <defs>
        <radialGradient id="hero-moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8ECF4" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#D8DEE8" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#D8DEE8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hero-moon-body" cx="36%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#FAFBFD" />
          <stop offset="55%" stopColor="#EEF1F6" />
          <stop offset="100%" stopColor="#D9DFEA" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#hero-moon-glow)" />
      <circle cx="60" cy="60" r="44" fill="url(#hero-moon-body)" />
    </svg>
  );
}

/** Premium time-of-day cover with weather-app sun/moon arc behind one cloud. */
function HeroMorningCover() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const celestial = useMemo(() => getCelestialState(now), [now]);
  const isNight = celestial.body === "moon" && celestial.opacity > 0.5;
  const isEvening = celestial.body === "sun" && now.getHours() >= 17;

  const gradient = isNight
    ? `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 44%, #FAFBFD 58%, #F4F6FA 76%, #EEF1F6 92%, #E8ECF2 100%)`
    : isEvening
      ? `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 42%, #FFFDF9 56%, #FFF6ED 74%, #FFF1E4 90%, #FFEBD8 100%)`
      : `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 42%, #FFFDF8 55%, #FFF8EB 72%, #FFF4DD 88%, #FFF0D7 100%)`;

  const ambientGlow = isNight
    ? `radial-gradient(ellipse 46% 76% at 90% 40%, rgba(216,222,232,0.14) 0%, rgba(216,222,232,0.06) 34%, transparent 70%)`
    : isEvening
      ? `radial-gradient(ellipse 48% 78% at 92% 42%, rgba(255,196,120,0.14) 0%, rgba(255,211,77,0.06) 34%, transparent 72%)`
      : `radial-gradient(ellipse 48% 78% at 92% 42%, rgba(255,211,77,0.16) 0%, rgba(255,211,77,0.07) 32%, rgba(255,240,215,0.03) 55%, transparent 72%)`;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      <div className="absolute inset-0" style={{ background: gradient }} />
      <div className="absolute inset-0" style={{ background: ambientGlow }} />

      <svg
        className="absolute inset-x-0 bottom-0 h-[55%] w-full"
        viewBox="0 0 800 220"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 140 C120 118 200 158 320 132 C440 106 520 148 640 128 C720 116 760 122 800 110 L800 220 L0 220 Z"
          fill={isNight ? "#D8DEE8" : "#F5E6C8"}
          fillOpacity="0.05"
        />
        <path
          d="M0 168 C100 152 180 184 300 162 C420 140 500 178 620 160 C700 148 760 156 800 148 L800 220 L0 220 Z"
          fill={isNight ? "#CDD4E0" : "#F0DDB8"}
          fillOpacity="0.05"
        />
      </svg>

      {/* Weather-app scene: fixed sun/moon, cloud rises to occlude */}
      <div className="absolute inset-y-0 right-0 w-[46%] min-w-[220px]">
        <div
          className="emp-hero-celestial absolute right-[6%] top-[22%] z-[1] w-[140px] sm:w-[164px] transition-[clip-path,opacity] duration-[2500ms] ease-in-out"
          style={{
            clipPath:
              celestial.body === "sun"
                ? `inset(0 0 ${celestial.bottomClip}% 0)`
                : `inset(${celestial.topClip}% 0 0 0)`,
            opacity: celestial.opacity,
          }}
        >
          {celestial.body === "sun" ? (
            <HeroSun className="emp-hero-sun-glow w-full" />
          ) : (
            <HeroMoon className="emp-hero-sun-glow w-full" />
          )}
        </div>

        <HeroCloud
          className="absolute right-[4%] z-[2] w-[168px] sm:w-[172px] transition-[top] duration-[2500ms] ease-in-out"
          style={{ top: `${celestial.cloudTopPercent}%` }}
        />

        <div
          className="absolute right-5 top-5 grid grid-cols-4 gap-[5px]"
          style={{ opacity: isNight ? 0.22 : 0.3 }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="size-[3px] rounded-full"
              style={{ backgroundColor: isNight ? "#D8DEE8" : "#FFE9AA" }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .emp-hero-sun-glow {
          animation: emp-hero-glow 7s ease-in-out infinite;
        }
        @keyframes emp-hero-glow {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .emp-hero-celestial {
            transition: none !important;
          }
          .emp-hero-sun-glow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export function EmpDesktopHomeProfileHero({
  empFullName,
  empPhoto,
  empInitials,
  designation,
  department,
  todayStatus,
  loadingStatus,
  onStatusUpdate,
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
  const [tick, setTick] = useState(0);
  const [workAnchor, setWorkAnchor] = useState<{ baseSeconds: number; at: number } | null>(null);
  const { punch, punchLoading, punchError, punchSuccess, setPunchError } = useEmpPunch(onStatusUpdate);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const isCheckedIn = punchState === "IN" || punchState === "ON_BREAK";
  const isAbsent = todayStatus?.isAbsentToday;

  const roleLine = [designation, department].filter(Boolean).join(" · ") || "Employee";

  const checkInKey =
    typeof todayStatus?.checkIn === "string"
      ? todayStatus.checkIn
      : todayStatus?.checkIn?.checkinTime;

  useEffect(() => {
    if (!isCheckedIn) {
      setWorkAnchor(null);
      return;
    }
    const base = todayStatus?.workSeconds ?? 0;
    setWorkAnchor((prev) => {
      if (!prev) return { baseSeconds: base, at: Date.now() };
      const estimated = prev.baseSeconds + Math.floor((Date.now() - prev.at) / 1000);
      const drift = base - estimated;
      if (Math.abs(drift) > 15) return { baseSeconds: base, at: Date.now() };
      return prev;
    });
  }, [isCheckedIn, todayStatus?.workSeconds, checkInKey]);

  const timerSeconds = useMemo(() => {
    void tick;
    if (!isCheckedIn) return todayStatus?.workSeconds ?? 0;
    if (!workAnchor) return todayStatus?.workSeconds ?? 0;
    return workAnchor.baseSeconds + Math.floor((Date.now() - workAnchor.at) / 1000);
  }, [tick, isCheckedIn, workAnchor, todayStatus?.workSeconds]);

  const statusText = loadingStatus
    ? "Loading…"
    : isAbsent
      ? "Absent"
      : isCheckedIn
        ? "Checked-In"
        : todayStatus?.checkOut
          ? "Checked-Out"
          : "Yet to check-in";

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <HeroMorningCover />

      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-5 sm:gap-6">
          <div
            className={cn(
              "size-24 sm:size-28 rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-4 ring-white/80 shadow-sm",
              empPhoto ? "bg-muted" : "bg-primary",
            )}
          >
            {empPhoto ? (
              <img src={empPhoto} alt={empFullName} className="size-full object-cover" />
            ) : (
              <span className="text-primary-foreground font-bold text-2xl sm:text-3xl">{empInitials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1 max-w-[min(100%,36rem)]">
            <h1 className="font-display text-[1.65rem] sm:text-[1.85rem] font-semibold tracking-tight text-foreground leading-snug">
              <span className="font-normal text-muted-foreground">{greeting()}, </span>
              <span className="text-foreground">{empFullName}</span>
            </h1>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">{roleLine}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isCheckedIn ? "text-emerald-600" : isAbsent ? "text-rose-600" : "text-amber-600",
                )}
              >
                {statusText}
              </p>
              {isCheckedIn && !isAbsent ? (
                <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground tracking-wider">
                  {formatTimer(timerSeconds)}
                </p>
              ) : null}
            </div>

            {!loadingStatus && !isAbsent ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {canCheckIn ? (
                  <Button size="default" onClick={() => punch("CHECK_IN")} disabled={punchLoading}>
                    <LogIn className="size-4" />
                    {punchLoading ? "Please wait…" : "Check-in"}
                  </Button>
                ) : null}
                {canCheckOut ? (
                  <Button size="default" variant="outline" onClick={() => punch("CHECK_OUT")} disabled={punchLoading}>
                    <LogOut className="size-4" />
                    Check-out
                  </Button>
                ) : null}
              </div>
            ) : null}

            {punchSuccess ? (
              <NoticeBanner variant="success" className="mt-4 text-left">
                {punchSuccess}
              </NoticeBanner>
            ) : null}
            {punchError ? (
              <NoticeBanner variant="error" className="mt-4 text-left">
                <div className="space-y-2">
                  <p>{punchError}</p>
                  {punchError.toLowerCase().includes("permission") || punchError.toLowerCase().includes("location") ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPunchError(null)}>
                      Dismiss
                    </Button>
                  ) : null}
                </div>
              </NoticeBanner>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
