"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rights & Permissions now lives inside each employee's form modal
 * (Manage Employees → edit employee → "Rights & Permissions" tab).
 * This route is kept only to gracefully redirect any old bookmarks/links.
 */
export default function EmpRightsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/manage-employees");
  }, [router]);

  return null;
}
