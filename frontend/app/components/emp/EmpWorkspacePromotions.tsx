"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";

export function EmpWorkspacePromotions({ embedded = false }: { embedded?: boolean } = {}) {
  const { isManagerView } = useEmpManagerScope();

  if (!isManagerView) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
        Promotions and transfers are managed by your reporting manager.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Promotions & Transfer</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage career movements for your team members</p>
        </div>
      ) : null}
      <Link
        href="/empTeam/promotions"
        className="inline-flex items-center gap-2 bg-[#4f46e5] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4338ca] transition-colors"
      >
        <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5" />
        Open team promotions & transfers
      </Link>
    </div>
  );
}
