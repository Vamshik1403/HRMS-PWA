import { AuditLogsManagement } from "./AuditLogsManagement";

export default function AuditLogsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Desktop admin activity only (excludes PWA / push notification noise).
        </p>
      </div>
      <AuditLogsManagement />
    </>
  );
}
