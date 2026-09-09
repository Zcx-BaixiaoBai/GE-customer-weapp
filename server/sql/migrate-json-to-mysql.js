/**
 * JSON → MySQL 数据迁移脚本
 * 运行: node sql/migrate-json-to-mysql.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); } catch { return []; }
}

// ISO 字符串转 MySQL datetime
function toMySQLDate(iso) {
  if (!iso) return new Date();
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch { return new Date(); }
}

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'jinying',
    password: process.env.DB_PASSWORD || '',   // 密码只从环境变量读取，禁止硬编码入库
    database: process.env.DB_NAME || 'jinying_property',
    charset: 'utf8mb4',
  });

  // ========== 课程 ==========
  const courses = readJson('courses.json');
  for (const c of courses) {
    await pool.execute(
      'INSERT INTO courses (id, title, description, cover_image, category, created_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title)',
      [c.id, c.title, c.description || '', c.coverImage || '', c.category || '通用', toMySQLDate(c.createdAt)]
    );
    // 课时
    for (const l of (c.lessons || [])) {
      await pool.execute(
        'INSERT INTO lessons (id, course_id, title, type, video_url, duration, content, cover_image, `order`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title)',
        [l.id, c.id, l.title, l.type || 'video', l.videoUrl || '', l.duration || 0, l.content || '', l.coverImage || '', l.order || 0]
      );
    }
  }
  console.log(`✅ 课程: ${courses.length} 条, 课时: ${courses.reduce((s, c) => s + (c.lessons?.length || 0), 0)} 条`);

  // ========== 学习记录 ==========
  const records = readJson('learning_records.json');
  for (const r of records) {
    await pool.execute(
      'INSERT INTO learning_records (id, course_id, lesson_id, phone, progress, watched_duration, completed, last_watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE progress=VALUES(progress)',
      [r.id, r.courseId, r.lessonId, r.phone, r.progress || 0, r.watchedDuration || 0, r.completed ? 1 : 0, toMySQLDate(r.lastWatchedAt)]
    );
  }
  console.log(`✅ 学习记录: ${records.length} 条`);

  // ========== 题目 ==========
  const questions = readJson('exam_questions.json');
  for (const q of questions) {
    await pool.execute(
      'INSERT INTO questions (id, type, content, options, `answer`, score, explanation, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content=VALUES(content)',
      [q.id, q.type, q.content, JSON.stringify(q.options), JSON.stringify(q.answer), q.score || 1, q.explanation || '', q.category || '通用']
    );
  }
  console.log(`✅ 题目: ${questions.length} 条`);

  // ========== 考试 ==========
  const exams = readJson('exams.json');
  for (const e of exams) {
    await pool.execute(
      'INSERT INTO exams (id, title, description, question_ids, duration, pass_score, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title)',
      [e.id, e.title, e.description || '', JSON.stringify(e.questionIds || []), e.duration || 60, e.passScore || 60, e.status || 'draft']
    );
  }
  console.log(`✅ 考试: ${exams.length} 条`);

  // ========== 提交记录 ==========
  const submissions = readJson('exam_submissions.json');
  for (const s of submissions) {
    await pool.execute(
      'INSERT INTO exam_submissions (id, exam_id, phone, answers, score, total_score, passed, detail, duration, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score=VALUES(score)',
      [s.id, s.examId, s.phone, JSON.stringify(s.answers), s.score, s.totalScore, s.passed ? 1 : 0, JSON.stringify(s.detail), s.duration || 0, toMySQLDate(s.submittedAt)]
    );
  }
  console.log(`✅ 考试提交: ${submissions.length} 条`);

  // ========== 证书 ==========
  const certs = readJson('certificates.json');
  for (const c of certs) {
    await pool.execute(
      'INSERT INTO certificates (id, phone, name, exam_id, exam_title, score, total_score, percentage, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE percentage=VALUES(percentage)',
      [c.id, c.phone, c.name || '', c.examId || '', c.examTitle || '', c.score || 0, c.totalScore || 0, c.percentage || 0, toMySQLDate(c.issuedAt)]
    );
  }
  console.log(`✅ 证书: ${certs.length} 条`);

  await pool.end();
  console.log('\n🎉 迁移完成！');
}

migrate().catch(err => { console.error('迁移失败:', err.message); process.exit(1); });
