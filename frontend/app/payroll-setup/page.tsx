"use client";

import { Wallet } from "lucide-react";
import { EmpSetupTabsGrid } from "@/app/components/emp/EmpSetupTabsGrid";
import { PAYROLL_SETUP_TABS } from "@/app/components/layout/emp-setup-tabs-registry";

export default function PayrollSetupPage() {
  return (
    <EmpSetupTabsGrid
      title="Payroll Setup"
      description="Paygrade components and statutory compliance setup."
      icon={Wallet}
      tabs={PAYROLL_SETUP_TABS}
    />
  );
}
