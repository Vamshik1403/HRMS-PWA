import {
  Controller,
  Post,
  Get,
  Delete,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
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
        const allowedMimes = [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'application/octet-stream', // sometimes for .xlsx
        ];
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        const allowedExts = ['csv', 'xlsx', 'xls'];
        
        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext || '')) {
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
  async deleteImported() {
    return this.importService.deleteImportedRecords();
  }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.importService.downloadTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="attendance-import-template.xlsx"',
      'Content-Length': buffer.length,
    });
    res.status(HttpStatus.OK).send(buffer);
  }
}