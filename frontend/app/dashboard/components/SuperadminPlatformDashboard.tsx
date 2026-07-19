"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  ShieldCheck,
  GitBranch,
  Briefcase,
  UserCog,
  Fingerprint,
  TrendingUp,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { StatCard, type StatCardData } from "./StatCard";

function EmptyHint({ message = "Nothing yet." }: { message?: string }) {
  return <div className="text-sm text-muted-foreground py-3 text-center">{message}</div>;
}

export function SuperadminPlatformDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    serviceProviders: 0,
    companies: 0,
    users: 0,
    employees: 0,
    companyAdmins: 0,
    branches: 0,
    activeUsers: 0,
    devices: 0,
  });
  const [recentCompanies, setRecentCompanies] = useState<any[]>([]);
  const [recentProviders, setRecentProviders] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const headers = authHeaders();
        const [spRes, compRes, usersRes, empRes, branchRes, deviceRes] = await Promise.all([
          fetch("/backend/service-provider", { headers }),
          fetch("/backend/company", { headers }),
          fetch("/backend/users", { headers }),
          fetch("/backend/manage-employee", { headers }),
          fetch("/backend/branches", { headers }),
          fetch("/backend/devices", { headers }),
        ]);

        const sps = spRes.ok ? await spRes.json() : [];
        const compJson = compRes.ok ? await compRes.json() : [];
        const companies = Array.isArray(compJson) ? compJson : compJson?.data ?? [];
        const users = usersRes.ok ? await usersRes.json() : [];
        const employees = empRes.ok ? await empRes.json() : [];
        const branches = branchRes.ok ? await branchRes.json() : [];
        const devices = deviceRes.ok ? await deviceRes.json() : [];

        const userList = Array.isArray(users) ? users : [];
        const activeUsers = userList.filter((u: any) => u.isActive !== false).length;
        const companyAdmins = userList.filter((u: any) => u.role === "COMPANY_ADMIN" || u.role === "ADMIN").length;

        if (cancelled) return;

        setStats({
          serviceProviders: Array.isArray(sps) ? sps.length : 0,
          companies: companies.length,
          users: userList.length,
          employees: Array.isArray(employees) ? employees.length : 0,
          companyAdmins,
          branches: Array.isArray(branches) ? branches.length : 0,
          activeUsers,
          devices: Array.isArray(devices) ? devices.length : 0,
        });

        setRecentCompanies([...companies].slice(-5).reverse());
        setRecentProviders([...(Array.isArray(sps) ? sps : [])].slice(-5).reverse());
        setRecentUsers(
          [...userList]
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 5),
        );
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards: StatCardData[] = useMemo(
    () => [
      {
        label: "Service providers",
        value: stats.serviceProviders,
        unit: "Platform partners",
        icon: Building2,
        visualization: {
          type: "funnel",
          items: [
            { label: "Providers", value: stats.serviceProviders, color: "#2563eb" },
            { label: "Tenants", value: stats.companies, color: "#7c3aed" },
            { label: "Branches", value: stats.branches, color: "#14b8a6" },
          ],
        },
      },
      {
        label: "Total tenants",
        value: stats.companies,
        unit: "All companies",
        icon: TrendingUp,
        visualization: {
          type: "sparkline",
          data: [Math.max(1, stats.companies - 2), stats.companies - 1, stats.companies],
          color: "#7c3aed",
        },
      },
      {
        label: "Active users",
        value: stats.activeUsers,
        unit: "Enabled accounts",
        icon: Users,
        visualization: {
          type: "stacked",
          segments: [
            { label: "Active", value: stats.activeUsers, color: "#22c55e" },
            { label: "Inactive", value: Math.max(0, stats.users - stats.activeUsers), color: "#94a3b8" },
          ],
        },
      },
      {
        label: "Total employees",
        value: stats.employees,
        unit: "Workforce records",
        icon: Briefcase,
        visualization: {
          type: "bars",
          items: [
            { label: "Employees", value: stats.employees, color: "#2563eb" },
            { label: "Admins", value: stats.companyAdmins, color: "#7c3aed" },
          ],
        },
      },
      {
        label: "System users",
        value: stats.users,
        unit: "All accounts",
        icon: UserCog,
        visualization: {
          type: "donut",
          segments: [
            { label: "Active", value: stats.activeUsers, color: "#22c55e" },
            { label: "Admins", value: stats.companyAdmins, color: "#2563eb" },
            { label: "Other", value: Math.max(0, stats.users - stats.activeUsers), color: "#94a3b8" },
          ],
        },
      },
      {
        label: "Company admins",
        value: stats.companyAdmins,
        unit: "Admin accounts",
        icon: ShieldCheck,
        visualization: {
          type: "ring",
          value: stats.users > 0 ? Math.round((stats.companyAdmins / stats.users) * 100) : 0,
          max: 100,
          color: "#2563eb",
        },
      },
      {
        label: "Branches",
        value: stats.branches,
        unit: "Locations",
        icon: GitBranch,
        visualization: {
          type: "progress",
          segments: [
            { label: "Branches", value: stats.branches, color: "#14b8a6" },
            { label: "Tenants", value: stats.companies, color: "#2563eb" },
          ],
        },
      },
      {
        label: "Devices",
        value: stats.devices,
        unit: "Registered devices",
        icon: Fingerprint,
        visualization: {
          type: "sparkline",
          data: [stats.devices, stats.devices, stats.devices],
          color: "#f59e0b",
        },
      },
    ],
    [stats],
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[190px] rounded-xl border bg-muted/30" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl border bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent tenants</CardTitle>
            <CardDescription>Latest companies onboarded</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentCompanies.length === 0 ? (
              <EmptyHint />
            ) : (
              recentCompanies.map((c) => (
                <Link
                  key={c.id}
                  href="/company"
                  className="flex items-center justify-between rounded-md p-2 -mx-2 hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.companyName || `Company ${c.id}`}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">ID {c.id}</div>
                  </div>
                  <Badge variant="secondary">tenant</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service providers</CardTitle>
            <CardDescription>Platform partners</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentProviders.length === 0 ? (
              <EmptyHint />
            ) : (
              recentProviders.map((sp) => (
                <Link
                  key={sp.id}
                  href="/service-providers"
                  className="flex items-center justify-between rounded-md p-2 -mx-2 hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{sp.companyName || `SP ${sp.id}`}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{sp.emailAdd || sp.contactNo || "—"}</div>
                  </div>
                  <Badge variant="default">SP</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent users</CardTitle>
            <CardDescription>Latest accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUsers.length === 0 ? (
              <EmptyHint />
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="text-sm py-1">
                  <div className="font-medium truncate">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {u.role} · {u.username}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
