"use client";

import { ClipboardList } from "lucide-react";
import { EmpSetupTabsGrid } from "@/app/components/emp/EmpSetupTabsGrid";
import { POLICY_SETUP_TABS } from "@/app/components/layout/emp-setup-tabs-registry";

export default function PolicySetupPage() {
  return (
    <EmpSetupTabsGrid
      title="Policy Setup"
      description="Work shifts, attendance, and leave policies."
      icon={ClipboardList}
      tabs={POLICY_SETUP_TABS}
    />
  );
}
