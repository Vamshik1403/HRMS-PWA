"use client";

import { Icon } from "@iconify/react";

export function EmpRecordHistorySheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[220] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white rounded-t-[20px] shadow-2xl flex flex-col w-full"
        style={{
          maxHeight: "calc(100dvh - env(safe-area-inset-top) - 8px)",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-linear" className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3"
          style={{
            paddingBottom: "calc(56px + env(safe-area-inset-bottom) + 20px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
