import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExamService } from './exam.service';
import { CertificateService } from './certificate.service';
import {
  CreateQuestionDto,
  CreateExamDto,
  SubmitExamDto,
  GenerateQuestionsDto,
} from '../../common/dto/exam.dto';

@Controller('exam')
export class ExamController {
  constructor(
    private readonly examService: ExamService,
    private readonly certificateService: CertificateService,
  ) {}

  // ========== 固定路由（必须放在 :id 前面，否则被 :id 拦截）==========

  @Get('questions')
  async getQuestions(@Query('category') category?: string) {
    const questions = await this.examService.getQuestions(category);
    return { code: 0, data: questions };
  }

  @Get('list')
  async getExams() {
    const exams = await this.examService.getExams();
    return { code: 0, data: exams };
  }

  @Get('stats')
  async getStats(@Query('phone') phone: string) {
    if (!phone) return { code: -1, message: '缺少phone参数' };
    const stats = await this.examService.getExamStats(phone);
    return { code: 0, data: stats };
  }

  @Get('exam-stats')
  async getExamDetailStats() {
    const stats = await this.examService.getExamDetailStats();
    return { code: 0, data: stats };
  }

  // ========== AI生成题目 ==========

  @Post('generate')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // AI生成接口限流更严
  async generateQuestions(@Body() dto: GenerateQuestionsDto) {
    try {
      const questions = await this.examService.generateQuestionsWithAI(dto.topic, dto.count || 5);
      return { code: 0, data: questions, message: 'AI生成' + questions.length + '道题目' };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  @Get('my-submissions')
  async getMySubmissions(@Query('phone') phone: string) {
    if (!phone) return { code: -1, message: '缺少phone参数' };
    const submissions = await this.examService.getUserSubmissions(phone);
    return { code: 0, data: submissions };
  }

  // ========== 证书 ==========

  @Get('certificates')
  async getCertificates(@Query('phone') phone: string) {
    if (!phone) return { code: -1, message: '缺少phone参数' };
    const certs = await this.certificateService.findByPhone(phone);
    return { code: 0, data: certs };
  }

  @Delete('certificates/:id')
  async deleteCertificate(@Param('id') id: string) {
    const ok = await this.certificateService.delete(id);
    return { code: ok ? 0 : -1 };
  }

  @Get('result/:id')
  async getResult(@Param('id') id: string) {
    const result = await this.examService.getResult(id);
    if (!result) return { code: -1, message: '记录不存在' };
    return { code: 0, data: result };
  }

  // ========== 动态路由 :id ==========

  @Get(':id')
  async getExam(@Param('id') id: string) {
    const exam = await this.examService.getExamById(id);
    if (!exam) return { code: -1, message: '考试不存在' };
    return { code: 0, data: exam };
  }

  @Get(':id/questions')
  async getExamQuestions(@Param('id') id: string) {
    const result = await this.examService.getExamQuestions(id);
    if (!result.exam) return { code: -1, message: '考试不存在' };
    return {
      code: 0,
      data: {
        exam: result.exam,
        questions: result.questions,
      },
    };
  }

  // ========== 写操作 ==========

  @Post('questions')
  async createQuestion(@Body() dto: CreateQuestionDto) {
    const q = await this.examService.createQuestion(dto as any);
    return { code: 0, data: q };
  }

  @Post('questions/:id/update')
  async updateQuestion(@Param('id') id: string, @Body() body: any) {
    const q = await this.examService.updateQuestion(id, body);
    if (!q) return { code: -1, message: '题目不存在' };
    return { code: 0, data: q };
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: string) {
    const ok = await this.examService.deleteQuestion(id);
    return { code: ok ? 0 : -1 };
  }

  @Post('create')
  async createExam(@Body() dto: CreateExamDto) {
    const exam = await this.examService.createExam(dto);
    return { code: 0, data: exam };
  }

  @Post(':id/publish')
  async publishExam(@Param('id') id: string) {
    const exam = await this.examService.publishExam(id);
    if (!exam) return { code: -1, message: '考试不存在' };
    return { code: 0, data: exam };
  }

  // 考试提交: 每分钟限 5 次（防刷分）
  @Post('submit')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async submitExam(@Body() dto: SubmitExamDto) {
    try {
      const submission = await this.examService.submitExam({
        examId: dto.examId,
        phone: dto.phone,
        answers: dto.answers,
        duration: dto.duration || 0,
      });
      return { code: 0, data: submission };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }
}
