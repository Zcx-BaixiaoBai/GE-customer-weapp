# 金鹰世界商场物业小程序

> 金鹰世界商场物业小程序 — 面向商场租户与顾客的智能物业服务系统。
> AI 知识库问答 + 智能报修 + 培训考试，三期渐进式交付。

## 项目简介

金鹰世界商场物业小程序为商场租户和顾客提供三大核心服务：

1. **AI 知识库问答** — 商场运营知识、物业规则、入驻指南等智能问答，基于 FastGPT RAG 引擎
2. **智能报修** — 拍照 + 语音描述，FunASR 语音转文字 → LLM 校验信息完整性 → 自动填表提交工单
3. **培训考试** — 培训内容浏览 + AI 培训助手 + 题库练习 + 在线考试 + 证书管理

## 功能概览

| 模块 | 功能 | 状态 |
|------|------|------|
| AI 问答 | FastGPT 流式对话、多轮上下文、来源引用、历史记录 | ✅ 一期 |
| 智能报修 | 拍照 + 语音转文字 + LM 信息校验 + 工单对接 + 订阅消息推送 | ✅ 二期 |
| 培训考试 | 课程浏览 + AI 培训助手 + 题库练习 + 在线考试 + 证书 | ✅ 三期 |
| 用户中心 | 微信登录 + JWT 鉴权 + 个人历史 + 证书管理 | ✅ |
| 隐私政策 | 用户协议 + 隐私政策页面（微信审核必查项） | ✅ |
| 后台管理 | 简易运营后台（数据统计 + 内容管理） | ✅ |

## 技术架构

### 整体技术栈

```
微信小程序 (原生 WXML/WXSS/JS + TDesign)
        │
        ├── FastGPT (SSE 流式对话) ──→ 知识库 RAG
        ├── NestJS (REST API) ──────→ 报修/培训/考试/用户
        └── MinIO (对象存储) ──────→ 图片/附件

NestJS 后端
        ├── MySQL 8.0 (主数据)
        ├── Redis 7 (缓存/会话/限流)
        ├── FunASR (语音转文字, OpenAI 兼容 API)
        ├── LLM API (信息完整性校验, 通义千问/DeepSeek/GLM 等)
        └── MinIO (对象存储)
```

### 技术选型一览

| 层级 | 技术 | 说明 |
|------|------|------|
| 小程序端 | 原生 WXML/WXSS/JS + TDesign | 性能最优，包体最小 |
| 后端框架 | NestJS (TypeScript) | 统一全栈类型安全 |
| AI 知识库 | **FastGPT** (二开) | Docker 部署，含 MongoDB + pgvector |
| 语音识别 | FunASR (SenseVoiceSmall) | CPU 可跑，OpenAI 兼容 API |
| LLM | 通义千问 / DeepSeek / GLM 等 | 报修字段提取 + 信息校验，通用 OpenAI 兼容接口 |
| 数据库 | MySQL 8.0 | 主数据存储，事务一致性 |
| 缓存 | Redis 7 | 会话管理、热数据缓存、限流 |
| 对象存储 | MinIO (自建) | 图片/附件存储 |
| 反向代理 | Nginx | HTTPS + 限流 + CORS |

### 小程序分包结构

```
miniprogram/
├── pages/                    # 主包
│   ├── index/                # 首页
│   ├── chat/                 # AI 问答对话页
│   ├── repair/               # 智能报修
│   ├── profile/              # 个人中心
│   └── privacy/              # 隐私政策
├── subpackages/
│   ├── user-center/          # 用户中心分包
│   │   └── pages/history/    # 对话历史
│   ├── repair-detail/        # 报修详情分包
│   │   └── pages/list|detail/
│   ├── training/             # 培训分包
│   │   └── pages/list|detail|assistant/
│   └── exam/                 # 考试分包
│       └── pages/list|take|result|certificates/
└── utils/                    # 公共工具
    ├── request.js            # 统一请求封装 (JWT + Refresh Token)
    └── auth.js               # 鉴权工具
```

## 关于 FastGPT 二次开发声明

