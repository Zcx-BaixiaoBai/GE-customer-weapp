-- 金鹰世界物业小程序 — MySQL 数据迁移脚本
-- 执行前请先创建数据库: CREATE DATABASE jinying_property CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE jinying_property;

-- ========== 培训模块 ==========

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '未命名课程',
  description TEXT,
  cover_image VARCHAR(500) DEFAULT '',
  category VARCHAR(100) DEFAULT '通用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lessons (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '未命名课时',
  type VARCHAR(20) DEFAULT 'video',
  video_url VARCHAR(500) DEFAULT '',
  duration INT DEFAULT 0,
  content TEXT,
  cover_image VARCHAR(500) DEFAULT '',
  `order` INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_records (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  progress INT DEFAULT 0,
  watched_duration INT DEFAULT 0,
  completed TINYINT(1) DEFAULT 0,
  last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_course_lesson_phone (course_id, lesson_id, phone),
  INDEX idx_phone (phone),
  INDEX idx_course (course_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 考试模块 ==========

CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(20) DEFAULT 'single',
  content TEXT NOT NULL,
  options JSON,
  `answer` JSON,
  score INT DEFAULT 1,
  explanation TEXT,
  category VARCHAR(100) DEFAULT '通用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exams (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '未命名考试',
  description TEXT,
  question_ids JSON,
  duration INT DEFAULT 60,
  pass_score INT DEFAULT 60,
  status VARCHAR(20) DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_submissions (
  id VARCHAR(64) PRIMARY KEY,
  exam_id VARCHAR(64) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  answers JSON,
  score INT DEFAULT 0,
  total_score INT DEFAULT 0,
  passed TINYINT(1) DEFAULT 0,
  detail JSON,
  duration INT DEFAULT 0,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exam (exam_id),
  INDEX idx_phone (phone),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 证书模块 ==========

CREATE TABLE IF NOT EXISTS certificates (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(100) DEFAULT '',
  exam_id VARCHAR(64) DEFAULT '',
  exam_title VARCHAR(255) DEFAULT '',
  score INT DEFAULT 0,
  total_score INT DEFAULT 0,
  percentage INT DEFAULT 0,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_phone_exam (phone, exam_id),
  INDEX idx_phone (phone),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
