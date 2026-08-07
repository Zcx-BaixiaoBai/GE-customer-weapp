import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { config } from '../../config/configuration';
import { CertificateService } from './certificate.service';
import { databaseService } from '../../database/database.service';

// JSON 文件路径（降级用）
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'exam_questions.json');
const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'exam_submissions.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const f of [QUESTIONS_FILE, EXAMS_FILE, SUBMISSIONS_FILE]) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
  }
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

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'judge';
  content: string;
  options: string[];
  answer: number[];
  score: number;
  explanation?: string;
  category?: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  questionIds: string[];
  duration: number;
  passScore: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
}

export interface Submission {
  id: string;
  examId: string;
  phone: string;
  answers: { questionId: string; selected: number[] }[];
  score: number;
  totalScore: number;
  passed: boolean;
  detail: { questionId: string; correct: boolean; correctAnswer: number[]; userAnswer: number[] }[];
  submittedAt: string;
  duration: number;
}

export class ExamService {
  private readonly logger = new Logger(ExamService.name);
  private certificateService = new CertificateService();
  private useDb = false;

  constructor() {
    this.initDb();
  }

  private async initDb() {
    try {
      const healthy = await databaseService.isHealthy();
      this.useDb = healthy;
      if (healthy) this.logger.log('考试模块使用 MySQL 存储');
      else this.logger.warn('MySQL 不可用，降级为 JSON 文件存储');
    } catch (e) {
      this.logger.warn('MySQL 初始化失败，降级JSON: ' + e.message);
    }
  }

  // ========== 题库 ==========

