import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { TrainingService } from './training.service';
import { config } from '../../config/configuration';
import axios from 'axios';
import {
  CreateCourseDto,
  AddLessonDto,
  UpdateProgressDto,
  AiAssistantDto,
} from '../../common/dto/training.dto';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ========== 课程 ==========

  @Get('courses')
  async getCourses(@Query('category') category?: string) {
    const courses = await this.trainingService.getAllCourses();
    const filtered = category ? courses.filter((c) => c.category === category) : courses;
    return { code: 0, data: filtered };
  }

  @Get('courses/:id')
  async getCourse(@Param('id') id: string) {
    const course = await this.trainingService.getCourseById(id);
    if (!course) return { code: -1, message: '课程不存在' };
    return { code: 0, data: course };
  }

  @Post('courses')
  async createCourse(@Body() dto: CreateCourseDto) {
    const course = await this.trainingService.createCourse(dto);
    return { code: 0, data: course };
  }

  @Put('courses/:id')
  async updateCourse(@Param('id') id: string, @Body() body: any) {
    const course = await this.trainingService.updateCourse(id, body);
    if (!course) return { code: -1, message: '课程不存在' };
    return { code: 0, data: course };
  }

  @Delete('courses/:id')
  async deleteCourse(@Param('id') id: string) {
    const ok = await this.trainingService.deleteCourse(id);
    return { code: ok ? 0 : -1 };
  }

  // ========== 课时 ==========

  @Post('courses/:id/lessons')
  async addLesson(@Param('id') courseId: string, @Body() dto: AddLessonDto) {
    const lesson = await this.trainingService.addLesson(courseId, dto);
    if (!lesson) return { code: -1, message: '课程不存在' };
    return { code: 0, data: lesson };
  }

  @Put('courses/:courseId/lessons/:lessonId')
  async updateLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: any,
  ) {
    const lesson = await this.trainingService.updateLesson(courseId, lessonId, body);
    if (!lesson) return { code: -1, message: '课时不存在' };
    return { code: 0, data: lesson };
  }

  @Delete('courses/:courseId/lessons/:lessonId')
  async deleteLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    const ok = await this.trainingService.deleteLesson(courseId, lessonId);
    return { code: ok ? 0 : -1 };
  }

  // ========== 学习进度 ==========

  @Get('progress/:courseId')
  async getProgress(
    @Param('courseId') courseId: string,
    @Query('phone') phone: string,
  ) {
    if (!phone) return { code: -1, message: '缺少phone参数' };
    const records = await this.trainingService.getProgress(courseId, phone);
    return { code: 0, data: records };
  }

  @Post('progress')
  @Throttle({ default: { ttl: 10000, limit: 10 } }) // 进度上报: 10秒最多10次
  async updateProgress(@Body() dto: UpdateProgressDto) {
    const record = await this.trainingService.updateProgress({
      courseId: dto.courseId,
      lessonId: dto.lessonId,
      phone: dto.phone,
      progress: dto.progress || 0,
      watchedDuration: dto.watchedDuration || 0,
    });
    return { code: 0, data: record };
  }

  // ========== 统计 ==========

  @Get('stats')
  async getStats(@Query('phone') phone: string) {
    if (!phone) {
      const stats = await this.trainingService.getGlobalStats();
      return { code: 0, data: stats };
    }
    const stats = await this.trainingService.getLearningStats(phone);
    return { code: 0, data: stats };
  }

  @Get('course-stats')
  async getCourseDetailStats(@Query('phone') phone: string) {
    const stats = await this.trainingService.getCourseDetailStats(phone || undefined);
    return { code: 0, data: stats };
  }

  // ========== AI 培训助手 ==========

  @Post('assistant')
  @Throttle({ default: { ttl: 60000, limit: 15 } }) // AI对话限流
  async aiAssistant(@Body() dto: AiAssistantDto, @Res() res: Response) {
    if (!dto.message) {
      res.status(400).json({ code: -1, message: '缺少message参数' });
      return;
    }

    // 构建 system prompt
    let systemPrompt = '你是金鹰世界商场的培训助手，帮助员工理解培训课程内容。请用简洁易懂的中文回答问题。';
    if (dto.courseTitle) systemPrompt += '\n当前课程：' + dto.courseTitle;
    if (dto.courseDescription) systemPrompt += '\n课程描述：' + dto.courseDescription;
    if (dto.lessonContent) systemPrompt += '\n当前课时内容：' + dto.lessonContent.substring(0, 2000);

    let apiUrl = '';
    let apiKey = '';
    let useLlm = false;

    if (config.llm.apiKey && config.llm.baseUrl) {
      apiUrl = config.llm.baseUrl + '/chat/completions';
      apiKey = config.llm.apiKey;
      useLlm = true;
    } else if (config.fastgpt.apiKey) {
      apiUrl = config.fastgpt.baseUrl + '/chat/completions';
      apiKey = config.fastgpt.apiKey;
    } else {
      res.status(400).json({ code: -1, message: '未配置LLM API' });
      return;
    }

    const requestBody: any = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: dto.message },
      ],
      stream: true,
      detail: false,
    };

    if (useLlm) {
      if (config.llm.model) requestBody.model = config.llm.model;
      requestBody.max_tokens = config.llm.maxTokens || 1000;
      requestBody.temperature = 0.5;
    }

    try {
      const upstream = await axios.post(apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        responseType: 'stream',
        timeout: 60000,
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      upstream.data.pipe(res);
    } catch (e) {
      res.status(500).json({ code: -1, message: 'AI服务异常: ' + e.message });
    }
  }
}
