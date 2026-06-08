"use client";

import { PageLayout } from "../components/layout/PageLayout";
import { BackupRestoreManagement } from "./BackupRestoreManagement";

export default function BackupRestorePage() {
  return (
    <PageLayout>
      <div className="space-y-4 w-full max-w-7xl mx-auto px-4">
        <p className="text-gray-600 text-sm">Manage system backup and restore</p>
        <BackupRestoreManagement />
      </div>
    </PageLayout>
  );
}
