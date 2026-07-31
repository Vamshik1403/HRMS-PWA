"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { Icon } from "@iconify/react";

const IM_HREF = "/empProfile?tab=messaging";

/**
 * Legacy /empNoticeboard — redirects to the new chat-style Internal Messaging UI.
 * Old form-modal compose (Send notice / warning) is retired.
 */
export default function EmpNoticeboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(IM_HREF);
  }, [router]);

  return (
    <EmpMobileLayout>
      <div className="flex min-h-[50vh] items-center justify-center">
        <Icon icon="solar:refresh-bold-duotone" className="size-8 animate-spin text-blue-400" />
      </div>
    </EmpMobileLayout>
  );
}
