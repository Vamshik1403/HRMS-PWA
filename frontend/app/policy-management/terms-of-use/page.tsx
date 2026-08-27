"use client";

import { Suspense } from "react";
import { PolicyManagement } from "../PolicyManagement";

export default function TermsPolicyPage() {
  return (
    <Suspense fallback={null}>
      <PolicyManagement defaultType="TERMS_OF_USE" />
    </Suspense>
  );
}
