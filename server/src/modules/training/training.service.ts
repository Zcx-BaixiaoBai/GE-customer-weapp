import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { databaseService } from '../../database/database.service';

// JSON 文件路径（降级用）
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const RECORDS_FILE = path.join(DATA_DIR, 'learning_records.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(COURSES_FILE)) fs.writeFileSync(COURSES_FILE, '[]');
  if (!fs.existsSync(RECORDS_FILE)) fs.writeFileSync(RECORDS_FILE, '[]');
}

function readJson(file: string): any[] {
  ensureDataFiles();
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) || []; } catch { return []; }
}

function writeJson(file: string, data: any[]): void {
  ensureDataFiles();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function genId(prefix: string): string {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

export interface Course {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  category: string;
  lessons: Lesson[];
  createdAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  type: string;
  videoUrl: string;
  duration: number;
  content: string;
  coverImage: string;
  order: number;
}

export interface LearningRecord {
  id: string;
  courseId: string;
  lessonId: string;
  phone: string;
  progress: number;
  watchedDuration: number;
  completed: boolean;
  lastWatchedAt: string;
}

export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);
  private useDb = false;

  constructor() {
    this.initDb();
  }

  private async initDb() {
    try {
      const healthy = await databaseService.isHealthy();
      this.useDb = healthy;
      if (healthy) {
        this.logger.log('培训模块使用 MySQL 存储');
      } else {
        this.logger.warn('MySQL 不可用，降级为 JSON 文件存储');
      }
    } catch (e) {
      this.logger.warn('MySQL 初始化失败，降级为 JSON: ' + e.message);
      this.useDb = false;
    }
  }

  // ========== 课程 CRUD ==========

  async getAllCourses(): Promise<Course[]> {
    if (this.useDb) {
      try {
        const courses = await databaseService.query('SELECT * FROM courses ORDER BY created_at DESC');
        return courses.map(this.mapCourseRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
      }
    }
    return this.jsonGetAllCourses();
  }

  private async jsonGetAllCourses(): Promise<Course[]> {
    const courses = readJson(COURSES_FILE);
    return courses;
  }

  async getCourseById(id: string): Promise<Course | null> {
    if (this.useDb) {
      try {
        const courses = await databaseService.query('SELECT * FROM courses WHERE id = ?', [id]);
        if (courses.length === 0) return null;
        const lessons = await databaseService.query(
          'SELECT * FROM lessons WHERE course_id = ? ORDER BY `order`', [id]
        );
        return { ...this.mapCourseRow(courses[0]), lessons: lessons.map(this.mapLessonRow) };
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
      }
    }
    const courses = readJson(COURSES_FILE);
    return courses.find((c) => c.id === id) || null;
  }

  async createCourse(data: Partial<Course>): Promise<Course> {
    const id = genId('TR');
    const title = data.title || '未命名课程';
    const description = data.description || '';
    const coverImage = data.coverImage || '';
    const category = data.category || '通用';
    const createdAt = new Date().toISOString();
    const lessons = data.lessons || [];

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO courses (id, title, description, cover_image, category, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [id, title, description, coverImage, category, new Date()]
        );
        // 插入课时
        for (let i = 0; i < lessons.length; i++) {
          const l = lessons[i];
          await this.insertLessonDb(id, l, i + 1);
        }
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    if (!this.useDb) {
      const courses = readJson(COURSES_FILE);
      courses.push({ id, title, description, coverImage, category, lessons, createdAt });
      writeJson(COURSES_FILE, courses);
    }

    return { id, title, description, coverImage, category, lessons, createdAt };
  }

  async updateCourse(id: string, data: Partial<Course>): Promise<Course | null> {
    if (this.useDb) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
        if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
        if (data.coverImage !== undefined) { fields.push('cover_image = ?'); values.push(data.coverImage); }
        if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
        if (fields.length > 0) {
          values.push(id);
          await databaseService.query(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, values);
        }
      } catch (e) {
        this.logger.warn('MySQL更新失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    if (!this.useDb) {
      const courses = readJson(COURSES_FILE);
      const idx = courses.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      courses[idx] = { ...courses[idx], ...data, id };
      writeJson(COURSES_FILE, courses);
      return courses[idx];
    }

    return this.getCourseById(id);
  }

  async deleteCourse(id: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query('DELETE FROM courses WHERE id = ?', [id]);
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    const courses = readJson(COURSES_FILE);
    const filtered = courses.filter((c) => c.id !== id);
    writeJson(COURSES_FILE, filtered);
    const records = readJson(RECORDS_FILE);
    writeJson(RECORDS_FILE, records.filter((r) => r.courseId !== id));
    return filtered.length < courses.length;
  }

  // ========== 课时 ==========

  private async insertLessonDb(courseId: string, lessonData: Partial<Lesson>, order: number): Promise<void> {
    const id = lessonData.id || genId('LS');
    await databaseService.query(
      'INSERT INTO lessons (id, course_id, title, type, video_url, duration, content, cover_image, `order`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, courseId, lessonData.title || '未命名课时', lessonData.type || 'video',
       lessonData.videoUrl || '', lessonData.duration || 0,
       lessonData.content || '', lessonData.coverImage || '', order]
    );
  }

  async addLesson(courseId: string, lessonData: Partial<Lesson>): Promise<Lesson | null> {
    const lesson: Lesson = {
      id: genId('LS'),
      title: lessonData.title || '未命名课时',
      type: lessonData.type || 'video',
      videoUrl: lessonData.videoUrl || '',
      duration: lessonData.duration || 0,
      content: lessonData.content || '',
      coverImage: lessonData.coverImage || '',
      order: 0,
    };

    if (this.useDb) {
      try {
        // 获取当前课时数作为 order
        const count = await databaseService.query(
          'SELECT COUNT(*) as cnt FROM lessons WHERE course_id = ?', [courseId]
        );
        lesson.order = count[0].cnt + 1;
        await this.insertLessonDb(courseId, lesson, lesson.order);
        return lesson;
      } catch (e) {
        this.logger.warn('MySQL插入课时失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    if (!this.useDb) {
      const courses = readJson(COURSES_FILE);
      const course = courses.find((c) => c.id === courseId);
      if (!course) return null;
      lesson.order = course.lessons.length + 1;
      course.lessons.push(lesson);
      writeJson(COURSES_FILE, courses);
      return lesson;
    }
    return lesson;
  }

  async updateLesson(courseId: string, lessonId: string, data: Partial<Lesson>): Promise<Lesson | null> {
    if (this.useDb) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
        if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
        if (data.videoUrl !== undefined) { fields.push('video_url = ?'); values.push(data.videoUrl); }
        if (data.duration !== undefined) { fields.push('duration = ?'); values.push(data.duration); }
        if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
        if (data.coverImage !== undefined) { fields.push('cover_image = ?'); values.push(data.coverImage); }
        if (fields.length > 0) {
          values.push(lessonId, courseId);
          await databaseService.query(
            `UPDATE lessons SET ${fields.join(', ')} WHERE id = ? AND course_id = ?`, values
          );
        }
        const rows = await databaseService.query(
          'SELECT * FROM lessons WHERE id = ? AND course_id = ?', [lessonId, courseId]
        );
        return rows.length > 0 ? this.mapLessonRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL更新课时失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    const courses = readJson(COURSES_FILE);
    const course = courses.find((c) => c.id === courseId);
    if (!course) return null;
    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (!lesson) return null;
    Object.assign(lesson, data, { id: lessonId });
    writeJson(COURSES_FILE, courses);
    return lesson;
  }

  async deleteLesson(courseId: string, lessonId: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query(
          'DELETE FROM lessons WHERE id = ? AND course_id = ?', [lessonId, courseId]
        );
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除课时失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    const courses = readJson(COURSES_FILE);
    const course = courses.find((c) => c.id === courseId);
    if (!course) return false;
    const before = course.lessons.length;
    course.lessons = course.lessons.filter((l) => l.id !== lessonId);
    writeJson(COURSES_FILE, courses);
    return course.lessons.length < before;
  }

  // ========== 学习记录 ==========

  async getProgress(courseId: string, phone: string): Promise<LearningRecord[]> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query(
          'SELECT * FROM learning_records WHERE course_id = ? AND phone = ?', [courseId, phone]
        );
        return rows.map(this.mapRecordRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const records = readJson(RECORDS_FILE);
    return records.filter((r) => r.courseId === courseId && r.phone === phone);
  }

  async updateProgress(data: {
    courseId: string;
    lessonId: string;
    phone: string;
    progress: number;
    watchedDuration: number;
  }): Promise<LearningRecord> {
    const completed = data.progress >= 90 ? 1 : 0;
    const now = new Date();

    if (this.useDb) {
      try {
        // 使用 UPSERT：有就更新，没有就插入
        await databaseService.query(
          `INSERT INTO learning_records (id, course_id, lesson_id, phone, progress, watched_duration, completed, last_watched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             progress = GREATEST(progress, VALUES(progress)),
             watched_duration = GREATEST(watched_duration, VALUES(watched_duration)),
             completed = GREATEST(completed, VALUES(completed)),
             last_watched_at = VALUES(last_watched_at)`,
          [genId('LR'), data.courseId, data.lessonId, data.phone,
           data.progress, data.watchedDuration, completed, now]
        );
        const rows = await databaseService.query(
          'SELECT * FROM learning_records WHERE course_id = ? AND lesson_id = ? AND phone = ?',
          [data.courseId, data.lessonId, data.phone]
        );
        return this.mapRecordRow(rows[0]);
      } catch (e) {
        this.logger.warn('MySQL更新进度失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    const records = readJson(RECORDS_FILE);
    const existing = records.find(
      (r) => r.courseId === data.courseId && r.lessonId === data.lessonId && r.phone === data.phone
    );
    if (existing) {
      existing.progress = Math.max(existing.progress, data.progress);
      existing.watchedDuration = Math.max(existing.watchedDuration, data.watchedDuration);
      existing.completed = existing.progress >= 90;
      existing.lastWatchedAt = now.toISOString();
      writeJson(RECORDS_FILE, records);
      return existing;
    }
    const record: LearningRecord = {
      id: genId('LR'), courseId: data.courseId, lessonId: data.lessonId, phone: data.phone,
      progress: data.progress, watchedDuration: data.watchedDuration,
      completed: data.progress >= 90, lastWatchedAt: now.toISOString(),
    };
    records.push(record);
    writeJson(RECORDS_FILE, records);
    return record;
  }

  // ========== 统计 ==========

  async getLearningStats(phone: string): Promise<any> {
    if (this.useDb) {
      try {
        const courses = await databaseService.query('SELECT * FROM courses');
        const records = await databaseService.query(
          'SELECT * FROM learning_records WHERE phone = ?', [phone]
        );
        return this.computeLearningStats(courses.map(this.mapCourseRow), records.map(this.mapRecordRow));
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const courses = readJson(COURSES_FILE);
    const records = readJson(RECORDS_FILE).filter((r) => r.phone === phone);
    return this.computeLearningStats(courses, records);
  }

  private computeLearningStats(courses: any[], records: any[]) {
    const courseProgress = new Map<string, { completed: number; total: number; duration: number }>();
    for (const c of courses) {
      courseProgress.set(c.id, { completed: 0, total: (c.lessons || []).length, duration: 0 });
    }
    for (const r of records) {
      const cp = courseProgress.get(r.courseId);
      if (cp) {
        if (r.completed) cp.completed++;
        cp.duration += r.watchedDuration || 0;
      }
    }
    let completedCourses = 0;
    let totalDuration = 0;
    const currentLearning: any[] = [];
    for (const [cid, cp] of courseProgress) {
      totalDuration += cp.duration;
      const course = courses.find((c) => c.id === cid);
      if (cp.total > 0 && cp.completed >= cp.total) {
        completedCourses++;
      } else if (cp.completed > 0 || cp.duration > 0) {
        currentLearning.push({
          courseId: cid, title: course?.title || '', coverImage: course?.coverImage || '',
          progress: cp.total > 0 ? Math.round((cp.completed / cp.total) * 100) : 0,
          watchedDuration: cp.duration,
        });
      }
    }
    return { totalCourses: courses.length, completedCourses, totalWatchedDuration: totalDuration, currentLearning };
  }

  async getGlobalStats(): Promise<any> {
    if (this.useDb) {
      try {
        const courses = await databaseService.query('SELECT * FROM courses');
        const records = await databaseService.query('SELECT * FROM learning_records');
        let totalLessons = 0;
        let totalDuration = 0;
        for (const c of courses) {
          const lessons = await databaseService.query('SELECT COUNT(*) as cnt FROM lessons WHERE course_id = ?', [c.id]);
          totalLessons += lessons[0].cnt;
        }
        const uniquePhones = new Set(records.map((r: any) => r.phone));
        const completedRecords = records.filter((r: any) => r.completed);
        return {
          totalCourses: courses.length, totalLessons, totalDuration,
          totalLearners: uniquePhones.size, totalCompletedRecords: completedRecords.length,
        };
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const courses = readJson(COURSES_FILE);
    const records = readJson(RECORDS_FILE);
    let totalLessons = 0;
    let totalDuration = 0;
    for (const c of courses) {
      totalLessons += (c.lessons || []).length;
      for (const l of c.lessons || []) totalDuration += l.duration || 0;
    }
    const uniquePhones = new Set(records.map((r: any) => r.phone));
    return {
      totalCourses: courses.length, totalLessons, totalDuration,
      totalLearners: uniquePhones.size,
      totalCompletedRecords: records.filter((r: any) => r.completed).length,
    };
  }

  async getCourseDetailStats(phone?: string): Promise<any[]> {
    if (this.useDb) {
      try {
        const courses = await databaseService.query('SELECT * FROM courses');
        const records = phone
          ? await databaseService.query('SELECT * FROM learning_records WHERE phone = ?', [phone])
          : await databaseService.query('SELECT * FROM learning_records');
        return this.computeCourseDetailStats(courses.map(this.mapCourseRow), records.map(this.mapRecordRow));
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const courses = readJson(COURSES_FILE);
    const records = readJson(RECORDS_FILE);
    return this.computeCourseDetailStats(courses, records.filter((r) => !phone || r.phone === phone));
  }

  private computeCourseDetailStats(courses: any[], records: any[]) {
    return courses.map((c) => {
      var courseRecords = records.filter((r) => r.courseId === c.id);
      var learnerMap: any = {};
      for (var r of courseRecords) {
        if (!learnerMap[r.phone]) learnerMap[r.phone] = { phone: r.phone, completed: 0, watchedDuration: 0, lastActive: '' };
        if (r.completed) learnerMap[r.phone].completed++;
        learnerMap[r.phone].watchedDuration += r.watchedDuration || 0;
        if (r.lastWatchedAt > learnerMap[r.phone].lastActive) learnerMap[r.phone].lastActive = r.lastWatchedAt;
      }
      var learners = Object.values(learnerMap) as any[];
      var totalLessons = (c.lessons || []).length;
      var completedLearners = learners.filter((l) => l.completed >= totalLessons && totalLessons > 0).length;
      var avgProgress = learners.length > 0 ? Math.round(learners.reduce((s, l) => s + (totalLessons > 0 ? (l.completed / totalLessons) * 100 : 0), 0) / learners.length) : 0;
      return {
        courseId: c.id, title: c.title, category: c.category,
        totalLessons, totalDuration: (c.lessons || []).reduce((sum: number, l: any) => sum + (l.duration || 0), 0),
        learnerCount: learners.length, completedCount: completedLearners, avgProgress, learners,
      };
    });
  }

  // ========== 行映射 ==========

  private mapCourseRow(row: any): Course {
    return {
      id: row.id, title: row.title, description: row.description || '',
      coverImage: row.cover_image || '', category: row.category || '',
      lessons: [], createdAt: row.created_at,
    };
  }

  private mapLessonRow(row: any): Lesson {
    return {
      id: row.id, title: row.title, type: row.type || 'video',
      videoUrl: row.video_url || '', duration: row.duration || 0,
      content: row.content || '', coverImage: row.cover_image || '',
      order: row.order || 0,
    };
  }

  private mapRecordRow(row: any): LearningRecord {
    return {
      id: row.id, courseId: row.course_id, lessonId: row.lesson_id,
      phone: row.phone, progress: row.progress || 0,
      watchedDuration: row.watched_duration || 0,
      completed: !!row.completed, lastWatchedAt: row.last_watched_at || row.updated_at,
    };
  }
}
