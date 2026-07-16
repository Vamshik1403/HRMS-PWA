"use client";

import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { Icon } from "@iconify/react";

export default function EmpOnboardingPage() {
  return (
    <EmpMobileLayout>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center max-w-lg mx-auto mt-8">
        <div className="w-14 h-14 rounded-2xl bg-[#4f46e5]/10 text-[#4f46e5] flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:user-plus-bold-duotone" className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Onboarding</h1>
        <p className="text-sm text-gray-500 mt-2">
          Your onboarding checklist and documents will appear here. Contact HR if you need assistance
          getting started.
        </p>
      </div>
    </EmpMobileLayout>
  );
}
