import { WinstonModule, utilities } from 'nest-winston';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

// 确保日志目录存在
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {
    // 忽略
  }
}

// 动态加载 DailyRotateFile（避免 default 导入问题）
let DailyRotateFile: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DailyRotateFile = require('winston-daily-rotate-file');
  // 兼容 default 导出和 CommonJS
  if (DailyRotateFile.default) DailyRotateFile = DailyRotateFile.default;
  if (DailyRotateFile.DailyRotateFile) DailyRotateFile = DailyRotateFile.DailyRotateFile;
} catch (e) {
  // 模块未安装时降级
}

// 文件 transport 构建器
function fileTransport(filename: string, level: string): winston.transport | null {
  if (!logsDir || !DailyRotateFile) return null;
  try {
    return new DailyRotateFile({
      filename: path.join(logsDir, `${filename}-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      level,
      maxSize: '10m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, context, stack }) => {
          const ctx = context ? `[${context}] ` : '';
          const stk = stack ? `\n${stack}` : '';
          return `${timestamp} [${level.toUpperCase()}] ${ctx}${message}${stk}`;
        }),
      ),
    });
  } catch (e) {
    return null;
  }
}

const transports: winston.transport[] = [
  // 控制台输出
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.ms(),
      utilities.format.nestLike('JinYing', {
        prettyPrint: true,
        colors: true,
      }),
    ),
  }),
];

// 添加文件 transport
const appFile = fileTransport('app', 'info');
const errFile = fileTransport('error', 'error');
if (appFile) transports.push(appFile);
if (errFile) transports.push(errFile);

/**
 * Winston 日志配置
 */
export const winstonLogger = WinstonModule.createLogger({ transports });
