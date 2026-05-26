"use client";

import {
  ArrowRightLeft,
  CircleDot,
  Flag,
  MessageSquare,
  Plus,
  Send,
  StickyNote,
} from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import type { TaskActivity, TaskChatMessage } from "./task-types";
import { initials } from "./task-ui";

interface TaskDiscussionPanelProps {
  chats: TaskChatMessage[];
  activities?: TaskActivity[];
  currentUserName?: string;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  className?: string;
  footer?: React.ReactNode;
  compact?: boolean;
  stickyInput?: boolean;
  showComposer?: boolean;
  /** When true, messages grow with page scroll (no inner scroll / max-height). */
  fluid?: boolean;
  /** Hide panel title when wrapped in tabs. */
  hideHeader?: boolean;
}

function formatTime(value: string) {
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

function activityIcon(action: string) {
  switch (action) {
    case "CREATED": return Plus;
    case "STATUS_CHANGE": return ArrowRightLeft;
    case "PRIORITY_CHANGE": return Flag;
    case "REMARK": return StickyNote;
    default: return CircleDot;
  }
}

function activityText(a: TaskActivity) {
  switch (a.action) {
    case "CREATED":
      return `Task created${a.newValue ? ` as ${a.newValue}` : ""}`;
    case "STATUS_CHANGE":
      return `Status changed${a.oldValue && a.newValue ? ` from ${a.oldValue} to ${a.newValue}` : a.newValue ? ` to ${a.newValue}` : ""}`;
    case "PRIORITY_CHANGE":
      return `Priority changed${a.oldValue && a.newValue ? ` from ${a.oldValue} to ${a.newValue}` : a.newValue ? ` to ${a.newValue}` : ""}`;
    case "REMARK":
      return a.remark || "Remark added";
    default:
      return a.remark || a.action.replace(/_/g, " ").toLowerCase();
  }
}

type FeedItem =
  | { kind: "chat"; data: TaskChatMessage }
  | { kind: "event"; data: TaskActivity };

function buildFeed(chats: TaskChatMessage[], activities: TaskActivity[]): FeedItem[] {
  const events = activities.filter((a) => a.action !== "CHAT");
  const items: FeedItem[] = [
    ...chats.map((c) => ({ kind: "chat" as const, data: c })),
    ...events.map((a) => ({ kind: "event" as const, data: a })),
  ];
  return items.sort(
    (a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime(),
  );
}

export function TaskDiscussionPanel({
  chats,
  activities = [],
  currentUserName,
  message,
  onMessageChange,
  onSend,
  sending,
  placeholder = "Write a reply…",
  className = "",
  footer,
  compact = false,
  stickyInput = false,
  showComposer = true,
  fluid = false,
  hideHeader = false,
}: TaskDiscussionPanelProps) {
  const feed = buildFeed(chats, activities);
  const inputBlock = (
    <div className={`border-t border-gray-100 bg-white p-3 space-y-2 ${stickyInput ? "sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]" : ""}`}>
      {footer}
      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={compact ? 2 : 2}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-lg border-gray-200 bg-gray-50/50 text-[13px] min-h-[42px] focus:bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          size="icon"
          className="h-[42px] w-[42px] shrink-0 rounded-lg"
          onClick={onSend}
          disabled={sending || !message.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col rounded-xl border border-gray-200/80 bg-white overflow-hidden ${className}`}>
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Discussion</p>
            {!compact && <p className="text-[11px] text-gray-500">Messages and activity updates</p>}
          </div>
        </div>
      )}

      <div
        className={`px-3 py-3 space-y-3 ${
          fluid
            ? ""
            : `flex-1 overflow-y-auto ${compact ? "min-h-[180px] max-h-[320px]" : "min-h-[280px] max-h-[480px]"}`
        }`}
      >
        {feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-[13px] text-gray-600 font-medium">No discussion yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Start the conversation below</p>
          </div>
        ) : (
          feed.map((item) => {
            if (item.kind === "event") {
              const a = item.data;
              const Icon = activityIcon(a.action);
              return (
                <div key={`ev-${a.id}`} className="flex items-start gap-2 py-1">
                  <div className="w-6 h-6 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[12px] text-gray-600 leading-relaxed">
                      <span className="font-medium text-gray-800">{a.actorName || "System"}</span>
                      {" · "}
                      {activityText(a)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(a.createdAt)}</p>
                  </div>
                </div>
              );
            }

            const c = item.data;
            const mine = currentUserName && c.senderName === currentUserName;
            return (
              <div key={`chat-${c.id}`} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    mine ? "bg-[#4f46e5] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {initials(c.senderName)}
                </div>
                <div className={`max-w-[78%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`flex items-baseline gap-1.5 mb-0.5 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className="text-[11px] font-medium text-gray-700">{c.senderName || "User"}</span>
                    <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
                  </div>
                  <div
                    className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                      mine
                        ? "bg-[#4f46e5] text-white"
                        : "bg-gray-50 border border-gray-100 text-gray-800"
                    }`}
                  >
                    {c.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showComposer && inputBlock}
    </div>
  );
}

export function TaskMessageComposer({
  message,
  onMessageChange,
  onSend,
  sending,
  placeholder = "Write a reply…",
  className = "",
}: {
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`border-t border-gray-200 bg-white p-3 ${className}`}>
      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-lg border-gray-200 bg-gray-50/50 text-[13px] min-h-[44px] focus:bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          size="icon"
          className="h-11 w-11 shrink-0 rounded-lg"
          onClick={onSend}
          disabled={sending || !message.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Re-export for backward compatibility
export type { TaskChatMessage };
export { TaskDiscussionPanel as TaskChatPanel };
