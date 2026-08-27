"use client";

import { Suspense } from "react";
import { PolicyManagement } from "./PolicyManagement";

function PolicyPageInner() {
  return <PolicyManagement />;
}

export default function PolicyManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading policies…</div>}>
      <PolicyPageInner />
    </Suspense>
  );
}
