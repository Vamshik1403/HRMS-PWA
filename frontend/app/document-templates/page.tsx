"use client";

import { FileEdit } from "lucide-react";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";

export default function DocumentTemplatesPage() {
  return (
    <EmpDesktopPage
      title="Document Templates"
      description="Design the layout and structure of offer letters, appointment letters, and other company documents."
      icon={FileEdit}
    >
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Coming soon.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Offer letter and appointment letter template builder will be available here shortly.
        </p>
      </div>
    </EmpDesktopPage>
  );
}
