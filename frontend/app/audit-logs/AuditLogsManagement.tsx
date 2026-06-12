"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { Download, Loader2, ScrollText } from "lucide-react";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";
import { authHeaders, getAccessToken } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type AuditRow = {
  id: number;
  username: string | null;
  userRole: string | null;
  employeeName: string | null;
  action: string;
  module: string;
  entityId: string | null;
  entityName: string | null;
  success: boolean;
  ipAddress: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  createdAt: string;
};

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN");
  } catch {
    return iso;
  }
}

export function AuditLogsManagement() {
  const user = useCurrentUser();
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      toast.error("Session expired. Please log in again.");
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (moduleFilter) params.set("module", moduleFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (usernameFilter) params.set("username", usernameFilter);
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(`${toDate}T23:59:59`).toISOString());

      const res = await fetch(`${BACKEND}/audit-logs?${params}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log out and log in again.");
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load audit logs");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, moduleFilter, actionFilter, usernameFilter, fromDate, toDate]);

  useEffect(() => {
    if (user?.role === "SUPERADMIN") void load();
  }, [user, load]);

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (moduleFilter) params.set("module", moduleFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (usernameFilter) params.set("username", usernameFilter);
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(`${toDate}T23:59:59`).toISOString());

      const res = await fetch(`${BACKEND}/audit-logs/export?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not export audit logs");
    }
  };

  if (user?.role !== "SUPERADMIN") {
    return (
      <div className="p-6 text-gray-500 text-sm">Only Super Admin can view audit logs.</div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-500">Module</label>
          <Input
            placeholder="e.g. AUTH, EMPLOYEE"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-500">Action</label>
          <Input
            placeholder="e.g. LOGIN, CREATE"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-500">User</label>
          <Input
            placeholder="Username"
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => { setPage(1); void load(); }}>
          Apply
        </Button>
        <Button onClick={() => void exportCsv()}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4" />
            Audit trail ({total} entries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">No audit entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableBodySkeleton cols={7} />
                  ) : items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {fmtWhen(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.username || "—"}
                        {row.userRole && (
                          <span className="block text-[10px] text-gray-400">{row.userRole}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            row.success === false
                              ? "text-red-600 font-medium"
                              : "text-gray-900 font-medium"
                          }
                        >
                          {row.action}
                        </span>
                      </TableCell>
                      <TableCell>{row.module}</TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate">
                        {row.entityName || row.entityId || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.ipAddress || "—"}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {[row.deviceType, row.os, row.browser].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
