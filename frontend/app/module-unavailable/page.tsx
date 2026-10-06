"use client";

import Link from "next/link";

export default function ModuleUnavailablePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Module not included</h1>
        <p className="text-sm text-muted-foreground">
          This module is not included in your company&apos;s subscription.
        </p>
        <Link href="/empdashboard" className="inline-block text-sm font-medium text-primary">
          Back to home
        </Link>
      </div>
    </main>
  );
}
