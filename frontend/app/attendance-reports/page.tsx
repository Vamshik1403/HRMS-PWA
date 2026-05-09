"use client";

import { AttendanceReportsManagement } from './AttendanceReportsManagement'
import { PageLayout } from "../components/layout/PageLayout";
import { useCurrentUser } from "../hooks/useCurrentUser";

export default function AttendanceReportsPage() {
  const user = useCurrentUser();
  const mode = user?.role === "ADMIN" ? "factual" : "actual";

  return (
    <PageLayout>
      <AttendanceReportsManagement mode={mode} />
    </PageLayout>
  )
}
