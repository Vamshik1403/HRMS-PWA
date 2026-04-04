import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportAttendanceService } from './import-attendance.service';
import { Response } from 'express';

@Controller('import-attendance')
export class ImportAttendanceController {
  constructor(private readonly importService: ImportAttendanceService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
        ];
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        if (allowed.includes(file.mimetype) || ['csv', 'xlsx', 'xls'].includes(ext || '')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV, XLSX, and XLS files are allowed'), false);
        }
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.importService.importFromBuffer(file.buffer, file.originalname);
  }

  @Get('imported')
  async getImported() {
    return this.importService.getImportedRecords();
  }

  @Delete('imported')
  async deleteImported(@Query('fileName') fileName?: string) {
    return this.importService.deleteImportedRecords(fileName);
  }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.importService.downloadTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="attendance-import-template.xlsx"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
