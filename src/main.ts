// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser'; // 👉 修改了这里

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 cookie 解析
  app.use(cookieParser());

  // 配置 CORS，允许前端 (localhost:3000) 访问并携带 Cookie
  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  await app.listen(3001);
}
bootstrap();