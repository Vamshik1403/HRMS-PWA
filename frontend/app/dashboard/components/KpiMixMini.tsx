"use client";

/** Thin horizontal progress bar with percentage label. */
export function KpiMixMini({
  value,
  max,
  fill,
}: {
  value: number;
  max: number;
  fill: string;
}) {
  const safeMax = Math.max(max, 1);
  const pct = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));

  return (
    <div className="mt-4 space-y-1">
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span style={{ color: fill }}>{value} / {safeMax}</span>
        <span className="text-gray-400">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#e8e8e8] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: fill,
            minWidth: value > 0 ? "4px" : undefined,
          }}
        />
      </div>
    </div>
  );
}
