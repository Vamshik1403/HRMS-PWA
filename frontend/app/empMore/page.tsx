"use client";

import { Suspense } from "react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpMoreServicesGrid } from "../components/emp/EmpMoreServicesGrid";

export default function EmpMorePage() {
  return (
    <EmpMobileLayout>
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
        <EmpMoreServicesGrid />
      </Suspense>
    </EmpMobileLayout>
  );
}
