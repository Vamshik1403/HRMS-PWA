"use client";

import { Suspense } from "react";
import { PolicyManagement } from "../PolicyManagement";

export default function PrivacyPolicyAdminPage() {
  return (
    <Suspense fallback={null}>
      <PolicyManagement defaultType="PRIVACY_POLICY" />
    </Suspense>
  );
}
