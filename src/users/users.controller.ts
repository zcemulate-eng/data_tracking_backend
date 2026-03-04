// backend/src/users/users.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import type { Request } from 'express';
import { UserQueryDto, CreateUserDto, UpdateUserDto } from './users.dto';

@ApiTags('Users 用户管理模块')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: '获取所有角色选项 (下拉框使用)' })
  @Get('roles')
  async getRoles() {
    return this.usersService.getRoles();
  }

  @ApiOperation({ summary: '获取用户列表 (支持分页、搜索、过滤)' })
  @ApiCookieAuth()
  @Get()
  async findAll(@Query() query: UserQueryDto, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.findAll(query, userId);
  }

  @ApiOperation({ summary: '创建新用户' })
  @ApiCookieAuth()
  @Post()
  async create(@Body() createData: CreateUserDto, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.create(createData, userId);
  }

  @ApiOperation({ summary: '更新用户信息' })
  @ApiCookieAuth()
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateUserDto, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.update(+id, updateData, userId);
  }

  @ApiOperation({ summary: '删除用户' })
  @ApiCookieAuth()
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.cookies['userId'];
    return this.usersService.remove(+id, userId);
  }
}