"use client";

import { FileText } from "lucide-react";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";

export default function FormsPage() {
  return (
    <EmpDesktopPage
      title="Forms"
      description="Digital copies of statutory and HR forms, such as Form 16."
      icon={FileText}
    >
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Coming soon.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Digital form copies (Form 16 and others) will be available here shortly.
        </p>
      </div>
    </EmpDesktopPage>
  );
}
