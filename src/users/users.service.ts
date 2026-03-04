// backend/src/users/users.service.ts
import { 
  Injectable, 
  UnauthorizedException, 
  ForbiddenException, 
  BadRequestException, 
  NotFoundException, 
  InternalServerErrorException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UserQueryDto, CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // 内部鉴权辅助方法
  async getCurrentUser(userIdStr?: string) {
    if (!userIdStr) return null;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return null;
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async findAll(query: UserQueryDto, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) {
      // 统一抛出 401 未登录
      throw new UnauthorizedException({ success: false, message: '未登录' });
    }

    const page = query.page ? parseInt(query.page) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize) : 10;
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

    try {
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
    } catch (error) {
      throw new InternalServerErrorException({ success: false, message: '获取用户列表失败' });
    }
  }

  async create(data: CreateUserDto, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) {
      throw new UnauthorizedException({ success: false, message: '未登录' });
    }
    if (currentUser.role === 'User') {
      // 统一抛出 403 权限不足
      throw new ForbiddenException({ success: false, message: '越权操作：权限不足' });
    }

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
      return { success: true, message: '用户创建成功' };
    } catch (error) {
      // 数据库唯一性约束冲突抛出 400
      throw new BadRequestException({ success: false, message: '用户创建失败，邮箱或昵称可能已被使用。' });
    }
  }

  async update(id: number, data: UpdateUserDto, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) {
      throw new UnauthorizedException({ success: false, message: '未登录' });
    }
    if (currentUser.role === 'User') {
      throw new ForbiddenException({ success: false, message: '越权操作：权限不足' });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      // 目标不存在抛出 404
      throw new NotFoundException({ success: false, message: '目标用户不存在' });
    }

    if (currentUser.role === 'Manager') {
      if (targetUser.role !== 'User') {
        throw new ForbiddenException({ success: false, message: '越权操作：Manager只能编辑User' });
      }
      if (data.role) delete data.role;
    }

    if (currentUser.role === 'Admin' && targetUser.role === 'Admin' && targetUser.id !== currentUser.id) {
      throw new ForbiddenException({ success: false, message: '操作拒绝：不可修改其他Admin的信息' });
    }

    try {
      await this.prisma.user.update({ where: { id }, data });
      return { success: true, message: '更新成功' };
    } catch (error) {
      throw new BadRequestException({ success: false, message: '更新失败，邮箱或昵称可能冲突' });
    }
  }

  async remove(id: number, userIdStr?: string) {
    const currentUser = await this.getCurrentUser(userIdStr);
    if (!currentUser) {
      throw new UnauthorizedException({ success: false, message: '未登录' });
    }
    if (currentUser.role === 'User') {
      throw new ForbiddenException({ success: false, message: '越权操作：权限不足' });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException({ success: false, message: '目标用户不存在' });
    }

    if (currentUser.role === 'Manager' && targetUser.role !== 'User') {
      throw new ForbiddenException({ success: false, message: '越权操作：Manager只能删除User' });
    }
    if (currentUser.role === 'Admin' && targetUser.role === 'Admin') {
      throw new ForbiddenException({ success: false, message: '操作拒绝：不可删除Admin级别账号' });
    }

    try {
      await this.prisma.user.delete({ where: { id } });
      return { success: true, message: '删除成功' };
    } catch (error) {
      throw new InternalServerErrorException({ success: false, message: '删除失败，可能存在外键关联数据' });
    }
  }

  async getRoles() {
    try {
      const groups = await this.prisma.user.groupBy({ by: ['role'], orderBy: { role: 'asc' } });
      return groups.map((g) => g.role);
    } catch (error) {
      // 虽然极少出错，但保持严谨
      throw new InternalServerErrorException({ success: false, message: '获取角色列表失败' });
    }
  }
}