import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, configureApp } from './app.module';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule, { bodyParser: true }));
  if (!config.authSecretFromEnv) Logger.warn('Chưa đặt AUTH_SECRET_KEY – dùng khóa tạm, mọi phiên đăng nhập mất hiệu lực khi khởi động lại', 'Auth');
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Backend NestJS chạy tại cổng ${config.port} (API /api, WebSocket /api/live/ws)`, 'Bootstrap');
}

bootstrap().catch((exc) => {
  Logger.error(`Không khởi động được backend: ${(exc as Error).message}`, 'Bootstrap');
  process.exit(1);
});
