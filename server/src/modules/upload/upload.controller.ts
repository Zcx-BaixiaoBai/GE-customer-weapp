import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const type = req.body.type || 'image';
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(file.originalname);
          cb(null, `${type}/${uniqueName}`);
        },
      }),
      limits: { fileSize: 30 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const type = req.body.type || 'image';
        const ext = extname(file.originalname).slice(1).toLowerCase();
        const allowed = type === 'image'
          ? ['jpg', 'jpeg', 'png', 'webp', 'heic']
          : ['mp3', 'wav', 'amr', 'm4a', 'aac'];
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('File type not allowed'), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any, @Body() body: any) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return {
      url: '/uploads/' + file.filename,
      filename: file.filename,
      size: file.size,
      type: body.type || 'image',
    };
  }
}
