"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import type { EmpManagerReportee } from "../../utils/empManagerDisplay";
import { reporteeDisplayName } from "../../utils/empManagerDisplay";
import { uploadAttachmentFile } from "../../utils/uploadFile";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ManagerMemoComposeSheet({
  open,
  onClose,
  reportees,
  managerName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  reportees: EmpManagerReportee[];
  managerName?: string;
  onSent: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [memoType, setMemoType] = useState("General");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const submit = async () => {
    if (!employeeId) {
      toast.error("Select a team member");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSending(true);
    try {
      let attachmentPath: string | undefined;
      if (attachmentFile) {
        attachmentPath = await uploadAttachmentFile(attachmentFile);
      }
      const res = await fetch(`${BACKEND}/employee-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeID: Number(employeeId),
          memoType,
          subject: subject.trim(),
          description: description.trim() || undefined,
          issuedDate: new Date().toISOString().slice(0, 10),
          issuedBy: managerName || "Manager",
          issuedByRole: "MANAGER",
          attachmentPath,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      const data = await res.json();
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.id) throw new Error("No notice was created");
      toast.success("Notice sent");
      setSubject("");
      setDescription("");
      setEmployeeId("");
      setAttachmentFile(null);
      onSent();
      onClose();
    } catch {
      toast.error("Could not send notice");
    } finally {
      setSending(false);
    }
  };

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
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3">
          <label className="block text-[12px] text-gray-600 min-w-0">
            Team member
            <select
              className="app-form-control w-full min-w-0 mt-1 h-11 px-3 rounded-xl border border-gray-200 bg-white text-[14px]"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select employee</option>
              {reportees.map((r) => (
                <option key={r.id} value={r.id}>{reporteeDisplayName(r)}</option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] text-gray-600 min-w-0">
            Type
            <select
              className="app-form-control w-full min-w-0 mt-1 h-11 px-3 rounded-xl border border-gray-200 bg-white text-[14px]"
              value={memoType}
              onChange={(e) => setMemoType(e.target.value)}
            >
              <option value="General">Notice</option>
              <option value="Warning">Warning</option>
              <option value="Policy">Policy</option>
              <option value="Appreciation">Appreciation</option>
            </select>
          </label>
          <label className="block text-[12px] text-gray-600 min-w-0">
            Subject
            <input
              className="app-form-control w-full min-w-0 mt-1 h-11 px-3 rounded-xl border border-gray-200 bg-white text-[14px]"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="block text-[12px] text-gray-600 min-w-0">
            Message
            <textarea
              className="app-form-control w-full min-w-0 mt-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-[12px] text-gray-600 min-w-0">
            Attachment
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="app-form-control w-full min-w-0 mt-1 text-[13px]"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="shrink-0 px-4 py-3 border-t bg-white">
          <button
            type="button"
            disabled={sending}
            onClick={submit}
            className="w-full py-3.5 rounded-xl bg-[#2563eb] text-white font-semibold text-[15px] disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send to employee"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
