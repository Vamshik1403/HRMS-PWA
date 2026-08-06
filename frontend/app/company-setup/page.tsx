"use client";

import { Sliders } from "lucide-react";
import { EmpSetupTabsGrid } from "@/app/components/emp/EmpSetupTabsGrid";
import { COMPANY_SETUP_TABS } from "@/app/components/layout/emp-setup-tabs-registry";

export default function CompanySetupPage() {
  return (
    <EmpSetupTabsGrid
      title="Company Setup"
      description="Branches, departments, designations, and company configuration."
      icon={Sliders}
      tabs={COMPANY_SETUP_TABS}
    />
  );
}
