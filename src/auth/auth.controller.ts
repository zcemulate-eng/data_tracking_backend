// backend/src/auth/auth.controller.ts
import { Controller, Post, Get, Put, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request } from 'express';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    async register(@Body() data: any) {
        return this.authService.register(data);
    }

    @Post('login')
    async login(@Body() data: any) {
        return this.authService.login(data);
    }

    @Get('me')
    async getMe(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.authService.getMe(userId);
    }

    @Post('complete-first-login')
    async completeFirstLogin(@Body() data: any, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.authService.completeFirstLogin(data, userId);
    }

    @Put('update-account')
    async updateAccount(@Body() data: any, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.authService.updateAccount(data, userId);
    }
}