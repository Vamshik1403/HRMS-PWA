"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { resolveAttachmentUrl } from "../../utils/uploadFile";

export interface MemoChatMessage {
  id: number;
  description?: string | null;
  issuedBy?: string | null;
  createdAt?: string | null;
  attachmentPath?: string | null;
  isOriginal?: boolean;
}

interface MemoChatboxProps {
  open: boolean;
  onClose: () => void;
  subject: string;
  memoType?: string | null;
  messages: MemoChatMessage[];
  message: string;
  onMessageChange: (v: string) => void;
  onSend: () => void | Promise<void>;
  sending?: boolean;
  onUndo?: (messageId: number) => void;
  canUndoMessage?: (msg: MemoChatMessage) => boolean;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function MemoChatbox({
  open,
  onClose,
  subject,
  memoType,
  messages,
  message,
  onMessageChange,
  onSend,
  sending,
  onUndo,
  canUndoMessage,
}: MemoChatboxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [open, messages.length, messages[messages.length - 1]?.id]);

  if (!open) return null;

  const canSend = message.trim().length > 0 && !sending;

  const handleSend = () => {
    if (!canSend) return;
    void onSend();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(420px,calc(100vw-2rem))] rounded-xl shadow-2xl border border-gray-200 overflow-hidden bg-white flex flex-col max-h-[min(560px,calc(100vh-2rem))]">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#2563eb] text-white shrink-0">
        <MessageSquare className="w-4 h-4 shrink-0" />
        <p className="text-sm font-semibold truncate flex-1">IM · {subject || "Message"}</p>
        {memoType && (
          <Badge variant="secondary" className="!bg-white/20 !text-white !border-white/30 text-[10px]">
            {memoType}
          </Badge>
        )}
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/20" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white min-h-[180px]">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border p-3 ${
                m.isOriginal ? "border-[#c7d2fe] bg-[#eef2ff]/60" : "border-gray-100 bg-gray-50/80"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800">{m.issuedBy || "—"}</p>
                {!m.isOriginal && onUndo && canUndoMessage?.(m) && (
                  <button
                    type="button"
                    onClick={() => onUndo(m.id)}
                    className="text-[10px] font-semibold text-[#2563eb] hover:underline shrink-0"
                  >
                    Undo
                  </button>
                )}
              </div>
              {m.description && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{m.description}</p>
              )}
              {m.attachmentPath && (
                <a
                  href={resolveAttachmentUrl(m.attachmentPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-[#2563eb] underline mt-2"
                >
                  Open attachment
                </a>
              )}
              <p className="text-[11px] text-gray-400 mt-2">{formatTime(m.createdAt)}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-100 p-3 bg-white shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            className="min-h-[44px] text-sm resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
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
      </div>
    </div>
  );
}
