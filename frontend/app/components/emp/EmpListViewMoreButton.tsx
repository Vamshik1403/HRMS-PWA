"use client";

export function EmpListViewMoreButton({
  count,
  onClick,
  label,
}: {
  count: number;
  onClick: () => void;
  label?: string;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full py-2.5 text-[13px] font-bold text-[#2563eb] bg-white border border-gray-100 rounded-xl shadow-sm active:scale-[0.99]"
    >
      {label ?? `View more (${count} older)`}
    </button>
  );
}
