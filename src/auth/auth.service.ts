// backend/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) {}

    // 1. 注册逻辑
    async register(data: any) {
        try {
            // 检查邮箱
            const existingEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
            if (existingEmail) return { success: false, message: '该邮箱已被注册' };

            // 检查昵称
            if (data.username) {
                const existingName = await this.prisma.user.findFirst({ where: { name: data.username } });
                if (existingName) return { success: false, message: '该昵称已被人使用' };
            }

            // 创建用户
            await this.prisma.user.create({
                data: {
                    email: data.email,
                    password: data.password,
                    name: data.username,
                    phone: data.phone,
                    dob: data.dob || null,
                    address: data.address || null,
                    isFirstLogin: true
                }
            });
            return { success: true, message: '成功' };
        } catch (e) {
            console.error('Registration Error:', e);
            return { success: false, message: '数据库写入失败，请稍后重试' };
        }
    }

    // 2. 登录逻辑 (校验账号密码和状态，返回 userId 给前端签发 Cookie)
    async login(data: any) {
        try {
            const user = await this.prisma.user.findUnique({ where: { email: data.email } });
            if (!user) return { success: false, message: '用户不存在' };
            if (user.password !== data.password) return { success: false, message: '密码错误' };
            if (user.status === 'Inactive') return { success: false, message: '该账号已被停用，请联系管理员' };
            
            return { success: true, message: '成功', userId: user.id };
        } catch (e) {
            return { success: false, message: '服务器错误' };
        }
    }

    // 3. 获取当前用户信息
    async getMe(userIdStr?: string) {
        if (!userIdStr) return { success: false, data: null };
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: parseInt(userIdStr) },
                select: { id: true, name: true, email: true, role: true, avatarUrl: true, isFirstLogin: true, gender: true, phone:true, dob: true, address: true }
            });
            return { success: true, data: user };
        } catch (error) {
            return { success: false, data: null };
        }
    }

    // 4. 完成首次登录设置
    async completeFirstLogin(data: any, userIdStr?: string) {
        if (!userIdStr) return { success: false, message: '未登录' };
        try {
            await this.prisma.user.update({
                where: { id: parseInt(userIdStr) },
                data: { avatarUrl: data.avatarUrl, gender: data.gender, isFirstLogin: false }
            });
            return { success: true };
        } catch (error) {
            return { success: false, message: '保存失败' };
        }
    }

    // 5. 更新账户资料
    async updateAccount(data: any, userIdStr?: string) {
        if (!userIdStr) return { success: false, message: '用户未登录' };
        const currentUserId = parseInt(userIdStr);

        try {
            if (data.name) {
                const existingUser = await this.prisma.user.findFirst({
                    where: { name: data.name, id: { not: currentUserId } }
                });
                if (existingUser) return { success: false, message: '该昵称已被人使用' };
            }

            await this.prisma.user.update({
                where: { id: currentUserId },
                data: { name: data.name, phone: data.phone, gender: data.gender, dob: data.dob, address: data.address, avatarUrl: data.avatarUrl }
            });
            return { success: true, message: '个人资料更新成功' };
        } catch (error) {
            return { success: false, message: '更新失败，请稍后重试' };
        }
    }
}