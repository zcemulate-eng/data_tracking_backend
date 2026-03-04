import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger'; // 👉 引入 Swagger 装饰器
import { AppService } from './app.service';

@ApiTags('System 系统状态') // 👉 给它一个高大上的名字
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: '服务器健康检查 (Health Check)' }) // 👉 说明它的真实用途
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}