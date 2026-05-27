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
  onCreateClick,
}: {
  tasks: MobileTaskListItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTaskClick: (task: MobileTaskListItem) => void;
  onCreateClick: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.taskName.toLowerCase().includes(q) ||
        t.taskCode.toLowerCase().includes(q) ||
        (t.customer?.customerName || "").toLowerCase().includes(q) ||
        (t.site?.branchName || "").toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-[#f8f9fb]/95 backdrop-blur-md px-4 pt-2 pb-2 border-b border-transparent">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">Tasks</h1>
            <p className="text-[12px] text-gray-500 mt-1">Assigned tasks</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
              searchOpen ? "bg-[#4f46e5] text-white" : "bg-white text-gray-600 shadow-sm border border-gray-100 active:scale-95"
            }`}
            aria-label="Search"
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>

        {/* Search bar */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            searchOpen ? "max-h-14 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
          }`}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks…"
              autoFocus={searchOpen}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-gray-100 text-[14px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/25 focus:border-[#4f46e5]/40 transition-shadow"
            />
          </div>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 px-3 pt-2 pb-28">
        {loading ? (
          <MobileTaskListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-[20px] bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-4">
              <Icon icon="solar:clipboard-list-linear" className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800">
              {searchQuery ? "No matching tasks" : "No tasks yet"}
            </p>
            <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
              {searchQuery
                ? "Try a different search term"
                : "Tasks assigned to you will show up here"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <MobileTaskListCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={onCreateClick}
        className="mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#4f46e5] text-white shadow-lg shadow-[#4f46e5]/35 flex items-center justify-center active:scale-90 transition-transform duration-150"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        aria-label="New task"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}
