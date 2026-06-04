"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Paperclip, Send, X } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { TaskStatusBadge, type TaskStatus } from "./task-ui";
import type { TaskActivity, TaskChatMessage } from "./task-types";
import { TaskChatAttachmentImage } from "./TaskChatAttachment";
import { taskAttachmentSrc, uploadTaskAttachment } from "../../utils/taskAttachment";
import { toast } from "sonner";

interface TaskRemarksChatboxProps {
  open: boolean;
  onClose: () => void;
  taskCode: string;
  status: string;
  chats: TaskChatMessage[];
  activities?: TaskActivity[];
  message: string;
  onMessageChange: (v: string) => void;
  statusValue: string;
  onStatusChange: (v: string) => void;
  statusOptions: TaskStatus[];
  onSend: (payload: { message: string; attachmentUrl?: string }) => void | Promise<void>;
  sending?: boolean;
}

function formatTime(value: string) {
  try { return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return value; }
}

function statusForMessage(activities: TaskActivity[], chatTime: string): string | null {
  const t = new Date(chatTime).getTime();
  let best: TaskActivity | null = null;
  for (const a of activities) {
    if (a.action !== "STATUS_CHANGE") continue;
    const at = new Date(a.createdAt).getTime();
    if (at <= t + 60000 && (!best || at > new Date(best.createdAt).getTime())) best = a;
  }
  return best?.newValue || null;
}

export function TaskRemarksChatbox({
  open,
  onClose,
  taskCode,
  status,
  chats,
  activities = [],
  message,
  onMessageChange,
  statusValue,
  onStatusChange,
  statusOptions,
  onSend,
  sending,
}: TaskRemarksChatboxProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [open, chats.length, chats[chats.length - 1]?.id]);

  if (!open) return null;

  const transitions = [status, ...statusOptions.filter((s) => s !== status)].join(" \u2022 ");
  const canSend = (message.trim() || pendingAttachment) && !sending && !uploading;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTaskAttachment(file);
      setPendingAttachment(url);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => {
    if (!canSend) return;
    onSend({ message: message.trim(), attachmentUrl: pendingAttachment || undefined });
    setPendingAttachment(null);
  };

  const previewSrc = taskAttachmentSrc(pendingAttachment);

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(420px,calc(100vw-2rem))] rounded-xl shadow-2xl border border-gray-200 overflow-hidden bg-white flex flex-col max-h-[min(560px,calc(100vh-2rem))]">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#2563eb] text-white shrink-0">
        <MessageSquare className="w-4 h-4 shrink-0" />
        <p className="text-sm font-semibold truncate flex-1">Remarks · {taskCode}</p>
        <TaskStatusBadge status={status} size="xs" className="!bg-white/20 !text-white !border-white/30" />
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/20" aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white min-h-[180px]">
        {chats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No remarks yet.</p>
        ) : chats.map((c) => {
          const tag = statusForMessage(activities, c.createdAt);
          return (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              {tag && <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 mb-2">{tag}</span>}
              {c.message && c.message !== "📷 Photo" && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.message}</p>
              )}
              <TaskChatAttachmentImage attachmentUrl={c.attachmentUrl} />
              <p className="text-[11px] text-gray-400 mt-2">{c.senderName || "User"} · {formatTime(c.createdAt)}</p>
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-100 p-3 space-y-2 bg-white shrink-0">
        {statusOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-gray-500 shrink-0">Status</span>
            <select className="app-select flex-1 h-9 text-sm" value={statusValue || status} onChange={(e) => onStatusChange(e.target.value)}>
              <option value={status}>{status} (current)</option>
              {statusOptions.filter((s) => s !== status).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {previewSrc && (
          <div className="relative inline-block">
            <img src={previewSrc} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center"
              aria-label="Remove attachment"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || sending}
            className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 border border-gray-200 disabled:opacity-50"
            aria-label="Attach image"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Type a remark..."
            rows={2}
            className="min-h-[44px] text-sm resize-none flex-1"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button
            type="button"
            size="icon"
            className="rounded-full h-10 w-10 shrink-0 bg-[#2563eb] hover:bg-[#1d4ed8]"
            disabled={!canSend}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {statusOptions.length > 0 && (
          <p className="text-[10px] text-gray-400">Current: {status} · You can move to: {transitions}</p>
        )}
      </div>
    </div>
  );
}
