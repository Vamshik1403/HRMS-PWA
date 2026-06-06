/**
 * PWA location punches: first mark-in, last mark-out (when day is closed),
 * and work duration from first in → last out / now minus breaks.
 */

export type PunchRow = { checkType: string; checkinTime: Date };

export function getEffectiveDisplayPunches(records: PunchRow[]) {
  const sorted = [...records].sort(
    (a, b) => a.checkinTime.getTime() - b.checkinTime.getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === 'CHECK_IN');
  const checkOuts = sorted.filter((r) => r.checkType === 'CHECK_OUT');
  const lastPunch = sorted.at(-1) ?? null;
  const firstIn = checkIns[0] ?? null;
  const lastOut =
    lastPunch?.checkType === 'CHECK_OUT' ? (checkOuts.at(-1) ?? null) : null;
  return { sorted, firstIn, lastOut, lastPunch };
}

function computeBreakMs(sorted: PunchRow[], asOf: Date): number {
  let breakMs = 0;
  let breakStart: Date | null = null;

  for (const rec of sorted) {
    const t = rec.checkinTime;
    if (rec.checkType === 'BREAK_IN') {
      breakStart = t;
    } else if (rec.checkType === 'BREAK_OUT') {
      if (breakStart) breakMs += t.getTime() - breakStart.getTime();
      breakStart = null;
    }
  }

  if (sorted.at(-1)?.checkType === 'BREAK_IN' && breakStart) {
    breakMs += Math.max(0, asOf.getTime() - breakStart.getTime());
  }

  return Math.max(0, breakMs);
}

export function computePwaDayDurations(records: PunchRow[], asOf: Date) {
  const { sorted, firstIn, lastOut } = getEffectiveDisplayPunches(records);
  const breakMs = computeBreakMs(sorted, asOf);

  if (!firstIn) {
    return {
      workMs: 0,
      breakMs,
      workMinutes: 0,
      breakMinutes: 0,
      workSeconds: 0,
      breakSeconds: 0,
    };
  }

  const endMs =
    lastOut != null
      ? lastOut.checkinTime.getTime()
      : asOf.getTime();

  const workMs = Math.max(
    0,
    endMs - firstIn.checkinTime.getTime() - breakMs,
  );

  return {
    workMs,
    breakMs,
    workMinutes: Math.max(0, Math.round(workMs / 60000)),
    breakMinutes: Math.max(0, Math.round(breakMs / 60000)),
    workSeconds: Math.max(0, Math.round(workMs / 1000)),
    breakSeconds: Math.max(0, Math.round(breakMs / 1000)),
  };
}
