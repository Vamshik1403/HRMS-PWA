"use client";

import { FormModal } from "../ui/form-modal";
import type { EmpManagerReportee } from "../../utils/empManagerDisplay";
import { ManagerMemoComposeForm } from "./ManagerMemoComposeForm";

export function ManagerMemoComposeInline({
  open,
  onOpenChange,
  reportees,
  managerName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportees: EmpManagerReportee[];
  managerName?: string;
  onSent: () => void;
}) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Send notice / warning"
      description="Send a notice, warning, or policy message to a team member"
      showBackButton
      backLabel="Back to messages"
      closeLabel="Cancel"
    >
      <ManagerMemoComposeForm
        reportees={reportees}
        managerName={managerName}
        onSent={onSent}
        onCancel={() => onOpenChange(false)}
      />
    </FormModal>
  );
}
