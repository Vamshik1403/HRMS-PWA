"use client";

import { FormModal } from "../ui/form-modal";
import { ManagerMemoComposeForm } from "./ManagerMemoComposeForm";

export function ManagerMemoComposeInline({
  open,
  onOpenChange,
  managerName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerName?: string;
  onSent: () => void;
}) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Send Message"
      description="Send a message to one or more team members"
    >
      <ManagerMemoComposeForm managerName={managerName} onSent={onSent} />
    </FormModal>
  );
}
