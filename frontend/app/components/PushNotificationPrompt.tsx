"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getEmployeeIdFromStorage,
  registerPushSubscription,
  resetPushClientStateIfNeeded,
} from "@/lib/pushSubscribe";
import { bootstrapServiceWorker } from "@/lib/serviceWorker";

type Props = {
  onSubscribed?: () => void;
  onModalOpenChange?: (open: boolean) => void;
};

export default function PushNotificationPrompt({
  onSubscribed,
  onModalOpenChange,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const ranRef = useRef(false);

  const setModal = useCallback(
    (open: boolean) => {
      setShowModal(open);
      onModalOpenChange?.(open);
    },
    [onModalOpenChange],
  );

  useEffect(() => {
    resetPushClientStateIfNeeded();
  }, []);

  useEffect(() => {
    if (showModal) {
      bootstrapServiceWorker();
    }
  }, [showModal]);

  const runSubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await registerPushSubscription(true);
      if (result.ok) {
        setModal(false);
        toast.success("Notifications enabled");
        onSubscribed?.();
      } else {
        console.warn("[push]", result.reason);
        if (result.reason.includes("denied")) {
          toast.error(
            "Notifications blocked. Open Settings → OpenHRM → Notifications.",
            { duration: 8000 },
          );
        } else {
          toast.error(result.reason, { duration: 8000 });
        }
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to enable notifications",
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
    }
  }, [busy, onSubscribed, setModal]);

  useEffect(() => {
    if (ranRef.current) return;
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("PushManager" in window) ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const employeeId = getEmployeeIdFromStorage();
    if (!employeeId) return;

    ranRef.current = true;
    bootstrapServiceWorker();

    if (Notification.permission === "granted") {
      void registerPushSubscription(false).then((r) => {
        if (r.ok) onSubscribed?.();
      });
      return;
    }

    if (
      Notification.permission === "default" &&
      !sessionStorage.getItem("_push_modal_seen")
    ) {
      setModal(true);
    }
  }, [onSubscribed, setModal]);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
        role="dialog"
        aria-labelledby="push-prompt-title"
      >
        <h2 id="push-prompt-title" className="text-base font-semibold text-gray-900">
          Enable notifications
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Get alerts for tasks, leave approvals, memos, and reimbursements.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              sessionStorage.setItem("_push_modal_seen", "1");
              setModal(false);
            }}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              sessionStorage.setItem("_push_modal_seen", "1");
              void runSubscribe();
            }}
            className="flex-1 rounded-xl bg-[#4f46e5] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
