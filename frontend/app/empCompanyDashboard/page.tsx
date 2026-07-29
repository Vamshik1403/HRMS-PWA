"use client";

import { EmpCompanyEnterpriseHome } from "@/app/components/emp/EmpCompanyEnterpriseHome";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { hasCompanyAccessFlag } from "@/lib/companyAccess";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import EmpMobileLayout from "@/app/components/layout/EmpMobileLayout";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";

export default function EmpCompanyDashboardPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const isDesktop = useEmpPortalDesktop();

  useEffect(() => {
    if (!hasCompanyAccessFlag()) {
      router.replace("/empdashboard");
    }
  }, [router]);

  const name =
    (user as any)?.employee?.firstName ||
    (user as any)?.firstName ||
    (user as any)?.username ||
    "Owner";

  const body = <EmpCompanyEnterpriseHome firstName={name} />;

  if (isDesktop) return body;
  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-8">
        <h1 className="text-[22px] font-bold text-foreground mb-4">Company Dashboard</h1>
        {body}
      </div>
    </EmpMobileLayout>
  );
}
