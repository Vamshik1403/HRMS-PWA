"use client";

import { ScrollText } from "lucide-react";
import { PageHeader } from "../components/app/page-header";
import { AuditLogsManagement } from "./AuditLogsManagement";

export default function AuditLogsPage() {
  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader icon={ScrollText} title="System Logs" />
      <AuditLogsManagement />
    </div>
  );
}
