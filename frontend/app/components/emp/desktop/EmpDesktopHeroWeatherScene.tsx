"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type WeatherScene = {
  /** Full-card horizontal wash — left always stays white */
  cardGradient: string;
  /** Soft radial sky tint on the right (no hard box) */
  rightAtmosphere: string;
  sunGlow: string;
  sunTop: number;
  sunRight: number;
  sunOpacity: number;
  sunClipBottom: number;
  sunClipTop: number;
  moonTop: number;
  moonRight: number;
  moonOpacity: number;
  moonClipTop: number;
  moonClipBottom: number;
  cloudTop: number;
  cloudRight: number;
  cloudOpacity: number;
  cloudNight: boolean;
  cloudDrift: number;
  starsOpacity: number;
  farCloudsOpacity: number;
  showSun: boolean;
  showMoon: boolean;
};

/** Shared cloud hub — sun/moon rise from and set into this point */
const CLOUD_HUB_TOP = 54;
const CLOUD_HUB_RIGHT = 21;
/** Moon sits slightly left of the cloud anchor */
const MOON_HUB_RIGHT = 27;
/** Celestial peek position — centred on cloud so the lower disc hides behind it */
const CELESTIAL_RISE_START = 44;
/** Highest point in the sky (lower % = higher on screen) */
const CELESTIAL_APEX_TOP = 8;
/** Celestial position when sinking back toward the cloud */
const CELESTIAL_SET_END = 40;

/** Night palette — deeper navy, still feathered (not a hard box) */
const NIGHT_CORE: [number, number, number] = [24, 36, 68];
const NIGHT_DEEP: [number, number, number] = [35, 52, 92];
const NIGHT_MID: [number, number, number] = [58, 78, 118];
const NIGHT_EDGE: [number, number, number] = [98, 118, 158];

