// backend/src/users/users.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import type { Request } from 'express'; // 👉 这里加上了 type 关键字

@Controller('api/users') // 定义路由前缀为 http://localhost:3001/api/users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 获取所有角色列表：GET /api/users/roles
  @Get('roles')
  async getRoles() {
    return this.usersService.getRoles();
  }

  // 获取用户列表：GET /api/users
  @Get()
  async findAll(@Query() query: any, @Req() req: Request) {
    const userId = req.cookies['userId']; // 从 Cookie 中抓取 userId
    return this.usersService.findAll(query, userId);
  }

  // 创建用户：POST /api/users
  @Post()
  async create(@Body() createData: any, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.create(createData, userId);
  }

  // 更新用户：PUT /api/users/:id
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.update(+id, updateData, userId);
  }

  // 删除单个用户：DELETE /api/users/:id
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.remove(+id, userId);
  }
}