  async getQuestions(category?: string): Promise<Question[]> {
    if (this.useDb) {
      try {
        const rows = category
          ? await databaseService.query('SELECT * FROM questions WHERE category = ?', [category])
          : await databaseService.query('SELECT * FROM questions ORDER BY created_at DESC');
        return rows.map(this.mapQuestionRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const questions = readJson(QUESTIONS_FILE);
    return category ? questions.filter((q) => q.category === category) : questions;
  }

  async createQuestion(data: Partial<Question>): Promise<Question> {
    const id = genId('EX');
    const q: Question = {
      id,
      type: (data.type as any) || 'single',
      content: data.content || '',
      options: data.options || [],
      answer: data.answer || [],
      score: data.score || 1,
      explanation: data.explanation || '',
      category: data.category || '通用',
      createdAt: new Date().toISOString(),
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO questions (id, type, content, options, `answer`, score, explanation, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, q.type, q.content, JSON.stringify(q.options), JSON.stringify(q.answer),
           q.score, q.explanation, q.category]
        );
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }

    if (!this.useDb) {
      const questions = readJson(QUESTIONS_FILE);
      questions.push(q);
      writeJson(QUESTIONS_FILE, questions);
    }
    return q;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query('DELETE FROM questions WHERE id = ?', [id]);
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const questions = readJson(QUESTIONS_FILE);
    const filtered = questions.filter((q) => q.id !== id);
    writeJson(QUESTIONS_FILE, filtered);
    return filtered.length < questions.length;
  }

  async updateQuestion(id: string, data: Partial<Question>): Promise<Question | null> {
    if (this.useDb) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
        if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
        if (data.options !== undefined) { fields.push('options = ?'); values.push(JSON.stringify(data.options)); }
        if (data.answer !== undefined) { fields.push('`answer` = ?'); values.push(JSON.stringify(data.answer)); }
        if (data.score !== undefined) { fields.push('score = ?'); values.push(data.score); }
        if (data.explanation !== undefined) { fields.push('explanation = ?'); values.push(data.explanation); }
        if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
        if (fields.length > 0) {
          values.push(id);
          await databaseService.query(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        const rows = await databaseService.query('SELECT * FROM questions WHERE id = ?', [id]);
        return rows.length > 0 ? this.mapQuestionRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL更新失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const questions = readJson(QUESTIONS_FILE);
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    questions[idx] = { ...questions[idx], ...data, id };
    writeJson(QUESTIONS_FILE, questions);
    return questions[idx];
  }

  // ========== 考试 ==========

  async getExams(): Promise<Exam[]> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM exams ORDER BY created_at DESC');
        return rows.map(this.mapExamRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    return readJson(EXAMS_FILE);
  }

  async getExamById(id: string): Promise<Exam | null> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM exams WHERE id = ?', [id]);
        return rows.length > 0 ? this.mapExamRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const exams = readJson(EXAMS_FILE);
    return exams.find((e) => e.id === id) || null;
  }

  async createExam(data: Partial<Exam>): Promise<Exam> {
    const id = genId('EX');
    const exam: Exam = {
      id, title: data.title || '未命名考试', description: data.description || '',
      questionIds: data.questionIds || [], duration: data.duration || 60,
      passScore: data.passScore || 60, status: 'draft',
      createdAt: new Date().toISOString(),
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO exams (id, title, description, question_ids, duration, pass_score, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, exam.title, exam.description, JSON.stringify(exam.questionIds),
           exam.duration, exam.passScore, exam.status]
        );
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    if (!this.useDb) {
      const exams = readJson(EXAMS_FILE);
      exams.push(exam);
      writeJson(EXAMS_FILE, exams);
    }
    return exam;
  }

  async publishExam(id: string): Promise<Exam | null> {
    if (this.useDb) {
      try {
        await databaseService.query("UPDATE exams SET status = 'published' WHERE id = ?", [id]);
        return this.getExamById(id);
      } catch (e) {
        this.logger.warn('MySQL更新失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const exams = readJson(EXAMS_FILE);
    const exam = exams.find((e) => e.id === id);
    if (!exam) return null;
    exam.status = 'published';
    writeJson(EXAMS_FILE, exams);
    return exam;
  }

  async getExamQuestions(examId: string): Promise<{ exam: Exam | null; questions: any[] }> {
    const exam = await this.getExamById(examId);
    if (!exam) return { exam: null, questions: [] };

    const allQuestions = await this.getQuestions();
    const questions = exam.questionIds
      .map((qid) => allQuestions.find((q) => q.id === qid))
      .filter(Boolean)
      .map((q) => ({ id: q.id, type: q.type, content: q.content, options: q.options, score: q.score }));
    return { exam, questions };
  }

  // ========== 提交评分 ==========

  async submitExam(data: {
    examId: string; phone: string;
    answers: { questionId: string; selected: number[] }[];
    duration: number;
  }): Promise<Submission> {
    const exam = await this.getExamById(data.examId);
    if (!exam) throw new Error('考试不存在');

    const allQuestions = await this.getQuestions();
    const examQuestions = exam.questionIds
      .map((qid) => allQuestions.find((q) => q.id === qid))
      .filter(Boolean);

    let score = 0;
    let totalScore = 0;
    const detail: any[] = [];
    for (const q of examQuestions) {
      totalScore += q.score;
      const userAnswer = data.answers.find((a) => a.questionId === q.id);
      const selected = userAnswer ? userAnswer.selected : [];
      const correct = selected.length === q.answer.length && selected.every((s) => q.answer.includes(s));
      if (correct) score += q.score;
      detail.push({ questionId: q.id, correct, correctAnswer: q.answer, userAnswer: selected });
    }

    const passed = (score / totalScore) * 100 >= exam.passScore;
    const submission: Submission = {
      id: genId('SUB'), examId: data.examId, phone: data.phone, answers: data.answers,
      score, totalScore, passed, detail,
      submittedAt: new Date().toISOString(), duration: data.duration,
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO exam_submissions (id, exam_id, phone, answers, score, total_score, passed, detail, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [submission.id, data.examId, data.phone, JSON.stringify(data.answers),
           score, totalScore, passed ? 1 : 0, JSON.stringify(detail), data.duration]
        );
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    if (!this.useDb) {
      const submissions = readJson(SUBMISSIONS_FILE);
      submissions.push(submission);
      writeJson(SUBMISSIONS_FILE, submissions);
    }

    // 证书
    if (passed) {
      try {
        const existing = await this.certificateService.findByPhoneAndExam(data.phone, data.examId);
        if (!existing) {
          await this.certificateService.create({
            phone: data.phone, examId: data.examId, examTitle: exam.title,
            score, totalScore, percentage: Math.round((score / totalScore) * 100),
          });
        }
      } catch (err) {
        this.logger.error('生成证书失败: ' + err.message);
      }
    }
    return submission;
  }

  async getResult(submissionId: string): Promise<Submission | null> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM exam_submissions WHERE id = ?', [submissionId]);
        return rows.length > 0 ? this.mapSubmissionRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const submissions = readJson(SUBMISSIONS_FILE);
    return submissions.find((s) => s.id === submissionId) || null;
  }

  async getUserSubmissions(phone: string): Promise<Submission[]> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM exam_submissions WHERE phone = ? ORDER BY submitted_at DESC', [phone]);
        return rows.map(this.mapSubmissionRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const submissions = readJson(SUBMISSIONS_FILE);
    return submissions.filter((s) => s.phone === phone);
  }

  // ========== 统计 ==========

  async getExamStats(phone: string): Promise<any> {
    if (this.useDb) {
      try {
        const exams = await databaseService.query("SELECT * FROM exams WHERE status = 'published'");
        const submissions = await databaseService.query('SELECT * FROM exam_submissions WHERE phone = ? ORDER BY submitted_at DESC', [phone]);
        return this.computeExamStats(exams.map(this.mapExamRow), submissions.map(this.mapSubmissionRow));
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const exams = readJson(EXAMS_FILE).filter((e) => e.status === 'published');
    const submissions = readJson(SUBMISSIONS_FILE).filter((s) => s.phone === phone);
    return this.computeExamStats(exams, submissions);
  }

  private computeExamStats(exams: any[], submissions: any[]) {
    const totalSubmissions = submissions.length;
    const passedCount = submissions.filter((s) => s.passed).length;
    const avgScore = totalSubmissions > 0
      ? Math.round(submissions.reduce((sum, s) => sum + (s.score / s.totalScore) * 100, 0) / totalSubmissions * 10) / 10 : 0;
    const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;
    const examMap = new Map(exams.map((e) => [e.id, e]));
    const recentSubmissions = submissions.slice(-10).reverse().map((s) => ({
      id: s.id, examId: s.examId,
      examTitle: examMap.get(s.examId)?.title || '未知考试',
      score: s.score, totalScore: s.totalScore,
      percentage: Math.round((s.score / s.totalScore) * 100),
      passed: s.passed, duration: s.duration, submittedAt: s.submittedAt,
    }));
    return { totalExams: exams.length, totalSubmissions, passedCount, avgScore, passRate, recentSubmissions };
  }

  async getExamDetailStats(): Promise<any[]> {
    if (this.useDb) {
      try {
        const exams = await databaseService.query('SELECT * FROM exams');
        const submissions = await databaseService.query('SELECT * FROM exam_submissions');
        return this.computeExamDetailStats(exams.map(this.mapExamRow), submissions.map(this.mapSubmissionRow));
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const exams = readJson(EXAMS_FILE);
    const submissions = readJson(SUBMISSIONS_FILE);
    return this.computeExamDetailStats(exams, submissions);
  }

  private computeExamDetailStats(exams: any[], submissions: any[]) {
    return exams.map((e) => {
      var examSubs = submissions.filter((s) => s.examId === e.id);
      var passed = examSubs.filter((s) => s.passed);
      var avgScore = examSubs.length > 0 ? Math.round(examSubs.reduce((sum, s) => sum + (s.score / s.totalScore) * 100, 0) / examSubs.length * 10) / 10 : 0;
      var passRate = examSubs.length > 0 ? Math.round(passed.length / examSubs.length * 100) : 0;
      var learnerMap: any = {};
      for (var s of examSubs) {
        if (!learnerMap[s.phone]) learnerMap[s.phone] = { phone: s.phone, attempts: 0, bestScore: 0, passed: false, lastAttempt: '' };
        learnerMap[s.phone].attempts++;
        var pct = Math.round((s.score / s.totalScore) * 100);
        if (pct > learnerMap[s.phone].bestScore) learnerMap[s.phone].bestScore = pct;
        if (s.passed) learnerMap[s.phone].passed = true;
        if (s.submittedAt > learnerMap[s.phone].lastAttempt) learnerMap[s.phone].lastAttempt = s.submittedAt;
      }
      return {
        examId: e.id, title: e.title, status: e.status,
        questionCount: (e.questionIds || []).length, duration: e.duration, passScore: e.passScore,
        totalAttempts: examSubs.length, uniqueLearners: Object.keys(learnerMap).length,
        passedCount: passed.length, avgScore, passRate, learners: Object.values(learnerMap),
      };
    });
  }

  // ========== AI生成题目 ==========

  async generateQuestionsWithAI(topic: string, count: number = 5): Promise<any[]> {
    let apiUrl = '', apiKey = '';
    if (config.llm.apiKey && config.llm.baseUrl) {
      apiUrl = config.llm.baseUrl + '/chat/completions'; apiKey = config.llm.apiKey;
    } else if (config.fastgpt.apiKey) {
      apiUrl = config.fastgpt.baseUrl + '/chat/completions'; apiKey = config.fastgpt.apiKey;
    } else {
      throw new Error('未配置LLM API，请在.env中设置LLM_API_KEY和LLM_BASE_URL');
    }

    const prompt = `你是金鹰世界商场的培训出题专家。请根据主题"${topic}"生成${count}道考试题目。
要求：
1. 题目类型混合：单选题、多选题、判断题都要有
2. 每道题有4个选项（判断题2个：正确/错误）
3. 标注正确答案
4. 附带解析说明
5. 题目要贴合商场物业管理实际场景
返回JSON数组格式，每个元素结构如下：
{"type": "single|multiple|judge", "content": "题干内容", "options": ["选项A", "选项B", "选项C", "选项D"], "answer": [0], "score": 2, "explanation": "解析说明", "category": "${topic}"}
注意：answer是正确选项的索引数组（从0开始），多选题有多个索引，只返回JSON数组，不要其他文字`;

    const requestBody: any = {
      messages: [
        { role: 'system', content: 'You are a JSON generator. Only output valid JSON array, no other text.' },
        { role: 'user', content: prompt },
      ],
      stream: false, detail: false,
    };
    if (config.llm.apiKey && config.llm.baseUrl) {
      if (config.llm.model) requestBody.model = config.llm.model;
      requestBody.max_tokens = 2000; requestBody.temperature = 0.7;
    }

    const response = await axios.post(apiUrl, requestBody, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      timeout: config.llm.timeout || 30000,
    });

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI返回格式异常，未找到JSON数组');
    const aiQuestions = JSON.parse(jsonMatch[0]);
    const createdQuestions: Question[] = [];
    for (const aiQ of aiQuestions) {
      const q: Question = {
        id: genId('EX'), type: aiQ.type || 'single', content: aiQ.content || '',
        options: aiQ.options || [], answer: aiQ.answer || [],
        score: aiQ.score || 2, explanation: aiQ.explanation || '',
        category: topic, createdAt: new Date().toISOString(),
      };
      await this.createQuestion(q);
      createdQuestions.push(q);
    }
    return createdQuestions;
  }

  // ========== 行映射 ==========

  private mapQuestionRow(row: any): Question {
    return {
      id: row.id, type: row.type, content: row.content,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || []),
      answer: typeof row.answer === 'string' ? JSON.parse(row.answer) : (row.answer || []),
      score: row.score, explanation: row.explanation || '',
      category: row.category || '', createdAt: row.created_at,
    };
  }

  private mapExamRow(row: any): Exam {
    return {
      id: row.id, title: row.title, description: row.description || '',
      questionIds: typeof row.question_ids === 'string' ? JSON.parse(row.question_ids) : (row.question_ids || []),
      duration: row.duration, passScore: row.pass_score,
      status: row.status, createdAt: row.created_at,
    };
  }

  private mapSubmissionRow(row: any): Submission {
    return {
      id: row.id, examId: row.exam_id, phone: row.phone,
      answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : (row.answers || []),
      score: row.score, totalScore: row.total_score,
      passed: !!row.passed,
      detail: typeof row.detail === 'string' ? JSON.parse(row.detail) : (row.detail || []),
      submittedAt: row.submitted_at, duration: row.duration,
    };
  }
}
