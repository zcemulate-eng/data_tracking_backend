// backend/src/auth/auth.controller.ts
import { Controller, Post, Get, Put, Body, Req, Res, HttpCode, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express'; // 👉 引入了 Response
import { RegisterDto, LoginDto, CompleteFirstLoginDto, UpdateAccountDto } from './auth.dto';

@ApiTags('Auth 认证模块')
@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @ApiOperation({ summary: '用户注册' })
    @Post('register')
    async register(@Body() data: RegisterDto) {
        return this.authService.register(data);
    }

    @ApiOperation({ summary: '用户登录' })
    @Post('login')
    async login(@Body() data: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(data);

        // 如果登录成功，由后端向客户端种下 Cookie
        if (result.success && result.userId) {
            res.cookie('userId', result.userId.toString(), {
                httpOnly: true, // 安全防线：禁止前端通过 JS (document.cookie) 读取，防止 XSS 攻击
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 有效期 7 天
            });
        }

        return result;
    }

    @ApiOperation({ summary: '用户登出 (清除 Cookie)' })
    @Post('logout')
    @HttpCode(200)
    @ApiResponse({ status: 200, description: '成功登出并清除凭证' })
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        // 1. 先读取 Cookie
        const userId = req.cookies['userId'];

        // 2. 如果根本没带 Cookie (没登录)，直接抛出 401 异常，完美拦截非法请求！
        if (!userId) {
            throw new UnauthorizedException({ success: false, message: '未登录' });
        }

        // 3. 正常登出流程：清除 Cookie
        res.clearCookie('userId', { path: '/' });
        return { success: true, message: '登出成功' };
    }

    @ApiOperation({ summary: '获取当前登录用户信息' })
    @ApiCookieAuth()
    @Get('me')
    async getMe(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.authService.getMe(userId);
    }

    @ApiOperation({ summary: '完成首次登录资料补充' })
    @ApiCookieAuth()
    @Post('complete-first-login')
    async completeFirstLogin(@Body() data: CompleteFirstLoginDto, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.authService.completeFirstLogin(data, userId);
    }

    @ApiOperation({ summary: '更新账户资料' })
    @ApiCookieAuth()
    @Put('update-account')
    async updateAccount(@Body() data: UpdateAccountDto, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.authService.updateAccount(data, userId);
    }
}