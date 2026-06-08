import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { actorFromJwtUser, resolveClientIp } from '../audit-log/audit-request.util';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BACKUP_SECTIONS } from './backup-sections';
import { CloudBackupService, type CloudUploadResult } from './cloud-backup.service';

const execFileAsync = promisify(execFile);

export type BackupManifest = {
  date: string;
  createdAt: string;
  trigger: 'scheduled' | 'manual' | 'unknown';
  files: Array<{ key: string; label: string; fileName: string; sizeBytes: number }>;
  zipFileName?: string;
  zipSizeBytes?: number;
  emailSent: boolean;
  cloudUploads?: CloudUploadResult[];
};

export type BackupDaySummary = BackupManifest;

type PgConn = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

type RestoreActor = {
  userId?: number | null;
  username?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly cloudBackup: CloudBackupService,
  ) {}

  getBackupRoot(): string {
    const configured = this.config.get<string>('BACKUP_DIR') || process.env.BACKUP_DIR;
    if (configured) return path.resolve(configured);
    return path.resolve(process.cwd(), '..', 'backup');
  }

  private parseDatabaseUrl(): PgConn {
    const raw =
      this.config.get<string>('DATABASE_URL_HRMS') ||
      process.env.DATABASE_URL_HRMS ||
      '';
    if (!raw) throw new Error('DATABASE_URL_HRMS is not configured');
    const u = new URL(raw);
    const database = u.pathname.replace(/^\//, '').split('?')[0];
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database,
    };
  }

  private dateFolder(d = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async runPgDump(
    conn: PgConn,
    outFile: string,
    tables: string[] | null,
  ): Promise<void> {
    const args = [
      '-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database,
      '--no-owner', '--no-acl', '-F', 'p', '-f', outFile,
    ];
    if (tables?.length) {
      for (const table of tables) {
        const escaped = table.replace(/"/g, '""');
        args.push('-t', `"${escaped}"`);
      }
    }
    await execFileAsync('pg_dump', args, {
      env: { ...process.env, PGPASSWORD: conn.password },
      maxBuffer: 64 * 1024 * 1024,
    });
  }

  private async runPsqlFile(conn: PgConn, sqlFile: string): Promise<void> {
    await execFileAsync(
      'psql',
      ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile],
      { env: { ...process.env, PGPASSWORD: conn.password }, maxBuffer: 64 * 1024 * 1024 },
    );
  }

  private readManifest(dayDir: string): BackupManifest | null {
    const manifestPath = path.join(dayDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
    } catch {
      return null;
    }
  }

  private async createZip(
    dayDir: string,
    date: string,
    fileNames: string[],
  ): Promise<{ zipPath: string; zipFileName: string; sizeBytes: number }> {
    const zipFileName = `openhrm-backup-${date}.zip`;
    const zipPath = path.join(dayDir, zipFileName);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    const toZip = [...fileNames, 'manifest.json'].filter((f) => fs.existsSync(path.join(dayDir, f)));
    if (!toZip.length) throw new Error('No backup files to zip');
    await execFileAsync('zip', ['-j', zipPath, ...toZip], { cwd: dayDir });
    return { zipPath, zipFileName, sizeBytes: fs.statSync(zipPath).size };
  }

  private pruneOldBackups(root: string): void {
    const retention = Number(process.env.BACKUP_RETENTION_DAYS || 30);
    if (!Number.isFinite(retention) || retention <= 0) return;
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const cutoff = Date.now() - retention * 86400000;
    for (const ent of entries) {
      if (!ent.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(ent.name)) continue;
      const dirPath = path.join(root, ent.name);
      const manifest = this.readManifest(dirPath);
      const created = manifest?.createdAt
        ? new Date(manifest.createdAt).getTime()
        : fs.statSync(dirPath).mtimeMs;
      if (created < cutoff) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        this.logger.log(`Pruned old backup folder ${ent.name}`);
      }
    }
  }

  async runDailyBackup(
    trigger: 'scheduled' | 'manual' = 'scheduled',
  ): Promise<BackupManifest> {
    if (this.running) throw new BadRequestException('Backup is already running');
    this.running = true;
    const started = new Date();
    const date = this.dateFolder(started);
    const root = this.getBackupRoot();
    const dayDir = path.join(root, date);

    try {
      fs.mkdirSync(dayDir, { recursive: true });
      const existing = this.readManifest(dayDir);
      if (existing && trigger === 'scheduled') {
        this.logger.log(`Backup for ${date} already exists — skipping scheduled run`);
        return existing;
      }

      const conn = this.parseDatabaseUrl();
      const files: BackupManifest['files'] = [];

      for (const [key, section] of Object.entries(BACKUP_SECTIONS)) {
        const fileName = `${key}.sql`;
        const outFile = path.join(dayDir, fileName);
        this.logger.log(`Dumping ${section.label} → ${fileName}`);
        await this.runPgDump(conn, outFile, section.tables);
        files.push({ key, label: section.label, fileName, sizeBytes: fs.statSync(outFile).size });
      }

      const manifest: BackupManifest = {
        date,
        createdAt: started.toISOString(),
        trigger,
        files,
        emailSent: false,
      };

      fs.writeFileSync(path.join(dayDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

      const zip = await this.createZip(
        dayDir,
        date,
        files.map((f) => f.fileName),
      );
      manifest.zipFileName = zip.zipFileName;
      manifest.zipSizeBytes = zip.sizeBytes;

      manifest.emailSent = await this.mailService.sendDailyBackupEmail({
        dateLabel: date,
        dayDir,
        zipPath: zip.zipPath,
        zipFileName: zip.zipFileName,
        files,
      });

      const isSunday = started.getDay() === 0;
      if (isSunday || trigger === 'manual') {
        manifest.cloudUploads = await this.cloudBackup.uploadZip(zip.zipPath, zip.zipFileName);
      }

      fs.writeFileSync(path.join(dayDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      this.pruneOldBackups(root);
      this.logger.log(`Backup completed for ${date} (zip ${(zip.sizeBytes / 1024).toFixed(1)} KB)`);
      return manifest;
    } catch (err) {
      this.logger.error(`Backup failed: ${String(err)}`);
      throw err;
    } finally {
      this.running = false;
    }
  }

  /** Weekly archive of the last 7 daily backup zips uploaded to cloud storage. */
  async runWeeklyCloudBackup(): Promise<CloudUploadResult[]> {
    const root = this.getBackupRoot();
    if (!fs.existsSync(root)) return [];
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 7);
    if (!dirs.length) return [];

    const weekLabel = this.dateFolder(new Date());
    const weeklyZipName = `openhrm-weekly-${weekLabel}.zip`;
    const stagingDir = path.join(root, '_weekly_staging');
    fs.mkdirSync(stagingDir, { recursive: true });
    const weeklyZipPath = path.join(root, weeklyZipName);
    if (fs.existsSync(weeklyZipPath)) fs.unlinkSync(weeklyZipPath);

    const zipInputs: string[] = [];
    for (const d of dirs) {
      const manifest = this.readManifest(path.join(root, d));
      const zipName = manifest?.zipFileName || `openhrm-backup-${d}.zip`;
      const src = path.join(root, d, zipName);
      if (fs.existsSync(src)) {
        const dest = path.join(stagingDir, `${d}-${zipName}`);
        fs.copyFileSync(src, dest);
        zipInputs.push(dest);
      }
    }
    if (!zipInputs.length) return [];
    await execFileAsync('zip', ['-j', weeklyZipPath, ...zipInputs.map((p) => path.basename(p))], {
      cwd: stagingDir,
    });
    fs.rmSync(stagingDir, { recursive: true, force: true });

    const results = await this.cloudBackup.uploadZip(weeklyZipPath, weeklyZipName);
    this.logger.log(`Weekly cloud backup uploaded: ${weeklyZipName}`);
    return results;
  }

  listBackups(): BackupDaySummary[] {
    const root = this.getBackupRoot();
    if (!fs.existsSync(root)) return [];
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => b.localeCompare(a));

    const out: BackupDaySummary[] = [];
    for (const date of dirs) {
      const dayDir = path.join(root, date);
      const manifest = this.readManifest(dayDir);
      if (manifest) {
        out.push(manifest);
        continue;
      }
      const sqlFiles = fs
        .readdirSync(dayDir)
        .filter((f) => f.endsWith('.sql'))
        .map((fileName) => {
          const stat = fs.statSync(path.join(dayDir, fileName));
          const key = fileName.replace(/\.sql$/, '');
          return {
            key,
            label: BACKUP_SECTIONS[key]?.label || key,
            fileName,
            sizeBytes: stat.size,
          };
        });
      if (sqlFiles.length) {
        out.push({
          date,
          createdAt: fs.statSync(dayDir).mtime.toISOString(),
          trigger: 'unknown',
          files: sqlFiles,
          emailSent: false,
        });
      }
    }
    return out;
  }

  listRestoreLogs(limit = 50) {
    return this.prisma.backupRestoreLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  resolveBackupFile(date: string, fileName: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid backup date');
    }
    if (!/^[a-z0-9.-]+\.(sql|zip)$/i.test(fileName)) {
      throw new BadRequestException('Invalid backup file name');
    }
    const full = path.join(this.getBackupRoot(), date, fileName);
    if (!fs.existsSync(full)) throw new NotFoundException('Backup file not found');
    return full;
  }

  async restoreFromBackup(
    date: string,
    fileName: string,
    req?: Request,
    fileLabel?: string,
  ): Promise<void> {
    const sqlFile = this.resolveBackupFile(date, fileName);
    const actor: RestoreActor = req
      ? {
          ...actorFromJwtUser((req as { user?: Record<string, unknown> }).user),
          ipAddress: resolveClientIp(req),
        }
      : {};
    const conn = this.parseDatabaseUrl();

    try {
      this.logger.warn(`Restoring database from ${sqlFile}`);
      await this.runPsqlFile(conn, sqlFile);
      await this.prisma.backupRestoreLog.create({
        data: {
          userId: actor.userId ?? null,
          username: actor.username ?? null,
          backupDate: date,
          fileName,
          fileLabel: fileLabel || fileName,
          success: true,
          ipAddress: actor.ipAddress ?? null,
        },
      });
      await this.auditLog.logFromRequest(req, {
        action: 'RESTORE',
        module: 'BACKUP',
        entityId: date,
        entityName: fileName,
        newData: { backupDate: date, fileName, fileLabel },
        success: true,
      });
    } catch (err) {
      const message = String(err);
      await this.prisma.backupRestoreLog.create({
        data: {
          userId: actor.userId ?? null,
          username: actor.username ?? null,
          backupDate: date,
          fileName,
          fileLabel: fileLabel || fileName,
          success: false,
          errorMessage: message,
          ipAddress: actor.ipAddress ?? null,
        },
      });
      await this.auditLog.logFromRequest(req, {
        action: 'RESTORE',
        module: 'BACKUP',
        entityId: date,
        entityName: fileName,
        success: false,
        failureReason: message,
      });
      throw err;
    }
  }
}
