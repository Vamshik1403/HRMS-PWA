"use client";

import dynamic from "next/dynamic";

const BranchManagement = dynamic(
  () => import("./BranchManagement").then((m) => m.BranchManagement),
  { ssr: false },
);

export default function BranchesPage() {
  return <BranchManagement />;
}
