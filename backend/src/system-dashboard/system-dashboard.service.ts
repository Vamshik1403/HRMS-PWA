import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';

const execAsync = promisify(exec);

@Injectable()
export class SystemDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async runCmd(command: string) {
    try {
      const { stdout } = await execAsync(command, { timeout: 5000 });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  private async serviceStatus(name: string) {
    const out = await this.runCmd(`systemctl is-active ${name}`);
    return out || 'inactive';
  }

  private async pm2App(name: string) {
    try {
      const stdout = await this.runCmd('pm2 jlist');
      const apps = JSON.parse(stdout || '[]');
      const app = apps.find((a: any) => a.name === name);

      if (!app) {
        return {
          name,
          status: 'offline',
          cpu: 0,
          memory: 0,
          restarts: 0,
          uptimeMs: 0,
          pid: null,
        };
      }

      return {
        name,
        status: app?.pm2_env?.status ?? 'offline',
        cpu: Number(app?.monit?.cpu ?? 0),
        memory: Number(app?.monit?.memory ?? 0),
        restarts: Number(app?.pm2_env?.restart_time ?? 0),
        uptimeMs: app?.pm2_env?.pm_uptime
          ? Date.now() - Number(app.pm2_env.pm_uptime)
          : 0,
        pid: app?.pid ?? null,
      };
    } catch {
      return {
        name,
        status: 'offline',
        cpu: 0,
        memory: 0,
        restarts: 0,
        uptimeMs: 0,
        pid: null,
      };
    }
  }

  private async getDatabaseMetrics() {
    try {
      const activity: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS total_connections,
          COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
          COUNT(*) FILTER (WHERE state = 'idle')::int AS idle_connections,
          COUNT(*) FILTER (
            WHERE state = 'active'
            AND now() - query_start > interval '30 seconds'
          )::int AS long_running_queries
        FROM pg_stat_activity;
      `);

      const dbSize: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT pg_database_size(current_database())::bigint AS size_bytes;
      `);

      const maxConn: any[] = await this.prisma.$queryRawUnsafe(`
        SHOW max_connections;
      `);

      const locks: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total_locks
        FROM pg_locks
        WHERE NOT granted;
      `);

      return {
        status: 'connected',
        totalConnections: Number(activity?.[0]?.total_connections ?? 0),
        activeConnections: Number(activity?.[0]?.active_connections ?? 0),
        idleConnections: Number(activity?.[0]?.idle_connections ?? 0),
        maxConnections: Number(maxConn?.[0]?.max_connections ?? 0),
        longRunningQueries: Number(activity?.[0]?.long_running_queries ?? 0),
        blockedQueries: Number(locks?.[0]?.total_locks ?? 0),
        sizeBytes: Number(dbSize?.[0]?.size_bytes ?? 0),
      };
    } catch {
      return {
        status: 'error',
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: 0,
        longRunningQueries: 0,
        blockedQueries: 0,
        sizeBytes: 0,
      };
    }
  }

  private async getSecurityMetrics() {
  const firewallStatus = await this.serviceStatus('ufw');
  const fail2banStatus = await this.serviceStatus('fail2ban');

  const fail2banRaw =
    fail2banStatus === 'active'
      ? await this.runCmd('sudo fail2ban-client status')
      : '';

  const sshFailedRaw = await this.runCmd(
    `sudo grep "Failed password" /var/log/auth.log 2>/dev/null | wc -l`,
  );

  const bannedJails =
    fail2banRaw
      .split('\n')
      .find((line) => line.toLowerCase().includes('jail list'))
      ?.split(':')?.[1]
      ?.split(',')
      ?.map((x) => x.trim())
      ?.filter(Boolean) ?? [];

  let totalBanned = 0;

  for (const jail of bannedJails) {
    const jailStatus = await this.runCmd(`sudo fail2ban-client status ${jail}`);
    const bannedLine = jailStatus
      .split('\n')
      .find((line) => line.toLowerCase().includes('currently banned'));

    totalBanned += Number(bannedLine?.replace(/\D/g, '') || 0);
  }

  return {
    firewall: firewallStatus,
    fail2ban: fail2banStatus,
    fail2banJails: bannedJails,
    bannedIps: totalBanned,
    sshFailedLogins: Number(sshFailedRaw || 0),
  };
}

  private async getNginxMetrics() {
    const status = await this.serviceStatus('nginx');

    // Optional. Works only if nginx stub_status is enabled.
    const raw = await this.runCmd('curl -s http://127.0.0.1/nginx_status');

    const activeMatch = raw.match(/Active connections:\s*(\d+)/i);
    const reqMatch = raw.match(/\s(\d+)\s+(\d+)\s+(\d+)\s/);
    const rwMatch = raw.match(/Reading:\s*(\d+)\s*Writing:\s*(\d+)\s*Waiting:\s*(\d+)/i);

    return {
      status,
      activeConnections: Number(activeMatch?.[1] ?? 0),
      accepts: Number(reqMatch?.[1] ?? 0),
      handled: Number(reqMatch?.[2] ?? 0),
      requests: Number(reqMatch?.[3] ?? 0),
      reading: Number(rwMatch?.[1] ?? 0),
      writing: Number(rwMatch?.[2] ?? 0),
      waiting: Number(rwMatch?.[3] ?? 0),
    };
  }

  private async getLogMetrics() {
    const backendErrors = await this.runCmd(
      `pm2 logs hrms-backend --nostream --lines 500 2>/dev/null | grep -iE "error|exception|failed" | wc -l`,
    );

    const nginxErrors = await this.runCmd(
      `sudo tail -n 1000 /var/log/nginx/error.log 2>/dev/null | grep -iE "error|crit|alert|emerg" | wc -l`,
    );

    return {
      backendErrorsLast500Lines: Number(backendErrors || 0),
      nginxErrorsLast1000Lines: Number(nginxErrors || 0),
    };
  }

  async getLiveMetrics() {
    const [cpu, mem, disks, netStats, os, time, processes, load] =
      await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.osInfo(),
        si.time(),
        si.processes(),
        si.currentLoad(),
      ]);

    const rootDisk = disks.find((d) => d.mount === '/') ?? disks[0];
    const homeDisk = disks.find((d) => d.mount === '/home') ?? null;
    const varDisk = disks.find((d) => d.mount === '/var') ?? null;
    const net = netStats.find((n) => n.operstate === 'up') ?? netStats[0];

    const [backend, frontend, database, security, nginx, logs] =
      await Promise.all([
        this.pm2App('hrms-backend'),
        this.pm2App('hrms-frontend'),
        this.getDatabaseMetrics(),
        this.getSecurityMetrics(),
        this.getNginxMetrics(),
        this.getLogMetrics(),
      ]);

const alerts: string[] = [];

    if (cpu.currentLoad > 85) alerts.push('HIGH_CPU');
    if ((mem.used / mem.total) * 100 > 85) alerts.push('HIGH_MEMORY');
    if ((rootDisk?.use ?? 0) > 85) alerts.push('HIGH_DISK');
    if (database.totalConnections > database.maxConnections * 0.8)
      alerts.push('HIGH_DB_CONNECTIONS');
    if (database.longRunningQueries > 0) alerts.push('LONG_RUNNING_DB_QUERIES');
    if (database.blockedQueries > 0) alerts.push('BLOCKED_DB_QUERIES');
    if (backend.status !== 'online') alerts.push('BACKEND_OFFLINE');
    if (frontend.status !== 'online') alerts.push('FRONTEND_OFFLINE');
    if (nginx.status !== 'active') alerts.push('NGINX_INACTIVE');
    if (security.firewall !== 'active') alerts.push('FIREWALL_INACTIVE');
    if (security.sshFailedLogins > 50) alerts.push('HIGH_SSH_FAILED_LOGINS');

    return {
      checkedAt: new Date(),

      health: {
        status: alerts.length === 0 ? 'healthy' : 'warning',
        alerts,
      },

      server: {
        hostname: os.hostname,
        distro: os.distro,
        platform: os.platform,
        release: os.release,
        uptimeSeconds: time.uptime,
      },

      cpu: {
        usagePercent: Number(cpu.currentLoad.toFixed(2)),
        cores: cpu.cpus.length,
        loadAverage: {
          currentLoad: Number(load.currentLoad.toFixed(2)),
        },
      },

      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        usagePercent: Number(((mem.used / mem.total) * 100).toFixed(2)),
      },

      swap: {
        total: mem.swaptotal,
        used: mem.swapused,
        free: mem.swapfree,
        usagePercent: mem.swaptotal
          ? Number(((mem.swapused / mem.swaptotal) * 100).toFixed(2))
          : 0,
      },

      disk: {
        root: {
          filesystem: rootDisk?.fs,
          mount: rootDisk?.mount,
          size: rootDisk?.size ?? 0,
          used: rootDisk?.used ?? 0,
          available: rootDisk?.available ?? 0,
          usagePercent: Number((rootDisk?.use ?? 0).toFixed(2)),
        },
        home: homeDisk
          ? {
              filesystem: homeDisk.fs,
              mount: homeDisk.mount,
              size: homeDisk.size,
              used: homeDisk.used,
              available: homeDisk.available,
              usagePercent: Number(homeDisk.use.toFixed(2)),
            }
          : null,
        var: varDisk
          ? {
              filesystem: varDisk.fs,
              mount: varDisk.mount,
              size: varDisk.size,
              used: varDisk.used,
              available: varDisk.available,
              usagePercent: Number(varDisk.use.toFixed(2)),
            }
          : null,
        all: disks.map((d) => ({
          filesystem: d.fs,
          mount: d.mount,
          size: d.size,
          used: d.used,
          available: d.available,
          usagePercent: Number(d.use.toFixed(2)),
        })),
      },

      network: {
        interface: net?.iface,
        rxBytes: net?.rx_bytes ?? 0,
        txBytes: net?.tx_bytes ?? 0,
        rxSec: net?.rx_sec ?? 0,
        txSec: net?.tx_sec ?? 0,
      },

      services: {
        nginx: nginx.status,
        postgres: await this.serviceStatus('postgresql'),
        backend: backend.status,
        frontend: frontend.status,
      },

      pm2: {
        backend,
        frontend,
      },

      database,

      nginx,

      security,

      logs,

      processes: {
        all: processes.all,
        running: processes.running,
        sleeping: processes.sleeping,
        blocked: processes.blocked,
      },
    };
  }
}