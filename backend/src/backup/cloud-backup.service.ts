import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

export type CloudUploadResult = {
  provider: 's3' | 'dropbox' | 'google_drive';
  ok: boolean;
  error?: string;
  remotePath?: string;
};

@Injectable()
export class CloudBackupService {
  private readonly logger = new Logger(CloudBackupService.name);

  constructor(private readonly config: ConfigService) {}

  private enabled(name: string): boolean {
    const v =
      this.config.get<string>(name) ?? process.env[name] ?? '';
    return v === 'true' || v === '1';
  }

  async uploadZip(localZipPath: string, remoteName: string): Promise<CloudUploadResult[]> {
    const results: CloudUploadResult[] = [];
    if (this.enabled('BACKUP_CLOUD_S3_ENABLED')) {
      results.push(await this.uploadS3(localZipPath, remoteName));
    }
    if (this.enabled('BACKUP_CLOUD_DROPBOX_ENABLED')) {
      results.push(await this.uploadDropbox(localZipPath, remoteName));
    }
    if (this.enabled('BACKUP_CLOUD_GDRIVE_ENABLED')) {
      results.push(await this.uploadGoogleDrive(localZipPath, remoteName));
    }
    return results;
  }

  private async uploadS3(localPath: string, remoteName: string): Promise<CloudUploadResult> {
    try {
      const bucket =
        this.config.get<string>('AWS_S3_BACKUP_BUCKET') ||
        process.env.AWS_S3_BACKUP_BUCKET;
      const region =
        this.config.get<string>('AWS_REGION') || process.env.AWS_REGION || 'ap-south-1';
      const accessKeyId =
        this.config.get<string>('AWS_ACCESS_KEY_ID') || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey =
        this.config.get<string>('AWS_SECRET_ACCESS_KEY') ||
        process.env.AWS_SECRET_ACCESS_KEY;
      if (!bucket || !accessKeyId || !secretAccessKey) {
        return { provider: 's3', ok: false, error: 'S3 credentials not configured' };
      }
      const client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      const key = `openhrm/backups/${remoteName}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fs.readFileSync(localPath),
          ContentType: 'application/zip',
        }),
      );
      this.logger.log(`Uploaded backup to S3: ${key}`);
      return { provider: 's3', ok: true, remotePath: `s3://${bucket}/${key}` };
    } catch (err) {
      return { provider: 's3', ok: false, error: String(err) };
    }
  }

  private async uploadDropbox(localPath: string, remoteName: string): Promise<CloudUploadResult> {
    try {
      const token =
        this.config.get<string>('DROPBOX_ACCESS_TOKEN') ||
        process.env.DROPBOX_ACCESS_TOKEN;
      if (!token) {
        return { provider: 'dropbox', ok: false, error: 'DROPBOX_ACCESS_TOKEN not set' };
      }
      const folder =
        this.config.get<string>('DROPBOX_BACKUP_FOLDER') ||
        process.env.DROPBOX_BACKUP_FOLDER ||
        '/openhrm/backups';
      const dropboxPath = `${folder.replace(/\/$/, '')}/${remoteName}`;
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: dropboxPath,
            mode: 'overwrite',
            autorename: false,
          }),
          'Content-Type': 'application/octet-stream',
        },
        body: fs.readFileSync(localPath),
      });
      if (!res.ok) {
        const text = await res.text();
        return { provider: 'dropbox', ok: false, error: text };
      }
      this.logger.log(`Uploaded backup to Dropbox: ${dropboxPath}`);
      return { provider: 'dropbox', ok: true, remotePath: dropboxPath };
    } catch (err) {
      return { provider: 'dropbox', ok: false, error: String(err) };
    }
  }

  private async uploadGoogleDrive(
    localPath: string,
    remoteName: string,
  ): Promise<CloudUploadResult> {
    try {
      const saPath =
        this.config.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH') ||
        process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH;
      const folderId =
        this.config.get<string>('GOOGLE_DRIVE_BACKUP_FOLDER_ID') ||
        process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
      if (!saPath || !folderId) {
        return {
          provider: 'google_drive',
          ok: false,
          error: 'Google Drive service account path or folder ID not set',
        };
      }
      const absPath = path.resolve(saPath);
      const auth = new google.auth.GoogleAuth({
        keyFile: absPath,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.create({
        requestBody: {
          name: remoteName,
          parents: [folderId],
        },
        media: {
          mimeType: 'application/zip',
          body: fs.createReadStream(localPath),
        },
        fields: 'id, name',
      });
      this.logger.log(`Uploaded backup to Google Drive: ${res.data.name}`);
      return {
        provider: 'google_drive',
        ok: true,
        remotePath: res.data.id || remoteName,
      };
    } catch (err) {
      return { provider: 'google_drive', ok: false, error: String(err) };
    }
  }
}
