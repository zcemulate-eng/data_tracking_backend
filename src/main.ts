// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common'; // 👉 引入校验管道
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // 👉 引入 Swagger

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://ecqto-2409-8a34-a40-c891-b8e8-d26d-7bd8-339d.a.free.pinggy.link' 
    ],
    credentials: true,
  });

  // 1. 开启全局参数校验防御网
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // 核心安全配置：自动剔除（过滤掉）前端乱传的、不在 DTO 中定义的额外字段
    transform: true, // 自动将前端传来的字符串转换为 DTO 中定义的类型（如把 '1' 转成数字 1）
  }));

  // 2. 初始化 Swagger 文档生成器
  const config = new DocumentBuilder()
    .setTitle('Data Tracking API')
    .setDescription('企业级供应链数据追踪系统 API 文档')
    .setVersion('1.0')
    .addCookieAuth('userId') // 告诉 Swagger 我们的接口使用 Cookie 里的 userId 鉴权
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // 设置文档的访问路由

  await app.listen(3001);
}
bootstrap();