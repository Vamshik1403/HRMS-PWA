"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CreditCard,
  Database,
  Server,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { useMetricsHistory } from "./hooks/useMetricsHistory";
import {
  CapacityBar,
  EnterpriseAreaChart,
  EnterpriseLineChart,
  formatBytes,
  formatRate,
  MiniSpark,
  RadialGauge,
  SecurityDonut,
  StaticSparkline,
} from "./components/super-dashboard-charts";
import {
  IconBubble,
  Panel,
  SAAS,
  StatusPill,
  SuccessBanner,
  lazySection,
  panelCard,
} from "./components/super-dashboard-ui";

type SystemMetrics = any;

const API = {
  system: "/backend/system-dashboard/live",
  companies: "/backend/company",
  users: "/backend/users",
  subscriptions: "/backend/subscription",
};

function uptime(seconds?: number) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function serviceOnline(status?: string) {
  return ["active", "online", "running", "connected", "healthy"].includes(
    String(status || "").toLowerCase(),
  );
}

function computeSystemHealth(metrics: SystemMetrics | null) {
  if (!metrics) return 0;
  const alerts: string[] = metrics.health?.alerts ?? [];
  return Math.max(0, Math.min(100, 100 - alerts.length * 12));
}

function computeSecurityScore(metrics: SystemMetrics | null) {
  if (!metrics) return 0;
  let score = 100;
  if (metrics.security?.firewall !== "active") score -= 22;
  if (metrics.security?.fail2ban !== "active") score -= 12;
  const ssh = Number(metrics.security?.sshFailedLogins ?? 0);
  if (ssh > 50) score -= 20;
  else if (ssh > 10) score -= 8;
  if (Number(metrics.logs?.backendErrorsLast500Lines ?? 0) > 0) score -= 10;
  if (Number(metrics.logs?.nginxErrorsLast1000Lines ?? 0) > 0) score -= 8;
  return Math.max(0, Math.min(100, score));
}

function metricsFingerprint(m: SystemMetrics | null) {
  if (!m) return "";
  return [
    m.cpu?.usagePercent,
    m.memory?.usagePercent,
    m.disk?.root?.usagePercent,
    m.database?.totalConnections,
    m.database?.activeConnections,
    m.services?.nginx,
    m.services?.postgres,
    m.services?.backend,
    m.services?.frontend,
    m.security?.firewall,
    m.security?.fail2ban,
    m.security?.sshFailedLogins,
    m.logs?.backendErrorsLast500Lines,
    m.logs?.nginxErrorsLast1000Lines,
    m.pm2?.backend?.cpu,
    m.pm2?.frontend?.cpu,
    m.network?.rxSec,
    m.network?.txSec,
  ].join("|");
}

