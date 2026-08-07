import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { config } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Winston 日志器 — 用 try-catch 保护，失败则用默认 Logger
  let logger: any = ['log', 'error', 'warn', 'debug', 'verbose'];
  try {
    const { winstonLogger } = await import('./common/logger/winston.config');
    logger = winstonLogger;
  } catch (err) {
    // Winston 初始化失败时用 NestJS 默认日志
    console.error('Winston 初始化失败，使用默认日志器:', err.message);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  // 全局前缀
  app.setGlobalPrefix('api');

  // 静态文件服务
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(config.port);
  const log = new Logger('Bootstrap');
  log.log(`Server running on http://localhost:${config.port}`);
  log.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
