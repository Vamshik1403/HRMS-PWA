"use client";

import { AttendanceReportsManagement } from './AttendanceReportsManagement'
import { useCurrentUser } from "../hooks/useCurrentUser";

export default function AttendanceReportsPage() {
  const user = useCurrentUser();
  const mode = user?.role === "ADMIN" ? "factual" : "actual";

  return (
    <AttendanceReportsManagement mode={mode} />
  )
}