function rgba(c: [number, number, number], a: number) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function getWeatherScene(date: Date): WeatherScene {
  const t = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  const white: [number, number, number] = [255, 255, 255];
  const lightBlue: [number, number, number] = [186, 214, 244];
  const skyBlue: [number, number, number] = [135, 185, 235];
  const warmGold: [number, number, number] = [255, 228, 180];
  const sunsetOrange: [number, number, number] = [255, 168, 110];
  const sunsetPink: [number, number, number] = [232, 140, 168];
  const sunsetPurple: [number, number, number] = [120, 100, 168];
  const sunrisePurple: [number, number, number] = [100, 88, 148];
  const sunrisePink: [number, number, number] = [240, 160, 175];
  const sunriseOrange: [number, number, number] = [255, 175, 120];

  let cardGradient =
    "linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 44%, #FFFDF8 58%, #FFF8EB 76%, #FFF4DD 92%, #FFF0D7 100%)";
  let rightAtmosphere =
    "radial-gradient(ellipse 52% 90% at 96% 38%, rgba(186,214,244,0.28) 0%, rgba(255,228,180,0.12) 32%, transparent 68%)";
  let sunGlow = "rgba(255, 211, 77, 0.18)";

  let sunTop = 28;
  let sunRight = 14;
  let sunOpacity = 0;
  let sunClipBottom = 0;
  let sunClipTop = 100;
  let moonTop = 26;
  let moonRight = MOON_HUB_RIGHT;
  let moonOpacity = 0;
  let moonClipTop = 100;
  let moonClipBottom = 0;
  let cloudTop = CLOUD_HUB_TOP;
  let cloudRight = CLOUD_HUB_RIGHT;
  let cloudOpacity = 0.95;
  let cloudNight = false;
  let cloudDrift = 0;
  let starsOpacity = 0;
  let farCloudsOpacity = 0.55;
  let showSun = false;
  let showMoon = false;

  // Sunrise 5:00 – 6:00 — sun rises from cloud, moon finishes setting into cloud
  if (t >= 5 && t < 6) {
    const p = (t - 5) / 1;
    cardGradient = `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 46%, #FAF8FC 60%, #F8F0F4 76%, #FFF4E8 90%, #FFF0DC 100%)`;
    rightAtmosphere = `radial-gradient(ellipse 50% 88% at 96% 36%, ${rgba(sunrisePurple, lerp(0.14, 0.06, p))} 0%, ${rgba(sunrisePink, lerp(0.1, 0.04, p))} 30%, transparent 66%)`;
    sunGlow = `rgba(255, 200, 120, ${lerp(0.06, 0.18, p)})`;

    cloudTop = CLOUD_HUB_TOP;
    cloudRight = CLOUD_HUB_RIGHT;

    // Sun rises upward through the cloud hub
    const sunRise = clamp01((p - 0.02) / 0.98);
    sunTop = lerp(CELESTIAL_RISE_START, CELESTIAL_APEX_TOP, sunRise);
    sunRight = CLOUD_HUB_RIGHT;
    sunOpacity = clamp01((sunRise - 0.04) / 0.96);
    sunClipTop = 0;
    sunClipBottom = 0;
    showSun = sunOpacity > 0.02;

    // Moon sinks down into the cloud hub
    const moonSet = clamp01(p * 1.1);
    moonTop = lerp(CELESTIAL_APEX_TOP, CELESTIAL_SET_END, moonSet);
    moonRight = MOON_HUB_RIGHT;
    moonOpacity = clamp01(1 - moonSet * 1.1);
    moonClipTop = 0;
    moonClipBottom = 0;
    showMoon = moonOpacity > 0.02;

    cloudOpacity = lerp(0.72, 0.94, p);
    farCloudsOpacity = lerp(0, 0.45, p);
    starsOpacity = clamp01(1 - p * 1.15) * 0.35;
  }
  // Day 6:00 – 16:00 — sun travels above the cloud hub
  else if (t >= 6 && t < 16) {
    const p = (t - 6) / 10;
    const noonFactor = 1 - Math.abs(p - 0.5) * 2;

    cardGradient = `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 44%, #FFFDF8 56%, #FFF8EB 72%, #FFF4DD 88%, #FFF0D7 100%)`;
    rightAtmosphere = `radial-gradient(ellipse 52% 92% at 96% 36%, ${rgba(lightBlue, lerp(0.22, 0.32, noonFactor))} 0%, ${rgba(skyBlue, lerp(0.1, 0.16, noonFactor))} 28%, ${rgba(warmGold, 0.08)} 48%, transparent 68%)`;
    sunGlow = `rgba(255, 211, 77, ${lerp(0.12, 0.22, noonFactor)})`;

    cloudTop = CLOUD_HUB_TOP;
    cloudRight = CLOUD_HUB_RIGHT;

    sunTop = lerp(CELESTIAL_APEX_TOP + 6, CELESTIAL_APEX_TOP, noonFactor) + lerp(0, 4, p);
    sunRight = CLOUD_HUB_RIGHT;
    sunOpacity = 1;
    sunClipTop = 0;
    sunClipBottom = 0;
    showSun = true;

    cloudOpacity = 0.92;
    farCloudsOpacity = 0.5 + noonFactor * 0.15;
    cloudDrift = p * 10;
  }
  // Sunset 16:00 – 18:00 — sun descends into the cloud hub
  else if (t >= 16 && t < 18) {
    const p = (t - 16) / 2;

    cardGradient = `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 44%, #FFFDF9 56%, #FFF6ED 72%, #FFF1E4 88%, #FFEBD8 100%)`;
    rightAtmosphere = `radial-gradient(ellipse 50% 90% at 96% 38%, ${rgba(sunsetPurple, lerp(0.08, 0.14, p))} 0%, ${rgba(sunsetPink, lerp(0.06, 0.12, p))} 26%, ${rgba(sunsetOrange, lerp(0.05, 0.1, p))} 44%, transparent 66%)`;
    sunGlow = `rgba(255, 170, 90, ${lerp(0.18, 0.08, p)})`;

    cloudTop = CLOUD_HUB_TOP;
    cloudRight = CLOUD_HUB_RIGHT;

    const sunSet = clamp01((p - 0.15) / 0.85);
    sunTop = lerp(CELESTIAL_APEX_TOP, CELESTIAL_SET_END, sunSet);
    sunRight = CLOUD_HUB_RIGHT;
    sunOpacity = lerp(1, 0.08, clamp01((p - 0.72) / 0.28));
    sunClipTop = 0;
    sunClipBottom = 0;
    showSun = sunOpacity > 0.04;

    cloudOpacity = 0.92;
    farCloudsOpacity = lerp(0.45, 0.2, p);
  }
  // Evening 18:00 – 20:00 — moon rises slowly upward from the cloud hub
  else if (t >= 18 && t < 20) {
    const p = (t - 18) / 2;

    cardGradient = `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 48%, #F6F8FB 62%, #E8EDF4 76%, #D8E0EC 90%, #CCD6E4 100%)`;
    rightAtmosphere = `radial-gradient(ellipse 140% 180% at 84% 50%, ${rgba(NIGHT_DEEP, lerp(0.18, 0.32, p))} 0%, ${rgba(NIGHT_MID, lerp(0.12, 0.22, p))} 32%, ${rgba(NIGHT_EDGE, lerp(0.08, 0.14, p))} 55%, transparent 82%)`;
    sunGlow = `rgba(190, 205, 235, ${lerp(0.08, 0.16, p)})`;

    sunOpacity = 0;
    showSun = false;

    cloudTop = CLOUD_HUB_TOP;
    cloudRight = CLOUD_HUB_RIGHT;

    const moonRise = clamp01((p - 0.02) / 0.95);
    moonTop = lerp(CELESTIAL_RISE_START, CELESTIAL_APEX_TOP, moonRise);
    moonRight = MOON_HUB_RIGHT;
    moonOpacity = lerp(0.12, 1, moonRise);
    moonClipTop = 0;
    moonClipBottom = 0;
    showMoon = moonOpacity > 0.04;

    cloudOpacity = lerp(0.9, 0.82, p);
    cloudNight = p > 0.35;
    starsOpacity = lerp(0, 0.65, moonRise);
    farCloudsOpacity = lerp(0.15, 0, p);
  }
  // Night 20:00 – 5:00 — moon above cloud, then sets into cloud before dawn
  else {
    const nightT = t >= 20 ? t : t + 24;
    const nightStart = 20;
    const nightEnd = 29;
    const p = clamp01((nightT - nightStart) / (nightEnd - nightStart));

    cardGradient = `linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 48%, #F4F6FA 62%, #E2E8F2 76%, #CED8E8 90%, #B8C6DA 100%)`;
    rightAtmosphere = `radial-gradient(ellipse 150% 200% at 82% 50%, ${rgba(NIGHT_CORE, lerp(0.34, 0.44, p))} 0%, ${rgba(NIGHT_DEEP, lerp(0.24, 0.32, p))} 28%, ${rgba(NIGHT_MID, lerp(0.14, 0.2, p))} 50%, ${rgba(NIGHT_EDGE, lerp(0.08, 0.12, p))} 68%, transparent 88%), radial-gradient(ellipse 110% 120% at 78% 72%, ${rgba(NIGHT_DEEP, lerp(0.14, 0.2, p))} 0%, transparent 72%)`;
    sunGlow = `rgba(170, 188, 230, ${lerp(0.12, 0.2, p)})`;

    cloudTop = CLOUD_HUB_TOP;
    cloudRight = CLOUD_HUB_RIGHT;

    const moonSet = clamp01((nightT - 28) / 1);
    if (moonSet > 0) {
      // 4:00–5:00 — moon sinks down into the cloud hub
      moonTop = lerp(CELESTIAL_APEX_TOP, CELESTIAL_SET_END, moonSet);
      moonRight = MOON_HUB_RIGHT;
      moonOpacity = lerp(1, 0.06, moonSet);
      moonClipTop = 0;
      moonClipBottom = 0;
      showMoon = moonOpacity > 0.04;
      starsOpacity = lerp(0.55, 0.2, moonSet);
      cloudOpacity = lerp(0.82, 0.72, moonSet);
    } else {
      const moonFull = clamp01((nightT - 20) / 1.5);
      moonTop = lerp(CELESTIAL_APEX_TOP + 4, CELESTIAL_APEX_TOP, moonFull);
      moonRight = MOON_HUB_RIGHT;
      moonOpacity = lerp(0.9, 1, moonFull);
      moonClipTop = 0;
      moonClipBottom = 0;
      showMoon = true;

      const cloudFade = clamp01((moonFull - 0.65) / 0.35);
      cloudOpacity = lerp(0.82, 0.55, cloudFade);
      starsOpacity = lerp(0.35, 0.95, clamp01((moonFull - 0.75) / 0.25));
    }

    cloudNight = true;
    cloudDrift = 6 + p * 6;
    farCloudsOpacity = 0;
  }

  return {
    cardGradient,
    rightAtmosphere,
    sunGlow,
    sunTop,
    sunRight,
    sunOpacity,
    sunClipBottom,
    sunClipTop,
    moonTop,
    moonRight,
    moonOpacity,
    moonClipTop,
    moonClipBottom,
    cloudTop,
    cloudRight,
    cloudOpacity,
    cloudNight,
    cloudDrift,
    starsOpacity,
    farCloudsOpacity,
    showSun,
    showMoon,
  };
}

