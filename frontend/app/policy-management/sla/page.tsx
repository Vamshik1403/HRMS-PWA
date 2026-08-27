"use client";

import { Suspense } from "react";
import { PolicyManagement } from "../PolicyManagement";

export default function SlaPolicyAdminPage() {
  return (
    <Suspense fallback={null}>
      <PolicyManagement defaultType="SLA" />
    </Suspense>
  );
}
