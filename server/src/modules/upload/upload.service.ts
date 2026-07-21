import { Injectable } from '@nestjs/common';
import { config } from '../../config/configuration';
import * as crypto from 'crypto';

/**
 * 文件上传服务
 * 一期使用本地文件存储（简单可用）
 * 二期可切换到MinIO/FastGPT自带的MinIO
 */
@Injectable()
export class UploadService {
  // 生成唯一文件名
  generateFileName(originalName: string, type: string): string {
    const ext = originalName.split('.').pop() || '';
    const hash = crypto.randomBytes(16).toString('hex');
    const date = new Date();
    const ymd = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    return `${type}/${ymd}/${hash}.${ext}`;
  }

  // 文件类型白名单
  private allowedTypes = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    audio: ['mp3', 'wav', 'amr', 'm4a', 'aac'],
  };

  isAllowed(filename: string, type: string): boolean {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    return this.allowedTypes[type]?.includes(ext) || false;
  }

  // 返回文件访问URL
  getFileUrl(fileName: string): string {
    // 一期：本地存储
    return `/uploads/${fileName}`;
  }
}
