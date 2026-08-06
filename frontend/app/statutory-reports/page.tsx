"use client";

import { ScrollText } from "lucide-react";
import { EmpSetupTabsGrid } from "@/app/components/emp/EmpSetupTabsGrid";
import { STATUTORY_REPORTS_TABS } from "@/app/components/layout/emp-setup-tabs-registry";

export default function StatutoryReportsPage() {
  return (
    <EmpSetupTabsGrid
      title="Statutory Reports & Challans"
      description="PF, ESI, and PT statutory challans."
      icon={ScrollText}
      tabs={STATUTORY_REPORTS_TABS}
    />
  );
}
