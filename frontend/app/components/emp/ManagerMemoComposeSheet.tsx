"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import type { EmpManagerReportee } from "../../utils/empManagerDisplay";
import { ManagerMemoComposeForm } from "./ManagerMemoComposeForm";

export function ManagerMemoComposeSheet({
  open,
  onClose,
  reportees: _reportees,
  managerName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  reportees?: EmpManagerReportee[];
  managerName?: string;
  onSent: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const sheet = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white rounded-t-[20px] flex flex-col shadow-2xl w-full max-h-[92dvh]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="shrink-0 px-4 pt-4 pb-2 border-b flex items-center justify-between">
          <h2 className="text-[17px] font-bold">Send notice / warning</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon icon="solar:close-circle-linear" className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">
          <ManagerMemoComposeForm
            managerName={managerName}
            onSent={onSent}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
