import { Suspense } from "react";
import { ManageEmployeesManagement } from "./ManageEmployeesManagement";

export default function ManageEmployeesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ManageEmployeesManagement />
    </Suspense>
  );
}
