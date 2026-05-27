"use client";

import { useState } from "react";
import { Activity, MessageSquare } from "lucide-react";
import { TaskDiscussionPanel } from "./TaskDiscussionPanel";
import { TaskActivityTimeline } from "./TaskActivityTimeline";
import type { TaskActivity, TaskChatMessage } from "./task-types";

export type TaskDetailTab = "discussion" | "activity";

interface TaskDetailTabsProps {
  chats: TaskChatMessage[];
  activities: TaskActivity[];
  currentUserName?: string;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  footer?: React.ReactNode;
  compact?: boolean;
  fluid?: boolean;
  className?: string;
  showComposer?: boolean;
}

export function TaskDetailTabs({
  chats,
  activities,
  currentUserName,
  message,
  onMessageChange,
  onSend,
  sending,
  placeholder = "Write a reply…",
  footer,
  compact = false,
  fluid = false,
  className = "",
  showComposer = true,
}: TaskDetailTabsProps) {
  const [tab, setTab] = useState<TaskDetailTab>("discussion");
  const displayActivities = activities.filter((a) => a.action !== "CHAT");
  const activityCount = displayActivities.length;

  return (
    <div className={className}>
      <div className="flex w-full sm:w-auto p-0.5 rounded-lg bg-gray-100/80 border border-gray-200/60 mb-3">
        <button
          type="button"
          onClick={() => setTab("discussion")}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-md text-[12px] font-medium transition-all ${
            tab === "discussion"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Discussion
          {chats.length > 0 && (
            <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
              tab === "discussion" ? "bg-gray-100 text-gray-600" : "text-gray-400"
            }`}>
              {chats.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("activity")}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-md text-[12px] font-medium transition-all ${
            tab === "activity"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Activity
          {activityCount > 0 && (
            <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
              tab === "activity" ? "bg-gray-100 text-gray-600" : "text-gray-400"
            }`}>
              {activityCount}
            </span>
          )}
        </button>
      </div>

      {tab === "discussion" ? (
        <TaskDiscussionPanel
          chats={chats}
          currentUserName={currentUserName}
          message={message}
          onMessageChange={onMessageChange}
          onSend={onSend}
          sending={sending}
          placeholder={placeholder}
          footer={footer}
          compact={compact}
          fluid={fluid}
          showComposer={showComposer}
          hideHeader
        />
      ) : (
        <TaskActivityTimeline
          activities={displayActivities}
          maxHeight={compact ? "max-h-[420px]" : "max-h-[480px]"}
          showEmpty
        />
      )}
    </div>
  );
}
