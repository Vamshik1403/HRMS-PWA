"use client";

import { ShieldCheck } from "lucide-react";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";

export default function OtherPolicyPage() {
  return (
    <EmpDesktopPage
      title="IT Policy"
      description="Company IT usage and security policy."
      icon={ShieldCheck}
    >
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Coming soon.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          IT policy management will be available here shortly.
        </p>
      </div>
    </EmpDesktopPage>
  );
}
