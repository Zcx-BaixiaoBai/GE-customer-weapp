import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { RepairService } from './repair.service';
import { AnalyzeTextDto } from '../../common/dto/repair.dto';

@Controller('repair')
export class RepairController {
  constructor(private repairService: RepairService) {}

  // POST /api/repair/analyze  (multipart: audio + accumulatedText)
  // 有录音文件时走这个：ASR + LLM一步到位
  // 报修分析接口放宽限流：每分钟 10 次（用户可能反复补充信息）
  @Post('analyze')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
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

  // POST /api/repair/analyze-text  (JSON: { supplementText, accumulatedText })
  // 纯文字补充时走这个：没有音频文件，只做LLM校验
  @Post('analyze-text')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async analyzeText(@Body() dto: AnalyzeTextDto) {
    try {
      const result = await this.repairService.analyzeRepairRequest({
        audioBase64: '',
        audioFormat: 'mp3',
        supplementText: dto.supplementText || '',
        accumulatedText: dto.accumulatedText || '',
      });
      return result;
    } catch (e) {
      return { error: e.message, transcribedText: '', isComplete: false, question: '分析失败，请重试' };
    }
  }

  // POST /api/repair/asr  (纯ASR，保留兼容但不再推荐)
  @Post('asr')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
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