const STAR_POSITIONS = [
  [8, 6], [22, 12], [38, 5], [52, 16], [68, 8], [84, 18], [14, 22], [30, 28],
  [46, 20], [62, 26], [78, 14], [18, 38], [42, 34], [58, 40], [74, 32], [88, 44],
  [10, 48], [34, 52], [54, 46], [72, 54], [26, 10], [60, 6], [80, 36], [44, 52],
];

function HeroCloud({
  uid,
  night,
  className,
  style,
}: {
  uid: string;
  night?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const fillId = `cloud-fill-${uid}`;
  const blurId = `cloud-blur-${uid}`;

  return (
    <svg className={className} style={style} width={172} height={64} viewBox="0 0 172 64" fill="none" aria-hidden>
      <defs>
        <filter id={blurId} x="-15%" y="-50%" width="130%" height="200%">
          <feGaussianBlur stdDeviation={night ? 3 : 2.4} />
        </filter>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
          {night ? (
            <>
              <stop offset="0%" stopColor="#4A5A78" stopOpacity="0.78" />
              <stop offset="100%" stopColor="#2A3548" stopOpacity="0.62" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#FFF9F0" stopOpacity="0.96" />
            </>
          )}
        </linearGradient>
      </defs>
      <g filter={`url(#${blurId})`}>
        <ellipse cx="48" cy="36" rx="28" ry="16" fill={`url(#${fillId})`} />
        <ellipse cx="78" cy="28" rx="34" ry="20" fill={`url(#${fillId})`} />
        <ellipse cx="112" cy="34" rx="28" ry="17" fill={`url(#${fillId})`} />
        <ellipse cx="138" cy="38" rx="22" ry="13" fill={`url(#${fillId})`} />
        <ellipse cx="88" cy="42" rx="42" ry="13" fill={`url(#${fillId})`} />
      </g>
    </svg>
  );
}

function HeroSun({ uid, className }: { uid: string; className?: string }) {
  const glowId = `sun-glow-${uid}`;
  const bodyId = `sun-body-${uid}`;
  const bloomId = `sun-bloom-${uid}`;

  return (
    <svg className={className} viewBox="0 0 140 140" fill="none" aria-hidden>
      <defs>
        <radialGradient id={bloomId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE566" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#FFD34D" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FFD34D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD34D" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#FFD34D" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFD34D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={bodyId} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#FFF0A8" />
          <stop offset="35%" stopColor="#FFE082" />
          <stop offset="70%" stopColor="#FFD34D" />
          <stop offset="100%" stopColor="#F0A820" />
        </radialGradient>
      </defs>
      <circle cx="70" cy="70" r="70" fill={`url(#${bloomId})`} />
      <circle cx="70" cy="70" r="66" fill={`url(#${glowId})`} />
      <circle cx="70" cy="70" r="50" fill={`url(#${bodyId})`} />
    </svg>
  );
}

function HeroMoon({ uid, className }: { uid: string; className?: string }) {
  const glowId = `moon-glow-${uid}`;
  const bodyId = `moon-body-${uid}`;
  const shadeId = `moon-shade-${uid}`;

  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden>
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8EEFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#C8D4EC" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#C8D4EC" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={bodyId} cx="34%" cy="30%" r="68%">
          <stop offset="0%" stopColor="#FAFCFF" />
          <stop offset="45%" stopColor="#E8EDF6" />
          <stop offset="85%" stopColor="#D0D8E8" />
          <stop offset="100%" stopColor="#B8C2D4" />
        </radialGradient>
        <radialGradient id={shadeId} cx="72%" cy="68%" r="45%">
          <stop offset="0%" stopColor="#9AA8BE" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#9AA8BE" stopOpacity="0" />
        </radialGradient>
        <filter id={`moon-bloom-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#${glowId})`} />
      <circle cx="60" cy="60" r="44" fill={`url(#${bodyId})`} filter={`url(#moon-bloom-${uid})`} />
      <circle cx="60" cy="60" r="44" fill={`url(#${shadeId})`} />
      <circle cx="74" cy="52" r="6" fill="#C5CEDE" fillOpacity="0.25" />
      <circle cx="50" cy="68" r="4" fill="#C5CEDE" fillOpacity="0.18" />
    </svg>
  );
}

function FarClouds({ opacity, uid }: { opacity: number; uid: string }) {
  if (opacity < 0.05) return null;
  const fillId = `far-cloud-${uid}`;
  return (
    <svg
      className="emp-hero-far-clouds absolute inset-0 w-full h-full"
      viewBox="0 0 200 120"
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      aria-hidden
      style={{ opacity }}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="28" rx="36" ry="14" fill={`url(#${fillId})`} />
      <ellipse cx="130" cy="42" rx="28" ry="11" fill={`url(#${fillId})`} fillOpacity="0.7" />
      <ellipse cx="175" cy="48" rx="22" ry="9" fill={`url(#${fillId})`} fillOpacity="0.55" />
    </svg>
  );
}

/** Premium time-driven weather illustration — right 35% of hero card only. */
export function HeroMorningCover() {
  const uid = useId().replace(/:/g, "");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const scene = useMemo(() => getWeatherScene(now), [now]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      {/* Base — theme-aware */}
      <div className="emp-hero-cover-base absolute inset-0 bg-card" />

      {/* Soft card-wide wash — same technique as morning orange */}
      <div
        className="emp-hero-sky absolute inset-0 transition-[background] duration-[4000ms] ease-in-out"
        style={{ background: scene.cardGradient }}
      />

      {/* Right-side atmospheric shade — radial, feathered, no hard box */}
      <div
        className="absolute inset-0 transition-[background] duration-[4000ms] ease-in-out"
        style={{ background: scene.rightAtmosphere }}
      />

      {/* Celestial bloom — sun / moon glow */}
      <div
        className="absolute inset-0 transition-[background] duration-[4000ms] ease-in-out"
        style={{
          background: `radial-gradient(ellipse 72% 110% at 88% 44%, ${scene.sunGlow} 0%, transparent 74%)`,
        }}
      />

      {/* Readability shield — keeps name & text fully clear */}
      <div className="emp-hero-cover-shield absolute inset-0 bg-gradient-to-r from-card from-[0%] via-card via-[58%] via-card/95 via-[66%] via-card/50 via-[74%] to-transparent" />

      {/* Celestial elements — right zone only, transparent background */}
      <div className="absolute inset-y-0 right-0 w-[34%] min-w-[200px]">
        <FarClouds opacity={scene.farCloudsOpacity} uid={uid} />

        {/* Stars — behind moon, visible on dark night shade */}
        <div
          className="absolute inset-0 z-0 transition-opacity duration-[4000ms] ease-in-out"
          style={{ opacity: scene.starsOpacity }}
        >
          {STAR_POSITIONS.map(([x, y], i) => (
            <span
              key={i}
              className="emp-hero-star absolute rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: i % 4 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5,
                height: i % 4 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5,
                animationDelay: `${(i % 7) * 0.45}s`,
                backgroundColor: i % 5 === 0 ? "#F0F4FF" : "#FFFFFF",
                boxShadow: i % 4 === 0 ? "0 0 3px rgba(220,230,255,0.9)" : "0 0 1.5px rgba(255,255,255,0.7)",
              }}
            />
          ))}
          <span className="emp-hero-shooting-star absolute left-[20%] top-[12%] size-1 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
        </div>

        {/* Sun — rises behind the cloud; cloud masks the lower disc */}
        {scene.showSun ? (
          <div
            className="emp-hero-celestial absolute z-[1] w-[132px] sm:w-[150px] transition-[top,right,opacity,clip-path] duration-[6000ms] ease-in-out"
            style={{
              top: `${scene.sunTop}%`,
              right: `${scene.sunRight}%`,
              opacity: scene.sunOpacity,
              clipPath: `inset(${scene.sunClipTop}% 0 ${scene.sunClipBottom}% 0)`,
            }}
          >
            <HeroSun uid={uid} className="emp-hero-sun-pulse w-full" />
          </div>
        ) : null}

        {/* Moon — rises behind the cloud; cloud masks the lower disc */}
        {scene.showMoon ? (
          <div
            className="emp-hero-celestial absolute z-[1] w-[118px] sm:w-[134px] transition-[top,right,opacity,clip-path] duration-[6000ms] ease-in-out"
            style={{
              top: `${scene.moonTop}%`,
              right: `${scene.moonRight}%`,
              opacity: scene.moonOpacity,
              clipPath: `inset(${scene.moonClipTop}% 0 ${scene.moonClipBottom}% 0)`,
            }}
          >
            <HeroMoon uid={uid} className="emp-hero-moon-glow w-full" />
          </div>
        ) : null}

        {/* Cloud hub — in front of sun / moon, hides their lower portion */}
        {scene.cloudOpacity > 0.04 ? (
          <div
            className="emp-hero-main-cloud absolute z-[3] transition-[top,right,opacity,transform] duration-[4000ms] ease-in-out"
            style={{
              top: `${scene.cloudTop}%`,
              right: `${scene.cloudRight}%`,
              opacity: scene.cloudOpacity,
              transform: `translateX(${scene.cloudDrift}px)`,
            }}
          >
            <HeroCloud
              uid={`${uid}-main`}
              night={scene.cloudNight}
              className="w-[128px] sm:w-[164px]"
            />
          </div>
        ) : null}
      </div>

      <style>{`
        .emp-hero-sun-pulse {
          animation: emp-hero-sun-pulse 8s ease-in-out infinite;
        }
        .emp-hero-moon-glow {
          animation: emp-hero-moon-glow 10s ease-in-out infinite;
        }
        .emp-hero-far-clouds {
          animation: emp-hero-far-drift 42s ease-in-out infinite alternate;
        }
        .emp-hero-main-cloud {
          animation: emp-hero-cloud-float 14s ease-in-out infinite;
        }
        .emp-hero-star {
          animation: emp-hero-twinkle 3.5s ease-in-out infinite;
        }
        .emp-hero-shooting-star {
          animation: emp-hero-shoot 52s ease-in-out infinite;
          opacity: 0;
        }
        @keyframes emp-hero-sun-pulse {
          0%, 100% { opacity: 0.92; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.06); }
        }
        @keyframes emp-hero-moon-glow {
          0%, 100% { opacity: 0.94; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.08); }
        }
        @keyframes emp-hero-far-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-14px); }
        }
        @keyframes emp-hero-cloud-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes emp-hero-twinkle {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes emp-hero-shoot {
          0%, 94%, 100% { opacity: 0; transform: translate(0, 0); }
          95% { opacity: 0.9; transform: translate(0, 0); }
          97% { opacity: 0; transform: translate(48px, 28px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .emp-hero-celestial,
          .emp-hero-sky,
          .emp-hero-main-cloud {
            transition: none !important;
          }
          .emp-hero-sun-pulse,
          .emp-hero-moon-glow,
          .emp-hero-far-clouds,
          .emp-hero-main-cloud,
          .emp-hero-star,
          .emp-hero-shooting-star {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
