// backend/src/auth/auth.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { Matches } from 'class-validator'

export class RegisterDto {
    @ApiProperty({ description: '用户的登录邮箱', example: 'user@example.com' })
    @IsEmail({}, { message: '必须是有效的邮箱格式' })
    @IsNotEmpty({ message: '邮箱不能为空' })
    email!: string;

    @ApiProperty({ description: '用户密码，至少6位', example: '123456' })
    @IsString()
    @MinLength(6, { message: '密码至少需要6个字符' })
    password!: string;

    @ApiPropertyOptional({ description: '用户昵称' })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiPropertyOptional({ description: '电话号码，11位且以 1 开头' })
    @IsOptional()
    @IsString()
    @Matches(/^1\d{10}$/, { message: '电话号码必须是 11 位数字，且以 1 开头' })
    phone?: string;

    @ApiPropertyOptional({ description: '出生年月，格式 YYYY-MM-DD' })
    @IsOptional()
    @IsString()
    dob?: string;

    @ApiPropertyOptional({ description: '详细地址' })
    @IsOptional()
    @IsString()
    address?: string;
}

export class LoginDto {
    @ApiProperty({ description: '登录邮箱', example: 'user@example.com' })
    @IsEmail({}, { message: '必须是有效的邮箱格式' })
    email!: string;

    @ApiProperty({ description: '登录密码', example: '123456' })
    @IsString()
    @IsNotEmpty({ message: '密码不能为空' })
    password!: string;
}

export class CompleteFirstLoginDto {
    @ApiPropertyOptional({ description: '用户头像的Base64或URL' })
    @IsOptional()
    @IsString()
    avatarUrl?: string | null;

    @ApiPropertyOptional({ description: '性别：男/女', example: '男' })
    @IsOptional()
    @IsString()
    gender?: string;
}

export class UpdateAccountDto {
    @ApiPropertyOptional({ description: '用户昵称' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: '电话号码' })
    @IsOptional()
    @IsString()
    @Matches(/^1\d{10}$/, { message: '电话号码必须是 11 位数字，且以 1 开头' })
    phone?: string;

    @ApiPropertyOptional({ description: '性别' })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ description: '出生年月' })
    @IsOptional()
    @IsString()
    dob?: string;

    @ApiPropertyOptional({ description: '详细地址' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ description: '用户头像的Base64或URL' })
    @IsOptional()
    @IsString()
    avatarUrl?: string | null;
}