本项目使用了 [FastGPT](https://github.com/labring/FastGPT) 作为 AI 知识库问答引擎。FastGPT 是一个基于 LLM 的大型语言模型应用平台，采用 [Apache 2.0 协议](https://www.apache.org/licenses/LICENSE-2.0) 开源。

### 本项目对 FastGPT 的使用方式

- **部署方式**：Docker 部署，包含 MongoDB + pgvector，自带 Web 后台
- **接口调用**：小程序通过 FastGPT 提供的 OpenAI 兼容 API (`/api/v1/chat/completions`) 进行 SSE 流式对话
- **模型代理**：通过 aiproxy 代理访问多家模型供应商
  - 对话模型：MiniMax-M3
  - Embedding 模型：BAAI/bge-m3（经 SiliconFlow 代理）
  - Rerank 模型：BAAI/bge-reranker-v2-m3（经 SiliconFlow 代理）
- **知识库管理**：文档解析、分段、向量化、RAG 检索、重排序、多轮对话、来源引用、对话日志 — 全部使用 FastGPT 原生能力

### 未修改 FastGPT 源码

本项目 **未对 FastGPT 源码进行任何修改**，仅作为独立服务部署并通过 API 调用。FastGPT 的全部源码、文档及相关资源版权归 FastGPT 团队所有。

### FastGPT 原项目信息

- 仓库：https://github.com/labring/FastGPT
- 官网：https://fastgpt.in
- 协议：Apache License 2.0

> 如需使用 FastGPT，请遵循其 Apache 2.0 协议，并保留原始版权声明。

## 其他开源依赖声明

| 项目 | 用途 | 协议 |
|------|------|------|
| [NestJS](https://github.com/nestjs/nest) | 后端框架 | MIT |
| [FunASR](https://github.com/alibaba-damo-academy/fun-asr) | 语音识别 | MIT |
| [TDesign](https://github.com/Tencent/tdesign-miniprogram) | 小程序 UI 组件库 | MIT |
| [MinIO](https://github.com/minio/minio) | 对象存储 | AGPLv3 |
| [Nginx](https://nginx.org/) | 反向代理 | BSD-2 |

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.0
- Redis 7
- Docker & Docker Compose
- 微信开发者工具

### 后端启动

```bash
cd server
npm install
cp .env.example .env
# 编辑 .env 填写数据库、Redis、FastGPT、LLM 等配置
npm run start:dev
```

### FastGPT 部署

参考 [FastGPT 官方文档](https://fastgpt.in/docs/installation/) 进行 Docker 部署。

关键配置：
- 在 FastGPT 后台配置 AI 模型（对话 / Embedding / Rerank）
- 在 FastGPT 后台导入知识库文档并完成向量化
- 在小程序 `config/env.js` 中填写 FastGPT API 地址和密钥

### 小程序启动

1. 打开微信开发者工具
2. 导入 `miniprogram/` 目录
3. 复制 `config/env.js.example` 为 `config/env.js`（env.js 已 gitignore，密钥不入库），填写后端地址和 FastGPT 配置
4. 编译运行

### Docker 部署

```bash
cd server
# 编辑 .env.production 填写生产环境配置
docker-compose up -d
```

## 项目结构

```
客服小程序/
├── miniprogram/              # 微信小程序
│   ├── pages/                # 主包页面
│   ├── subpackages/          # 分包
│   ├── config/env.js         # 环境配置（gitignore，从 env.js.example 复制）
│   ├── config/env.js.example # 环境配置模板
│   ├── services/             # 业务服务
│   └── utils/                # 工具函数
├── server/                   # NestJS 后端
│   ├── src/
│   │   ├── modules/          # 业务模块
│   │   ├── common/           # 公共模块（过滤器/日志/DTO）
│   │   ├── database/         # 数据库服务
│   │   └── config/          # 配置
│   ├── sql/                  # 迁移脚本
│   ├── nginx/                # Nginx 配置
│   ├── Dockerfile
│   └── docker-compose.yml
├── DESIGN.md                 # UI 设计规范
├── architecture-design.md    # 架构设计文档
└── README.md
```

## 三期交付规划

| 阶段 | 周期 | 内容 | 状态 |
|------|------|------|------|
| 一期 | 3.5 周 | FastGPT 部署 + 小程序对话页 + 微信登录 + 审核上线 | ✅ 完成 |
| 二期 | 2 周 | FunASR 语音转文字 + LLM 校验 + 工单对接 + 订阅消息 | ✅ 完成 |
| 三期 | 4 周 | 培训内容 + AI 培训助手 + 题库 + 考试 + 证书 | ✅ 完成 |

## License

本项目为金鹰世界商场物业管理系统，所有权归项目方所有。

项目中使用的第三方开源组件遵循各自的开源协议：
- FastGPT: Apache 2.0
- NestJS: MIT
- FunASR: MIT
- TDesign: MIT
- MinIO: AGPLv3

详见上文「开源依赖声明」部分。
