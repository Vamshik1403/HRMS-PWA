"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Plus, Search, X } from "lucide-react";
import { MobileTaskListCard, MobileTaskListItem, MobileTaskListSkeleton } from "./MobileTaskListCard";

export function MobileTaskListView({
  tasks,
  loading,
  searchQuery,
  onSearchChange,
  onTaskClick,
  onCheckInOut,
  onViewInfo,
  onCreateClick,
  showCreateFab = true,
}: {
  tasks: MobileTaskListItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTaskClick: (task: MobileTaskListItem) => void;
  onCheckInOut?: (task: MobileTaskListItem) => void;
  onViewInfo?: (task: MobileTaskListItem) => void;
  onCreateClick?: () => void;
  showCreateFab?: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.taskName.toLowerCase().includes(q) ||
        String(t.id).includes(q) ||
        t.taskCode.toLowerCase().includes(q) ||
        (t.customer?.customerName || "").toLowerCase().includes(q) ||
        (t.site?.branchName || "").toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">
      <header className="sticky top-0 z-10 bg-[#f8f9fb]/95 backdrop-blur-md px-4 pt-2 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">Tasks</h1>
            <p className="text-[12px] text-gray-500 mt-1">Assigned tasks</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              searchOpen ? "bg-[#4f46e5] text-white" : "bg-white text-gray-600 shadow-sm border border-gray-100"
            }`}
            aria-label="Search"
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>
        <div className={`overflow-hidden transition-all ${searchOpen ? "max-h-14 opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-gray-100 text-[14px]"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 px-3 pt-2 pb-28">
        {loading ? (
          <MobileTaskListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center px-6">
            <Icon icon="solar:clipboard-list-linear" className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-[15px] font-semibold text-gray-800">No tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <MobileTaskListCard
                key={t.id}
                task={t}
                onOpenChat={() => onTaskClick(t)}
                onCheckInOut={onCheckInOut ? () => onCheckInOut(t) : undefined}
                onViewInfo={onViewInfo ? () => onViewInfo(t) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateFab && onCreateClick && (
        <button
          type="button"
          onClick={onCreateClick}
          className="mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#4f46e5] text-white shadow-lg flex items-center justify-center active:scale-90"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
          aria-label="New task"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
