import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // CORS - 允许小程序开发环境
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(config.port);
  console.log(`Server running on http://localhost:${config.port}`);
}

bootstrap();
