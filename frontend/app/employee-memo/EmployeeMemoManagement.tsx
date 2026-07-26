"use client";

import { MessageSquare } from "lucide-react";
import { PageHeader } from "../components/app/page-header";
import { EmpProfileMessagingPanel } from "../components/emp/EmpProfileMessagingPanel";

/**
 * Admin / non-employee Internal Messaging — same WhatsApp-style UI as the
 * employee portal IM, with company-wide contacts for COMPANY_ADMIN and peers.
 */
export function EmployeeMemoManagement() {
  return (
    <div
      data-messaging-fit
      className="flex h-full min-h-0 w-full max-w-none flex-col gap-3 overflow-hidden animate-fade-in page-content-enter"
    >
      <PageHeader
        className="mb-0 shrink-0"
        icon={MessageSquare}
        title="Internal Messaging"
        description="Official messages to colleagues across your organisation"
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EmpProfileMessagingPanel active variant="admin" />
      </div>
    </div>
  );
}
