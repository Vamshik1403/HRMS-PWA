"use client";

import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { EmpTeamApprovalsPanel } from "./EmpTeamApprovalsPanel";

export function EmpWorkspaceApprovals({ embedded = false }: { embedded?: boolean } = {}) {
  const { isManagerView } = useEmpManagerScope();

  return (
    <EmpTeamApprovalsPanel
      embedded={embedded}
      title="Approvals"
      description={
        isManagerView
          ? "Review pending requests from your team or your own submissions"
          : "Track your pending leave and reimbursement requests"
      }
      emptyMessage="No pending approvals."
      noAccessMessage="No pending leave or reimbursement requests."
      includeOwnSubmissions
      allowNewRequest
    />
  );
}
