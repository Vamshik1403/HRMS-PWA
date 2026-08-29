"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";

function getDefaultHomeHref(): string {
  if (typeof window === "undefined") return "/empdashboard";
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const role = String(user?.role || "").toUpperCase();
    if (user?.type === "employee" || role === "EMPLOYEE") return "/empdashboard";
    if (role === "SUPERADMIN") return "/superdashboard";
    if (role === "COMPANY_ADMIN") return "/my-company";
    if (role === "SERVICE_PROVIDER" || role === "ADMIN" || role === "BRANCH_ADMIN") {
      return "/dashboard";
    }
  } catch {
    // fall through
  }
  return "/empdashboard";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="font-display text-2xl font-medium">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        This page hit an unexpected error. Try again or return to the dashboard.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = getDefaultHomeHref())}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