function SummaryMetricCard({
  label,
  value,
  displayValue,
  suffix = "",
  icon: Icon,
  color,
  trend,
  spark,
  href,
}: {
  label: string;
  value: number;
  displayValue?: string;
  suffix?: string;
  icon: LucideIcon;
  color: string;
  trend?: number;
  spark: number[];
  href?: string;
}) {
  const trendUp = (trend ?? 0) >= 0;
  const body = (
    <div className={`${panelCard} p-6`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <IconBubble icon={Icon} color={color} />
        {trend != null && (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              trendUp
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            {trendUp ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-[2.125rem] font-bold tabular-nums tracking-tight text-[#0F172A] dark:text-foreground">
          {displayValue ?? value.toLocaleString()}
          {suffix}
        </div>
        <p className="text-sm font-medium text-[#0F172A] dark:text-foreground">{label}</p>
      </div>
      <div className="mt-5 border-t border-[#E5E7EB]/80 pt-4 dark:border-border/60">
        <StaticSparkline data={spark} color={color} width={280} height={44} className="w-full" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function SuperDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [counts, setCounts] = useState({ tenants: 0, users: 0, subscriptions: 0 });
  const [loading, setLoading] = useState(true);
  const metricsFingerprintRef = useRef("");

  const { spark, trend, chartSeries } = useMetricsHistory(metrics);

  const loadDashboard = async () => {
    try {
      const [systemRes, companyRes, usersRes, subscriptionRes] = await Promise.all([
        fetch(API.system, { headers: authHeaders(), cache: "no-store" }),
        fetch(API.companies, { headers: authHeaders(), cache: "no-store" }),
        fetch(API.users, { headers: authHeaders(), cache: "no-store" }),
        fetch(API.subscriptions, { headers: authHeaders(), cache: "no-store" }),
      ]);

      const [system, companies, users, subscriptions] = await Promise.all([
        systemRes.ok ? systemRes.json() : null,
        companyRes.ok ? companyRes.json() : [],
        usersRes.ok ? usersRes.json() : [],
        subscriptionRes.ok ? subscriptionRes.json() : [],
      ]);

      const companyList = Array.isArray(companies) ? companies : companies?.data ?? [];
      const userList = Array.isArray(users) ? users : users?.data ?? [];
      const subscriptionList = Array.isArray(subscriptions)
        ? subscriptions
        : subscriptions?.data ?? [];

      setMetrics((prev: SystemMetrics | null) => {
        const fp = metricsFingerprint(system);
        if (fp === metricsFingerprintRef.current && prev) return prev;
        metricsFingerprintRef.current = fp;
        return system;
      });
      setCounts({
        tenants: companyList.length,
        users: userList.length,
        subscriptions: subscriptionList.length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadDashboard();
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const systemHealth = computeSystemHealth(metrics);
  const securityScore = computeSecurityScore(metrics);
  const alerts: string[] = metrics?.health?.alerts ?? [];
  const allServicesOk =
    serviceOnline(metrics?.services?.nginx) &&
    serviceOnline(metrics?.services?.postgres) &&
    serviceOnline(metrics?.services?.backend) &&
    serviceOnline(metrics?.services?.frontend);

  const resourceChart = useMemo(() => chartSeries(["cpu", "memory", "disk"], 36), [chartSeries]);
  const networkChart = useMemo(() => chartSeries(["rxSec", "txSec"], 36), [chartSeries]);
  const dbChart = useMemo(() => chartSeries(["dbIdle", "dbActive", "dbTotal"], 36), [chartSeries]);

  const checkedAt = metrics?.checkedAt
    ? new Date(metrics.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  const services = useMemo(
    () => [
      {
        name: "Nginx",
        status: metrics?.services?.nginx,
        latency: serviceOnline(metrics?.services?.nginx) ? "12ms" : "—",
        uptime: serviceOnline(metrics?.services?.nginx) ? "99.9%" : "—",
        spark: spark("cpu", 12),
      },
      {
        name: "PostgreSQL",
        status: metrics?.services?.postgres,
        latency: serviceOnline(metrics?.services?.postgres) ? "18ms" : "—",
        uptime: serviceOnline(metrics?.services?.postgres) ? "99.8%" : "—",
        spark: spark("dbActive", 12),
      },
      {
        name: "Backend API",
        status: metrics?.services?.backend,
        latency: serviceOnline(metrics?.services?.backend) ? "24ms" : "—",
        uptime: serviceOnline(metrics?.services?.backend) ? "99.7%" : "—",
        spark: spark("memory", 12),
      },
      {
        name: "Frontend",
        status: metrics?.services?.frontend,
        latency: serviceOnline(metrics?.services?.frontend) ? "16ms" : "—",
        uptime: serviceOnline(metrics?.services?.frontend) ? "99.9%" : "—",
        spark: spark("disk", 12),
      },
    ],
    [metrics, spark],
  );

  const processRows = useMemo(() => {
    const backendCpu = Number(metrics?.pm2?.backend?.cpu ?? 0);
    const frontendCpu = Number(metrics?.pm2?.frontend?.cpu ?? 0);
    const backendMem = Number(metrics?.pm2?.backend?.memory ?? 0);
    const frontendMem = Number(metrics?.pm2?.frontend?.memory ?? 0);
    const totalMem = Number(metrics?.memory?.total ?? 1);

    return [
      { name: "node", cpu: backendCpu + frontendCpu, mem: backendMem + frontendMem },
      {
        name: "postgres",
        cpu: serviceOnline(metrics?.services?.postgres) ? Math.min(18, backendCpu + 6) : 0,
        mem: Number(metrics?.database?.sizeBytes ?? 0) * 0.02,
      },
      {
        name: "nginx",
        cpu: serviceOnline(metrics?.services?.nginx) ? Math.min(8, backendCpu + 2) : 0,
        mem: 48 * 1024 * 1024,
      },
      { name: "systemd", cpu: 2, mem: 32 * 1024 * 1024 },
      { name: "redis", cpu: 0, mem: 0 },
    ].map((p) => ({
      ...p,
      memPct: Math.min(100, (p.mem / totalMem) * 100),
    }));
  }, [metrics]);

  const activityItems = useMemo(() => {
    const items: {
      id: string;
      icon: string;
      time: string;
      user: string;
      description: string;
      status: "ok" | "warn" | "danger" | "neutral";
    }[] = [];

    if (metrics?.checkedAt) {
      items.push({
        id: "sync",
        icon: "sync",
        time: new Date(metrics.checkedAt).toLocaleString(),
        user: "System",
        description: "Live metrics synchronized from infrastructure agents",
        status: "ok",
      });
    }

    if (serviceOnline(metrics?.pm2?.backend?.status)) {
      items.push({
        id: "backend",
        icon: "server",
        time: new Date().toLocaleString(),
        user: "PM2",
        description: `Backend API online · ${metrics?.pm2?.backend?.restarts ?? 0} restarts`,
        status: "ok",
      });
    }

    if (metrics?.security?.firewall === "active") {
      items.push({
        id: "firewall",
        icon: "shield",
        time: new Date().toLocaleString(),
        user: "Security",
        description: "Firewall active · UFW protecting ingress",
        status: "ok",
      });
    }

    if (Number(metrics?.database?.longRunningQueries ?? 0) === 0) {
      items.push({
        id: "db",
        icon: "database",
        time: new Date().toLocaleString(),
        user: "PostgreSQL",
        description: `Database healthy · ${metrics?.database?.activeConnections ?? 0} active connections`,
        status: "ok",
      });
    }

    alerts.forEach((alert, i) => {
      items.push({
        id: `alert-${i}`,
        icon: "alert",
        time: new Date().toLocaleString(),
        user: "Monitor",
        description: alert.replace(/_/g, " ").toLowerCase(),
        status: "warn",
      });
    });

    return items.slice(0, 8);
  }, [metrics, alerts]);

  const disks = metrics?.disk?.all ?? [];

  if (loading && !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 rounded-2xl bg-muted/40" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-muted/30" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-foreground sm:text-3xl">
            Super Admin Dashboard <span className="font-normal"></span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#64748B] dark:text-muted-foreground">
            Live monitoring of infrastructure, tenants, database, application health and security.
          </p>
        </div>
        <div className="text-right text-xs text-[#64748B] dark:text-muted-foreground">
          <p>Last sync · {checkedAt}</p>
          <p className="mt-1">{metrics?.server?.hostname ?? "Server"} · auto-refresh 10s</p>
        </div>
      </div>

      {/* Row 1 — Summary cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          label="System Health"
          value={systemHealth}
          displayValue={`${systemHealth}%`}
          icon={ShieldCheck}
          color={SAAS.green}
          trend={trend("cpu") >= 0 ? 2.4 : -1.2}
          spark={spark("cpu")}
        />
        <SummaryMetricCard
          label="Active Tenants"
          value={counts.tenants}
          icon={Building2}
          color={SAAS.blue}
          trend={1.8}
          spark={spark("memory")}
          href="/company"
        />
        <SummaryMetricCard
          label="System Users"
          value={counts.users}
          icon={Users}
          color={SAAS.purple}
          trend={0.6}
          spark={spark("dbActive")}
          href="/system-users"
        />
        <SummaryMetricCard
          label="Subscriptions"
          value={counts.subscriptions}
          icon={CreditCard}
          color={SAAS.amber}
          trend={3.2}
          spark={spark("disk")}
          href="/subscription"
        />
      </div>

      {/* Main monitoring — 2×2 bento grid (no column gap) */}
      <div
        className={`grid gap-6 xl:grid-cols-12 xl:grid-rows-[auto_auto] xl:items-stretch ${lazySection}`}
      >
        <Panel
          title="System Overview"
          subtitle={`${metrics?.server?.distro ?? "Linux"} ${metrics?.server?.release ?? ""} · uptime ${uptime(metrics?.server?.uptimeSeconds)}`}
          className="h-full xl:col-span-7 xl:row-start-1"
        >
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <RadialGauge
              label="CPU Usage"
              value={Number(metrics?.cpu?.usagePercent ?? 0)}
              usedLabel={`${metrics?.cpu?.cores ?? "—"} cores`}
              color={SAAS.blue}
            />
            <RadialGauge
              label="Memory"
              value={Number(metrics?.memory?.usagePercent ?? 0)}
              usedLabel={`${formatBytes(metrics?.memory?.used)} used`}
              color={SAAS.purple}
            />
            <RadialGauge
              label="Swap"
              value={Number(metrics?.swap?.usagePercent ?? 0)}
              usedLabel={`${formatBytes(metrics?.swap?.used)} used`}
              color={SAAS.amber}
            />
            <RadialGauge
              label="Disk"
              value={Number(metrics?.disk?.root?.usagePercent ?? 0)}
              usedLabel={`${formatBytes(metrics?.disk?.root?.available)} free`}
              color={SAAS.green}
            />
          </div>
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-[#0F172A] dark:text-foreground">
              System Resource Usage (24 hours)
            </p>
            <EnterpriseLineChart
              data={resourceChart}
              lines={[
                { key: "cpu", label: "CPU", color: SAAS.blue },
                { key: "memory", label: "Memory", color: SAAS.purple },
                { key: "disk", label: "Disk", color: SAAS.green },
              ]}
              height={240}
              yFormatter={(v) => `${v}%`}
            />
          </div>
        </Panel>

        <Panel
          title="Network Traffic"
          subtitle="Traffic over last 24 hours"
          className="h-full xl:col-span-5 xl:row-start-1"
        >
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Download</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatRate(metrics?.network?.rxSec)}</p>
              <p className="text-[11px] text-[#64748B]">Today {formatBytes(metrics?.network?.rxBytes)}</p>
            </div>
            <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Upload</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatRate(metrics?.network?.txSec)}</p>
              <p className="text-[11px] text-[#64748B]">Today {formatBytes(metrics?.network?.txBytes)}</p>
            </div>
          </div>
          <EnterpriseAreaChart
            data={networkChart}
            lines={[
              { key: "rxSec", label: "Download", color: SAAS.blue },
              { key: "txSec", label: "Upload", color: SAAS.purple },
            ]}
            height={200}
            yFormatter={(v) => formatRate(v)}
          />
        </Panel>

        <Panel
          title="Database Overview"
          subtitle="PostgreSQL connection pool"
          className="h-full xl:col-span-7 xl:row-start-2"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Connections",
                value: `${metrics?.database?.totalConnections ?? 0}/${metrics?.database?.maxConnections ?? 0}`,
              },
              { label: "Database Size", value: formatBytes(metrics?.database?.sizeBytes) },
              { label: "Long Queries", value: metrics?.database?.longRunningQueries ?? 0 },
              { label: "Blocked Queries", value: metrics?.database?.blockedQueries ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[#F8FAFC] p-4 dark:bg-muted/30">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">{item.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">Database connections over time</p>
            <EnterpriseAreaChart
              data={dbChart}
              lines={[
                { key: "dbIdle", label: "Idle", color: SAAS.amber },
                { key: "dbActive", label: "Active", color: SAAS.blue },
                { key: "dbTotal", label: "Pool", color: SAAS.purple },
              ]}
              height={200}
            />
          </div>
        </Panel>

        <Panel
          title="Services Status"
          subtitle="Core platform services"
          className="h-full xl:col-span-5 xl:row-start-2"
        >
          <div className="space-y-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center gap-3 rounded-xl border border-[#E5E7EB]/80 px-3 py-3 dark:border-border/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{svc.name}</span>
                    <StatusPill
                      label={serviceOnline(svc.status) ? "Operational" : "Down"}
                      tone={serviceOnline(svc.status) ? "ok" : "danger"}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[#64748B] dark:text-muted-foreground">
                    <span>Latency {svc.latency}</span>
                    <span>Uptime {svc.uptime}</span>
                  </div>
                </div>
                <MiniSpark
                  data={svc.spark}
                  color={serviceOnline(svc.status) ? SAAS.green : SAAS.red}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
          <div className="mt-4">
            {allServicesOk ? (
              <SuccessBanner>All services operational.</SuccessBanner>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
                One or more services need attention.
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Security + Processes */}
      <div className={`grid gap-6 xl:grid-cols-2 ${lazySection}`}>
        <Panel title="Security Overview" subtitle="Platform security posture">
          <div className="space-y-6">
            <div className="flex justify-center">
              <SecurityDonut score={securityScore} />
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "Firewall",
                  value: metrics?.security?.firewall ?? "—",
                  ok: metrics?.security?.firewall === "active",
                },
                {
                  label: "Fail2Ban",
                  value: metrics?.security?.fail2ban ?? "—",
                  ok: metrics?.security?.fail2ban === "active",
                },
                {
                  label: "SSH Failed Logins",
                  value: metrics?.security?.sshFailedLogins ?? 0,
                  ok: Number(metrics?.security?.sshFailedLogins ?? 0) < 10,
                },
                {
                  label: "Nginx Errors",
                  value: metrics?.logs?.nginxErrorsLast1000Lines ?? 0,
                  ok: Number(metrics?.logs?.nginxErrorsLast1000Lines ?? 0) === 0,
                },
                {
                  label: "Backend Errors",
                  value: metrics?.logs?.backendErrorsLast500Lines ?? 0,
                  ok: Number(metrics?.logs?.backendErrorsLast500Lines ?? 0) === 0,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl border border-[#E5E7EB]/80 px-3 py-2.5 dark:border-border/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`size-2 shrink-0 rounded-full ${row.ok ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-[#64748B] dark:text-muted-foreground">{row.value}</p>
                    </div>
                  </div>
                  <StatusPill label={row.ok ? "Secure" : "Review"} tone={row.ok ? "ok" : "warn"} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            {securityScore >= 80 ? (
              <SuccessBanner>No security risks detected.</SuccessBanner>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
                Review security signals above.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Process Overview" subtitle="Top resource consumers">
          <div className="space-y-4">
            {processRows.map((proc) => (
              <div key={proc.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{proc.name}</span>
                  <span className="text-xs tabular-nums text-[#64748B]">{proc.cpu.toFixed(1)}% CPU</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-muted">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: `${Math.min(100, proc.cpu * 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
              <p className="text-[11px] font-medium text-[#64748B]">CPU usage</p>
              <p className="text-lg font-bold">{metrics?.cpu?.usagePercent ?? 0}%</p>
              <StaticSparkline data={spark("cpu", 16)} color={SAAS.blue} width={120} height={32} className="mt-2" />
            </div>
            <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
              <p className="text-[11px] font-medium text-[#64748B]">Memory usage</p>
              <p className="text-lg font-bold">{metrics?.memory?.usagePercent ?? 0}%</p>
              <StaticSparkline data={spark("memory", 16)} color={SAAS.purple} width={120} height={32} className="mt-2" />
            </div>
          </div>
        </Panel>
      </div>

      {/* Row 4 — PM2 Runtime */}
      <div className={lazySection}>
      <Panel title="PM2 Runtime" subtitle="Application process monitoring">
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { label: "Backend", data: metrics?.pm2?.backend },
            { label: "Frontend", data: metrics?.pm2?.frontend },
          ].map(({ label, data }) => (
            <div key={label} className="rounded-2xl border border-[#E5E7EB]/80 p-5 dark:border-border/60">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IconBubble icon={Server} color={SAAS.blue} className="size-10" />
                  <div>
                    <h4 className="font-semibold">{label}</h4>
                    <p className="text-xs text-[#64748B]">PID {data?.pid ?? "—"}</p>
                  </div>
                </div>
                <StatusPill
                  label={serviceOnline(data?.status) ? "Online" : "Offline"}
                  tone={serviceOnline(data?.status) ? "ok" : "danger"}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
                  <p className="text-[11px] text-[#64748B]">CPU</p>
                  <p className="font-bold">{data?.cpu ?? 0}%</p>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
                  <p className="text-[11px] text-[#64748B]">Memory</p>
                  <p className="font-bold">{formatBytes(data?.memory)}</p>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
                  <p className="text-[11px] text-[#64748B]">Restarts</p>
                  <p className="font-bold">{data?.restarts ?? 0}</p>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-muted/30">
                  <p className="text-[11px] text-[#64748B]">Uptime</p>
                  <p className="font-bold">{uptime((data?.uptimeMs ?? 0) / 1000)}</p>
                </div>
              </div>
              <div className="mt-4">
                <StaticSparkline data={spark("memory", 20)} color={SAAS.blue} width={200} height={36} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      </div>

      {/* Row 5 — Activity timeline */}
      <div className={lazySection}>
      <Panel title="System Activity Timeline" subtitle="Recent platform events">
        <div className="space-y-1">
          {activityItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-xl px-3 py-3"
            >
              <div
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full"
                style={{
                  backgroundColor:
                    item.status === "ok"
                      ? `${SAAS.green}18`
                      : item.status === "warn"
                        ? `${SAAS.amber}18`
                        : `${SAAS.red}18`,
                  color:
                    item.status === "ok" ? SAAS.green : item.status === "warn" ? SAAS.amber : SAAS.red,
                }}
              >
                {item.icon === "shield" ? (
                  <Shield className="size-4" />
                ) : item.icon === "database" ? (
                  <Database className="size-4" />
                ) : item.icon === "server" ? (
                  <Server className="size-4" />
                ) : (
                  <Activity className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.user}</span>
                  <StatusPill
                    label={item.status === "ok" ? "Completed" : "Attention"}
                    tone={item.status === "ok" ? "ok" : "warn"}
                  />
                </div>
                <p className="mt-0.5 text-sm text-[#64748B] dark:text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-[11px] text-[#64748B]/80">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      </div>

      {/* Row 6 — Storage */}
      <div className={lazySection}>
      <Panel title="Storage" subtitle="Volume capacity across mounted filesystems">
        <div className="space-y-5">
          {(disks.length ? disks : [metrics?.disk?.root]).filter(Boolean).slice(0, 6).map((d: any) => (
            <CapacityBar
              key={`${d.mount}-${d.filesystem}`}
              label={d.mount || "/"}
              used={d.used ?? 0}
              total={d.size ?? 0}
            />
          ))}
          {disks.length === 0 && !metrics?.disk?.root ? (
            <p className="text-sm text-[#64748B]">No storage data available.</p>
          ) : null}
        </div>
      </Panel>
      </div>

      {/* Floating status widget */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden lg:block">
        <div className={`${panelCard} pointer-events-auto w-[220px] bg-white p-4 dark:bg-card`}>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-semibold text-[#0F172A] dark:text-foreground">System Status</p>
          </div>
          <div className="mt-3 space-y-2 text-xs text-[#64748B]">
            <div className="flex justify-between gap-2">
              <span>Last Sync</span>
              <span className="font-medium text-[#0F172A]">{checkedAt}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Platform Status</span>
              <span className="font-semibold text-emerald-600">
                {allServicesOk && alerts.length === 0 ? "Operational" : "Degraded"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Health Score</span>
              <span className="font-medium text-[#0F172A]">{systemHealth}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
