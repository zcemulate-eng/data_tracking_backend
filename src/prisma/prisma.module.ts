// backend/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 设为全局模块，其他模块不需要重复 import
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 暴露给其他模块使用
})
export class PrismaModule {}