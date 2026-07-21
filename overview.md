# 金鹰世界物业小程序 — 开发概览

## 项目结构

```
客服小程序/
├── architecture-design.md      # 架构设计文档 (v3.0)
├── miniprogram/                 # 微信小程序端
│   ├── app.json / app.js / app.wxss
│   ├── config/env.js           # 环境配置 (FastGPT地址/API Key)
│   ├── utils/
│   │   ├── request.js          # 统一请求封装 (JWT+401刷新)
│   │   └── auth.js             # 微信登录
│   ├── services/
│   │   ├── chat.service.js     # 对接FastGPT OpenAI兼容API (SSE流式)
│   │   └── repair.service.js   # 报修服务 (二期)
│   ├── pages/
│   │   ├── index/              # 首页 (功能入口)
│   │   ├── chat/               # AI问答对话页 (SSE流式+来源引用)
│   │   └── repair/             # 报修页 (二期占位)
│   └── subpackages/            # 分包
│       ├── user-center/        # 个人中心 (profile + history)
│       └── repair-detail/      # 报修详情 (list + detail)
│
└── server/                      # NestJS后端
    ├── package.json / tsconfig.json / nest-cli.json
    ├── .env.example             # 环境变量模板
    └── src/
        ├── main.ts             # 入口 (端口3001, CORS, 全局管道)
        ├── app.module.ts       # 根模块
        ├── config/
        │   └── configuration.ts  # 统一配置读取
        ├── middleware/
        │   └── jwt-auth.middleware.ts  # JWT鉴权中间件
        └── modules/
            ├── auth/           # 微信登录 + JWT签发/刷新
            ├── upload/         # 文件上传 (照片/语音)
            └── repair/          # 报修API (二期: ASR+LLM校验+工单提交)
```

## 一期已完成

### 小程序端
- [x] app.json: 分包策略 + tabBar + 权限声明
- [x] 首页: 功能入口网格 (问答/报修/我的)
- [x] AI对话页: SSE流式回答 + 来源引用展示 + 多轮对话 + 新对话
- [x] 推理过程展示 (支持DeepSeek-R1等推理模型的reasoning_content，可折叠)
- [x] setData节流优化 (内容80ms/推理200ms批量更新，避免每个token一次setData)
- [x] chat.service.js: 对接FastGPT `/api/v1/chat/completions`
- [x] FastGPT API Key已配置并验证联通 ✅
- [x] request.js: 统一请求封装 (JWT + 401自动刷新)
- [x] auth.js: 微信登录 (wx.login → 后端换JWT)
- [x] 分包页面补齐: user-center(profile/history) + repair-detail(list/detail)

### NestJS后端
- [x] 项目骨架 (NestJS + TypeScript)
- [x] Auth模块: 微信登录 (code2session) + JWT签发 + Token刷新
- [x] Upload模块: 文件上传 (图片/语音, 类型白名单, 30MB限制)
- [x] Repair模块: 报修API骨架 (analyze/submit/list/detail, 二期实现)

## 快速开始

### 1. FastGPT (已运行)
```
http://localhost:3000  ← 已在Docker中运行
```

### 2. 配置小程序
编辑 `miniprogram/config/env.js`:
```javascript
dev: {
  FASTGPT_API_KEY: 'fastgpt-sKWqfSvj9qrl7Yo1XvM4F1LS2Tf7Y8s80IR7As7qvFqiaT2kbgg4I4ALG4tko8sy',  // ✅ 已配置
  // V4版API Key已绑定应用，无需单独appId
}
```

**FastGPT 登录信息:**
- 地址: http://localhost:3000
- 账号: `root`
- 密码: `FastGPT@2026`

**在FastGPT后台操作（如需更换应用）:**
1. 访问 http://localhost:3000
2. 创建知识库 → 上传文档 (PDF/Word/Excel)
3. 创建应用 → 关联知识库 → 发布
4. 应用发布渠道 → API访问 → 获取API Key

### 3. 用微信开发者工具打开
```
项目目录: miniprogram/
AppID: 填你的小程序测试号
```

### 4. 启动NestJS后端 (二期需要)
```bash
cd server
cp .env.example .env  # 填入配置
npm install
npm run start:dev
```

## 二期待开发
- [ ] FunASR部署 (Docker)
- [ ] 报修采集页 (拍照+按住说话)
- [ ] 语音转文字 (FunASR SenseVoiceSmall)
- [ ] LLM信息完整性校验
- [ ] 工单预览页 + 确认提交
- [ ] 对接现有工单系统
- [ ] 订阅消息推送

## 三期待开发
- [ ] 培训课程列表 + 详情
- [ ] AI培训助手 (复用FastGPT新应用)
- [ ] 题库管理后台
- [ ] 考试页 + 评分
- [ ] 证书生成
