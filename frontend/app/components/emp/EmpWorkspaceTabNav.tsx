"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  moduleTabHref,
  resolveModuleTab,
  type ModuleWorkspace,
} from "../layout/emp-portal-workspaces";

function WorkspaceTabBar({
  workspace,
  tabs,
  activeTab,
}: {
  workspace: ModuleWorkspace;
  tabs: { id: string; label: string }[];
  activeTab: string;
}) {
  return (
    <div className="shrink-0 bg-white border-b border-gray-200 emp-workspace-tabbar">
      <div className="px-4 flex items-center gap-1 overflow-x-auto">
        <span className="text-sm font-semibold text-gray-900 mr-4 whitespace-nowrap py-3 hidden sm:inline">
          {workspace.label}
        </span>
        <div className="flex gap-0.5 min-w-0 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={moduleTabHref(workspace.basePath, tab.id)}
                className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-[#4f46e5] text-[#4f46e5]"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EmpWorkspaceTabNav({
  workspace,
  tabs,
}: {
  workspace: ModuleWorkspace;
  tabs: { id: string; label: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveModuleTab(workspace, searchParams, pathname);

  return <WorkspaceTabBar workspace={workspace} tabs={tabs} activeTab={activeTab} />;
}

/** Full-width content area for workspace tab panels — admin desktop layout */
export function EmpWorkspaceContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter emp-workspace-content">
      {children}
    </div>
  );
}
