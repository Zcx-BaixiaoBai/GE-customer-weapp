import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { TrainingService } from '../training/training.service';
import { ExamService } from '../exam/exam.service';
import { ADMIN_HTML } from './admin.html';

@Controller('admin')
export class AdminController {
  constructor(
    private trainingService: TrainingService,
    private examService: ExamService,
  ) {}

  @Get()
  getAdminPage(@Res() res: Response) {
    res.type('text/html').send(ADMIN_HTML);
  }

  // ========== 视频上传 ==========
  @Post('api/upload/video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/video',
        filename: (req, file, cb) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(file.originalname);
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).slice(1).toLowerCase();
        const allowed = ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('仅支持 mp4/mov/avi/mkv/flv/wmv 格式'), false);
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: any) {
    if (!file) return { code: -1, message: '未收到文件' };
    // 返回完整的可访问URL
    var url = '/uploads/video/' + file.filename;
    return { code: 0, data: { url: url, filename: file.filename, size: file.size, originalName: file.originalname } };
  }

  // ========== 图片上传 ==========
  @Post('api/upload/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/image',
        filename: (req, file, cb) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(file.originalname);
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).slice(1).toLowerCase();
        const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('仅支持 jpg/png/webp/gif 格式'), false);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: any) {
    if (!file) return { code: -1, message: '未收到文件' };
    var url = '/uploads/image/' + file.filename;
    return { code: 0, data: { url: url, filename: file.filename, size: file.size } };
  }

  // ========== 培训 ==========
  @Get('api/training/courses')
  async getCourses() { return { code: 0, data: await this.trainingService.getAllCourses() }; }

  @Post('api/training/courses')
  async createCourse(@Body() body: any) { return { code: 0, data: await this.trainingService.createCourse(body) }; }

  @Put('api/training/courses/:id')
  async updateCourse(@Param('id') id: string, @Body() body: any) {
    const c = await this.trainingService.updateCourse(id, body);
    return c ? { code: 0, data: c } : { code: -1, message: '课程不存在' };
  }

  @Delete('api/training/courses/:id')
  async deleteCourse(@Param('id') id: string) {
    return { code: (await this.trainingService.deleteCourse(id)) ? 0 : -1 };
  }

  @Get('api/training/course-stats')
  async getCourseDetailStats(@Query('phone') phone: string) {
    return { code: 0, data: await this.trainingService.getCourseDetailStats(phone || undefined) };
  }

  @Get('api/training/courses/:id/lessons')
  async getLessons(@Param('id') courseId: string) {
    const course = await this.trainingService.getCourseById(courseId);
    return { code: 0, data: course ? course.lessons : [] };
  }

  @Post('api/training/courses/:id/lessons')
  async addLesson(@Param('id') courseId: string, @Body() body: any) {
    const lesson = await this.trainingService.addLesson(courseId, body);
    return lesson ? { code: 0, data: lesson } : { code: -1, message: '课程不存在' };
  }

  @Put('api/training/courses/:cid/lessons/:lid')
  async updateLesson(@Param('cid') cid: string, @Param('lid') lid: string, @Body() body: any) {
    const lesson = await this.trainingService.updateLesson(cid, lid, body);
    return lesson ? { code: 0, data: lesson } : { code: -1, message: '课时不存在' };
  }

  @Delete('api/training/courses/:cid/lessons/:lid')
  async deleteLesson(@Param('cid') cid: string, @Param('lid') lid: string) {
    return { code: (await this.trainingService.deleteLesson(cid, lid)) ? 0 : -1 };
  }

  // ========== 题库 ==========
  @Get('api/exam/questions')
  async getQuestions() { return { code: 0, data: await this.examService.getQuestions() }; }

  @Post('api/exam/questions')
  async createQuestion(@Body() body: any) {
    return { code: 0, data: await this.examService.createQuestion(body) };
  }

  @Put('api/exam/questions/:id')
  async updateQuestion(@Param('id') id: string, @Body() body: any) {
    const q = await this.examService.updateQuestion(id, body);
    return q ? { code: 0, data: q } : { code: -1, message: '题目不存在' };
  }

  @Delete('api/exam/questions/:id')
  async deleteQuestion(@Param('id') id: string) {
    return { code: (await this.examService.deleteQuestion(id)) ? 0 : -1 };
  }

  @Post('api/exam/generate')
  async generateQuestions(@Body() body: any) {
    try {
      const questions = await this.examService.generateQuestionsWithAI(body.topic, body.count || 5);
      return { code: 0, data: questions };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  // ========== 考试 ==========
  @Get('api/exam/list')
  async getExamList() { return { code: 0, data: await this.examService.getExams() }; }

  @Get('api/exam/exam-stats')
  async getExamDetailStats() { return { code: 0, data: await this.examService.getExamDetailStats() }; }

  @Post('api/exam/create')
  async createExam(@Body() body: any) {
    return { code: 0, data: await this.examService.createExam(body) };
  }

  @Post('api/exam/:id/publish')
  async publishExam(@Param('id') id: string) {
    const e = await this.examService.publishExam(id);
    return e ? { code: 0, data: e } : { code: -1, message: '考试不存在' };
  }

  @Get('api/exam/:id/questions')
  async getExamQuestions(@Param('id') id: string) {
    const result = await this.examService.getExamQuestions(id);
    return { code: 0, data: result };
  }
}
