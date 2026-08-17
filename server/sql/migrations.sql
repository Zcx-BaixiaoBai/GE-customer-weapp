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

-- ========== 组织架构模块（租户管理） ==========
-- 自定义架构树：项目 → 楼层 → 租户（可扩展自定义层级）
-- 采用邻接表模型（parent_id + level），支持任意层级

CREATE TABLE IF NOT EXISTS org_nodes (
  id VARCHAR(64) PRIMARY KEY,
  parent_id VARCHAR(64) DEFAULT NULL,               -- 父节点，根节点为 NULL
  node_type VARCHAR(30) NOT NULL DEFAULT 'tenant',   -- project | floor | tenant | 自定义类型
  name VARCHAR(255) NOT NULL DEFAULT '未命名节点',
  code VARCHAR(100) DEFAULT '',                      -- 编码（如 F1/B1/品牌号）
  level INT NOT NULL DEFAULT 0,                       -- 层级深度，根节点 = 0
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  INDEX idx_type (node_type),
  INDEX idx_level (level),
  FOREIGN KEY (parent_id) REFERENCES org_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户（租户员工）：手机号关联到组织架构节点
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(100) DEFAULT '',
  avatar VARCHAR(500) DEFAULT '',
  org_node_id VARCHAR(64) DEFAULT NULL,               -- 所属租户节点
  position VARCHAR(100) DEFAULT '',                   -- 岗位
  role VARCHAR(20) DEFAULT 'employee',                -- manager(店长) | employee(员工)
  status VARCHAR(20) DEFAULT 'active',                -- active | inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_phone (phone),
  INDEX idx_org (org_node_id),
  FOREIGN KEY (org_node_id) REFERENCES org_nodes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 入职必修项：标记哪些课程/考试属于入职必学必考
-- 不直接修改 courses/exams 表，单独管理，幂等且灵活
CREATE TABLE IF NOT EXISTS onboarding_items (
  id VARCHAR(64) PRIMARY KEY,
  item_type VARCHAR(20) NOT NULL,                     -- course | exam
  item_id VARCHAR(64) NOT NULL,                       -- 课程或考试的 id
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_item (item_type, item_id),
  INDEX idx_type (item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
