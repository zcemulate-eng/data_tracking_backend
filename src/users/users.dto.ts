// backend/src/users/users.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class UserQueryDto {
    @ApiPropertyOptional({ description: '页码', example: '1' })
    @IsOptional()
    @IsString()
    page?: string;

    @ApiPropertyOptional({ description: '每页数量', example: '10' })
    @IsOptional()
    @IsString()
    pageSize?: string;

    @ApiPropertyOptional({ description: '搜索关键词 (姓名或邮箱)' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: '按角色过滤，逗号分隔', example: 'Admin,Manager' })
    @IsOptional()
    @IsString()
    roles?: string;
}

export class CreateUserDto {
    @ApiProperty({ description: '姓名或昵称', example: '张三' })
    @IsNotEmpty({ message: '姓名不能为空' })
    @IsString()
    name!: string;

    @ApiProperty({ description: '登录邮箱', example: 'user@example.com' })
    @IsEmail({}, { message: '必须是有效的邮箱格式' })
    email!: string;

    @ApiProperty({ description: '用户角色', enum: ['Admin', 'Manager', 'User'], example: 'User' })
    @IsNotEmpty()
    @IsString()
    role!: string;

    @ApiProperty({ description: '账号状态', enum: ['Active', 'Inactive'], example: 'Active' })
    @IsNotEmpty()
    @IsString()
    status!: string;

    @ApiPropertyOptional({ description: '初始密码 (选填，默认123456)' })
    @IsOptional()
    @IsString()
    @MinLength(6, { message: '密码至少6位' })
    password?: string;
}

export class UpdateUserDto {
    @ApiPropertyOptional({ description: '姓名或昵称' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: '登录邮箱' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: '用户角色', enum: ['Admin', 'Manager', 'User'] })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional({ description: '账号状态', enum: ['Active', 'Inactive'] })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: '重置密码' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;
}