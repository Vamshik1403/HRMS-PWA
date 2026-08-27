"use client";

import { hasCompanyAccessFlag } from "@/lib/companyAccess";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EmpCompanyDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasCompanyAccessFlag() ? "/my-company" : "/empdashboard");
  }, [router]);

  return null;
}
