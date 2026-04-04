import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

function filenameBuilder(_: any, file: Express.Multer.File, cb: (err: any, filename: string) => void) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  cb(null, unique + extname(file.originalname)); // keep extension
}

@Controller('files')
export class FilesController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads',      // folder relative to project root
        filename: filenameBuilder,
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB (tweak as needed)
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    // Return a publicly accessible URL for the saved file
    // will be something like localhost:8000/uploads/<filename>
    return { url: `/uploads/${file.filename}` };
  }
}
