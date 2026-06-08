import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(AuthGuard('jwt'))
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  private assertSuperAdmin(req: { user?: { role?: string } }) {
    if (req.user?.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Only Super Admin can access backups');
    }
  }

  @Get()
  list(@Req() req: { user?: { role?: string } }) {
    this.assertSuperAdmin(req);
    return {
      backupRoot: this.backupService.getBackupRoot(),
      items: this.backupService.listBackups(),
      restoreLogs: this.backupService.listRestoreLogs(30),
    };
  }

  @Get('restore-logs')
  restoreLogs(
    @Req() req: { user?: { role?: string } },
    @Query('limit') limit?: string,
  ) {
    this.assertSuperAdmin(req);
    return this.backupService.listRestoreLogs(limit ? Number(limit) : 50);
  }

  @Post('run')
  runNow(@Req() req: { user?: { role?: string } }) {
    this.assertSuperAdmin(req);
    return this.backupService.runDailyBackup('manual');
  }

  @Post('cloud/weekly')
  runWeeklyCloud(@Req() req: { user?: { role?: string } }) {
    this.assertSuperAdmin(req);
    return this.backupService.runWeeklyCloudBackup();
  }

  @Get('download/:date/:fileName')
  download(
    @Req() req: { user?: { role?: string } },
    @Param('date') date: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    this.assertSuperAdmin(req);
    const filePath = this.backupService.resolveBackupFile(date, fileName);
    return res.download(filePath);
  }

  @Post('restore')
  async restore(
    @Req() req: Request & { user?: { role?: string } },
    @Body() body: { date: string; fileName: string; fileLabel?: string; confirm?: boolean },
  ) {
    this.assertSuperAdmin(req);
    if (!body?.confirm) {
      throw new ForbiddenException('Restore requires confirm: true');
    }
    await this.backupService.restoreFromBackup(
      body.date,
      body.fileName,
      req,
      body.fileLabel,
    );
    return { ok: true, message: 'Restore completed' };
  }
}
