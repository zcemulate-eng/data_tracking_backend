// backend/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // 内部鉴权辅助方法：获取当前操作者
  async getCurrentUser(userIdStr?: string) {
    if (!userIdStr) return null;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return null;
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  // 1. 获取用户列表
  async findAll(query: any, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) return { success: false, data: [], total: 0 };

    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const search = query.search;
    const roles = query.roles ? query.roles.split(',') : [];

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (roles.length > 0) {
      where.role = { in: roles };
    }

    const total = await this.prisma.user.count({ where });
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, role: true,
        status: true, phone: true, createdAt: true,
      },
    });

    return { success: true, data: users, total };
  }

  // 2. 创建用户
  async create(data: any, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) return { success: false, error: '未登录' };
    if (currentUser.role === 'User') return { success: false, error: '越权操作：权限不足' };

    let assignedRole = data.role;
    if (currentUser.role === 'Manager') {
      assignedRole = 'User';
    }

    try {
      await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          role: assignedRole,
          status: data.status,
          password: data.password || '123456',
        },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: '用户创建失败，邮箱或昵称可能已被使用。' };
    }
  }

  // 3. 更新用户
  async update(id: number, data: any, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) return { success: false, error: '未登录' };
    if (currentUser.role === 'User') return { success: false, error: '越权操作：权限不足' };

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) return { success: false, error: '目标用户不存在' };

    if (currentUser.role === 'Manager') {
      if (targetUser.role !== 'User') return { success: false, error: '越权操作：Manager只能编辑User' };
      if (data.role) delete data.role;
    }

    if (currentUser.role === 'Admin' && targetUser.role === 'Admin' && targetUser.id !== currentUser.id) {
      return { success: false, error: '操作拒绝：不可修改其他Admin的信息' };
    }

    try {
      await this.prisma.user.update({
        where: { id },
        data,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: '更新失败，邮箱或昵称可能冲突' };
    }
  }

  // 4. 删除单个用户
  async remove(id: number, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) return { success: false, error: '未登录' };
    if (currentUser.role === 'User') return { success: false, error: '越权操作：权限不足' };

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) return { success: false, error: '目标用户不存在' };

    if (currentUser.role === 'Manager' && targetUser.role !== 'User') {
      return { success: false, error: '越权操作：Manager只能删除User' };
    }

    if (currentUser.role === 'Admin' && targetUser.role === 'Admin') {
      return { success: false, error: '操作拒绝：不可删除Admin级别账号' };
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  // 5. 获取角色列表
  async getRoles() {
    try {
      const groups = await this.prisma.user.groupBy({
        by: ['role'],
        orderBy: { role: 'asc' },
      });
      return groups.map((g) => g.role);
    } catch (error) {
      return [];
    }
  }
}