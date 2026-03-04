// backend/src/auth/auth.service.ts
import { 
    Injectable, 
    BadRequestException, 
    InternalServerErrorException, 
    UnauthorizedException, 
    ForbiddenException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, CompleteFirstLoginDto, UpdateAccountDto } from './auth.dto';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) {}

    async register(data: RegisterDto) {
        // 1. 业务校验层
        const existingEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (existingEmail) {
            throw new BadRequestException({ success: false, message: '该邮箱已被注册' });
        }

        if (data.username) {
            const existingName = await this.prisma.user.findFirst({ where: { name: data.username } });
            if (existingName) {
                throw new BadRequestException({ success: false, message: '该昵称已被人使用' });
            }
        }

        // 2. 数据库操作层
        try {
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
            throw new InternalServerErrorException({ success: false, message: '数据库写入失败，请稍后重试' });
        }
    }

    async login(data: LoginDto) {
        // 1. 业务查询与校验层 (不需要 try...catch 包裹，让数据库异常自然抛出为 500)
        const user = await this.prisma.user.findUnique({ where: { email: data.email } });
        
        if (!user) {
            throw new BadRequestException({ success: false, message: '用户不存在' });
        }
        if (user.password !== data.password) {
            throw new BadRequestException({ success: false, message: '密码错误' });
        }
        if (user.status === 'Inactive') {
            // 使用 403 Forbidden 表示账号被禁止访问
            throw new ForbiddenException({ success: false, message: '该账号已被停用，请联系管理员' });
        }
        
        // 校验通过，正常返回 201
        return { success: true, message: '成功', userId: user.id };
    }

    async getMe(userIdStr?: string) {
        // 未提供 Cookie，使用 401 拦截
        if (!userIdStr) {
            throw new UnauthorizedException({ success: false, data: null, message: '未登录' });
        }
        
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: parseInt(userIdStr) },
                select: { id: true, name: true, email: true, role: true, avatarUrl: true, isFirstLogin: true, gender: true, phone:true, dob: true, address: true }
            });
            
            if (!user) {
                throw new UnauthorizedException({ success: false, data: null, message: '用户不存在或凭证已失效' });
            }
            return { success: true, data: user };
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            throw new InternalServerErrorException({ success: false, data: null, message: '获取用户信息失败' });
        }
    }

    async completeFirstLogin(data: CompleteFirstLoginDto, userIdStr?: string) {
        if (!userIdStr) {
            throw new UnauthorizedException({ success: false, message: '未登录' });
        }
        
        try {
            await this.prisma.user.update({
                where: { id: parseInt(userIdStr) },
                data: { avatarUrl: data.avatarUrl, gender: data.gender, isFirstLogin: false }
            });
            return { success: true, message: '保存成功' };
        } catch (error) {
            throw new InternalServerErrorException({ success: false, message: '保存失败，请稍后重试' });
        }
    }

    async updateAccount(data: UpdateAccountDto, userIdStr?: string) {
        if (!userIdStr) {
            throw new UnauthorizedException({ success: false, message: '用户未登录' });
        }
        const currentUserId = parseInt(userIdStr);

        // 1. 业务校验层：昵称去重校验
        if (data.name) {
            const existingUser = await this.prisma.user.findFirst({
                where: { name: data.name, id: { not: currentUserId } }
            });
            if (existingUser) {
                throw new BadRequestException({ success: false, message: '该昵称已被人使用' });
            }
        }

        // 2. 数据库写入层
        try {
            await this.prisma.user.update({
                where: { id: currentUserId },
                data: { name: data.name, phone: data.phone, gender: data.gender, dob: data.dob, address: data.address, avatarUrl: data.avatarUrl }
            });
            return { success: true, message: '个人资料更新成功' };
        } catch (error) {
            throw new InternalServerErrorException({ success: false, message: '更新失败，请稍后重试' });
        }
    }
}