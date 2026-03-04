// backend/src/companies/companies.dto.ts
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';

export class CompanyQueryDto {
    @ApiPropertyOptional({ description: '页码' })
    @IsOptional()
    page?: string;

    @ApiPropertyOptional({ description: '每页数量' })
    @IsOptional()
    pageSize?: string;

    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: '按层级过滤，逗号分隔', example: '1,2' })
    @IsOptional()
    levels?: string;
}

export class CreateCompanyDto {
    @ApiProperty({ description: '系统唯一识别码', example: 'COMP-123' })
    @IsNotEmpty()
    @IsString()
    companyCode!: string;

    @ApiProperty({ description: '公司名称', example: 'Alpha Holdings' })
    @IsNotEmpty()
    @IsString()
    name!: string;

    @ApiProperty({ description: '公司节点层级 (1为顶层)', example: 1 })
    @IsNotEmpty()
    level!: string | number;

    @ApiPropertyOptional({ description: '所属国家' })
    @IsOptional()
    country?: string;

    @ApiPropertyOptional({ description: '所属城市' })
    @IsOptional()
    city?: string;

    @ApiPropertyOptional({ description: '成立年份', example: 1995 })
    @IsOptional()
    foundedYear?: string | number;

    @ApiPropertyOptional({ description: '年营收额' })
    @IsOptional()
    annualRevenue?: string | number;

    @ApiPropertyOptional({ description: '员工总数' })
    @IsOptional()
    employees?: string | number;

    @ApiPropertyOptional({ description: '关联的父公司ID (用于构建气泡树状图)' })
    @IsOptional()
    parentId?: string | number;
}

// 自动继承 CreateCompanyDto 的所有字段，并将其全部转为可选 (Optional)
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class ChartFiltersDto {
    @ApiPropertyOptional({ description: '筛选包含的层级' })
    @IsOptional()
    @IsArray()
    levels?: number[];

    @ApiPropertyOptional({ description: '筛选包含的国家' })
    @IsOptional()
    @IsArray()
    countries?: string[];

    @ApiPropertyOptional({ description: '筛选包含的城市' })
    @IsOptional()
    @IsArray()
    cities?: string[];

    @ApiPropertyOptional({ description: '成立年份范围限制' })
    @IsOptional()
    @IsObject()
    foundedYear?: { start?: string; end?: string };

    @ApiPropertyOptional({ description: '年营收范围限制' })
    @IsOptional()
    @IsObject()
    annualRevenue?: { min?: string; max?: string };

    @ApiPropertyOptional({ description: '员工数范围限制' })
    @IsOptional()
    @IsObject()
    employees?: { min?: string; max?: string };
}

export class AnalyticsPayloadDto {
    @ApiProperty({ description: 'X轴聚合维度 (如: level, country, city)', example: 'level' })
    @IsNotEmpty()
    @IsString()
    dimension!: string;

    @ApiProperty({ description: '复杂的组合过滤条件', type: () => ChartFiltersDto })
    @IsOptional()
    @IsObject()
    filters!: ChartFiltersDto;
}