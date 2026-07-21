import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RepairService } from './repair.service';

@Controller('repair')
export class RepairController {
  constructor(private repairService: RepairService) {}

  // POST /api/repair/analyze  (multipart: audio + accumulatedText)
  // 一步到位：ASR + LLM三字段校验，省掉小程序中转往返
  @Post('analyze')
  @UseInterceptors(FileInterceptor('audio'))
  async analyze(@UploadedFile() file: any, @Body() body: any) {
    try {
      let audioBase64 = '';
      let audioFormat = 'mp3';

      if (file) {
        audioBase64 = file.buffer.toString('base64');
        audioFormat = (file.originalname || '').split('.').pop() || 'mp3';
      }

      const result = await this.repairService.analyzeRepairRequest({
        audioBase64,
        audioFormat,
        supplementText: body.supplementText || '',
        accumulatedText: body.accumulatedText || '',
      });
      return result;
    } catch (e) {
      return { error: e.message, transcribedText: '', isComplete: false, question: '分析失败，请重试' };
    }
  }

  // POST /api/repair/asr  (纯ASR，保留兼容但不再推荐)
  @Post('asr')
  @UseInterceptors(FileInterceptor('audio'))
  async asr(@UploadedFile() file: any) {
    if (!file) {
      return { error: 'no audio file' };
    }
    const audioBase64 = file.buffer.toString('base64');
    const format = (file.originalname || '').split('.').pop() || 'mp3';
    try {
      const text = await this.repairService.speechToText(audioBase64, format);
      return { text };
    } catch (e) {
      return { error: e.message };
    }
  }
}
