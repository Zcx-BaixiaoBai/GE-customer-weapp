# NestJS Dockerfile — 多阶段构建
# 构建命令: docker build -t jinying-server .
# 运行命令: docker run -d -p 3001:3001 --env-file .env jinying-server

# ========== 阶段1: 构建 ==========
FROM docker.m.daocloud.io/library/node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件，利用 Docker 缓存层
COPY package*.json ./
COPY jest.config.js ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# 安装依赖
RUN npm install --legacy-peer-deps

# 复制源码
COPY src ./src
COPY sql ./sql

# 编译 TypeScript
RUN npm run build

# ========== 阶段2: 运行 ==========
FROM docker.m.daocloud.io/library/node:18-alpine AS runner

WORKDIR /app

# 只复制运行需要的文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 确保上传目录存在
RUN mkdir -p uploads/video uploads/image logs

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 健康检查（alpine 用 node 而非 wget）
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/exam/list',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# 启动
CMD ["node", "dist/main.js"]
