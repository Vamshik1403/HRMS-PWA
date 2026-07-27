"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Wallet } from "lucide-react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../../components/emp/EmpDesktopWorkspaceGate";
import { EmpDesktopPage } from "../../components/emp/desktop/EmpDesktopPage";
import { EmpReimbursementApplyForm } from "../../components/emp/EmpReimbursementApplyForm";
import { Button } from "../../components/ui/button";

export default function EmpReimbursementNewPage() {
  const router = useRouter();

  const goBack = () => router.back();
  const onSuccess = () => router.replace("/empReimbursement");

  const formCard = (
    <div className="rounded-2xl border border-[#cbd5e1] bg-card shadow-sm p-5 sm:p-6">
      <EmpReimbursementApplyForm onSuccess={onSuccess} onCancel={goBack} />
    </div>
  );

  const mobile = (
    <div className="px-4 pt-4 pb-8">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
      >
        <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        Back
      </button>
      <h1 className="text-[20px] font-bold text-gray-900 mb-1">New reimbursement</h1>
      <p className="text-[12px] text-gray-500 mb-5">Add expense lines and submit for approval.</p>
      {formCard}
    </div>
  );

  const desktop = (
    <EmpDesktopPage
      title="New reimbursement"
      description="Add expense lines and submit for approval."
      icon={Wallet}
      actions={
        <Button type="button" variant="outline" size="sm" onClick={goBack}>
          Back
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-2xl">{formCard}</div>
    </EmpDesktopPage>
  );

  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate workspace={desktop} mobile={mobile} />
    </EmpMobileLayout>
  );
}
