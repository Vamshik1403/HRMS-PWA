"use client";

import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";

export default function EmpMyTasksPage() {
  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-[22px] font-bold text-gray-900 mb-1">My Tasks</h1>
        <p className="text-[13px] text-gray-500 mb-8">Your assigned tasks and to-dos will appear here.</p>

        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Icon icon="solar:checklist-bold-duotone" className="w-9 h-9 text-blue-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-700">No tasks yet</p>
          <p className="text-[13px] text-gray-400 text-center max-w-[240px]">
            Tasks assigned by your manager will show up here.
          </p>
        </div>
      </div>
    </EmpMobileLayout>
  );
}
