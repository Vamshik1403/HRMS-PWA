"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Icon } from "@iconify/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useCurrentUser } from "../hooks/useCurrentUser";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface DashboardData {
  date: string;
  defaultTokenEnabled: boolean;
  checkin: number;
  tokenAssigned: number;
  tokenCancel: number;
  tokenConsumed: number;
  tokenNotConsumed: number;
}

interface EmployeeRow {
  user_id: string;
  username: string;
  manage_employee_id: number | null;
  punch_time: string;
  device_sn?: string;
  device_name?: string;
}

type DetailType = "checkin" | "token-assigned" | "token-cancel" | "token-consumed" | "token-not-consumed" | null;

export function CanteenDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailType, setDetailType] = useState<DetailType>(null);
  const [detailData, setDetailData] = useState<EmployeeRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const user = useCurrentUser();

  // Non-SUPERADMIN users see only their company's data
  const companyParam = user && user.role !== "SUPERADMIN" && user.companyID
    ? `&companyId=${user.companyID}` : "";

  const fetchDashboard = async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/canteen/dashboard?date=${d}${companyParam}`, { cache: "no-store" });
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (type: DetailType) => {
    if (!type) return;
    setDetailLoading(true);
    setDetailType(type);
    try {
      const res = await fetch(`${BACKEND_URL}/canteen/dashboard/${type}?date=${date}${companyParam}`, { cache: "no-store" });
      const data = await res.json();
      setDetailData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setDetailData([]);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(date);
  }, [date, companyParam]);

  const cards = dashboard
    ? [
        { label: "Check In", value: dashboard.checkin, icon: "mdi:login", color: "from-blue-500 to-blue-600", type: "checkin" as DetailType },
        { label: "Token Assigned", value: dashboard.tokenAssigned, icon: "mdi:ticket-confirmation-outline", color: "from-green-500 to-green-600", type: "token-assigned" as DetailType },
        ...(dashboard.defaultTokenEnabled
          ? [{ label: "Token Cancel", value: dashboard.tokenCancel, icon: "mdi:cancel", color: "from-orange-500 to-orange-600", type: "token-cancel" as DetailType }]
          : []),
        { label: "Token Consumed", value: dashboard.tokenConsumed, icon: "mdi:check-circle-outline", color: "from-emerald-500 to-emerald-600", type: "token-consumed" as DetailType },
        { label: "Token Not Consumed", value: dashboard.tokenNotConsumed, icon: "mdi:close-circle-outline", color: "from-red-500 to-red-600", type: "token-not-consumed" as DetailType },
      ]
    : [];

  const detailTitle = detailType
    ? {
        checkin: "Check In Employees",
        "token-assigned": "Token Assigned Employees",
        "token-cancel": "Token Cancel Employees",
        "token-consumed": "Token Consumed Employees",
        "token-not-consumed": "Token Not Consumed Employees",
      }[detailType]
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-1">
            {dashboard?.defaultTokenEnabled
              ? "Default Token: Enabled — All check-in employees are assigned tokens by default"
              : "Default Token: Disabled — Employees must register via Token Register device"}
          </p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setDetailType(null); }}
          className="w-44"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${dashboard?.defaultTokenEnabled ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
            {cards.map((c) => (
              <div
                key={c.label}
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.color} p-5 text-white cursor-pointer hover:shadow-lg transition-shadow`}
                onClick={() => fetchDetail(c.type)}
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-14 h-14 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-white/80">{c.label}</p>
                    <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
                      <Icon icon={c.icon} className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold tracking-tight tabular-nums">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {detailType && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setDetailType(null)}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <CardTitle>{detailTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {detailLoading ? (
                  <p className="text-gray-500">Loading...</p>
                ) : detailData.length === 0 ? (
                  <p className="text-gray-500">No records found.</p>
                ) : (
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Punch Time</TableHead>
                          {detailType === "checkin" && <TableHead>Device</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.map((row, i) => (
                          <TableRow key={`${row.user_id}-${i}`}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{row.user_id}</TableCell>
                            <TableCell>{row.username || "-"}</TableCell>
                            <TableCell>
                              {row.punch_time
                                ? (() => {
                                    // punch_time is stored as naive timestamp (IST) but API appends Z.
                                    // Strip the Z/timezone so it displays as-is without conversion.
                                    const raw = row.punch_time.replace("Z", "").replace(/[+-]\d{2}:\d{2}$/, "");
                                    const d = new Date(raw);
                                    return d.toLocaleString("en-IN", {
                                      year: "numeric",
                                      month: "numeric",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                      second: "2-digit",
                                      hour12: true,
                                    });
                                  })()
                                : "-"}
                            </TableCell>
                            {detailType === "checkin" && (
                              <TableCell>{row.device_name || row.device_sn || "-"}</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
