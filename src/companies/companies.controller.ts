// backend/src/companies/companies.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import type { Request } from 'express';
import { CompanyQueryDto, CreateCompanyDto, UpdateCompanyDto, AnalyticsPayloadDto } from './companies.dto';

@ApiTags('Companies 数据与图表分析模块')
@Controller('api/companies')
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) { }

    @ApiOperation({ summary: '获取所有公司层级选项 (用于下拉筛选)' })
    @ApiCookieAuth()
    @Get('levels')
    async getLevels(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.getLevels(userId);
    }

    @ApiOperation({ summary: '获取公司基础列表数据 (用于折叠表格展示)' })
    @ApiCookieAuth()
    @Get()
    async findAll(@Query() query: CompanyQueryDto, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.findAll(query, userId);
    }

    @ApiOperation({ summary: '获取 Dashboard 顶部聚合卡片数据' })
    @ApiCookieAuth()
    @Get('stats/basic')
    async getDashboardBasicStats(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.getDashboardBasicStats(userId);
    }

    @ApiOperation({ summary: '获取层级分布统计 (用于左侧 Doughnut 饼图)' })
    @ApiCookieAuth()
    @Get('stats/levels')
    async getLevelStats(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.getLevelStats(userId);
    }

    @ApiOperation({ summary: '获取供应链历年增长趋势 (用于右侧折线图)' })
    @ApiCookieAuth()
    @Get('stats/growth')
    async getGrowthStats(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.getGrowthStats(userId);
    }

    @ApiOperation({ summary: '获取多维分析的级联过滤选项 (国家/城市映射)' })
    @ApiCookieAuth()
    @Get('filters')
    async getFilterOptions(@Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.getFilterOptions(userId);
    }

    @ApiOperation({ summary: '核心引擎：获取动态分析数据 (同时返回 Bar 与 Bubble Tree)' })
    @ApiCookieAuth()
    @Post('analytics')
    async getAnalyticsData(@Body() payload: AnalyticsPayloadDto, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.getAnalyticsData(payload, userId);
    }

    @ApiOperation({ summary: '新增公司节点' })
    @ApiCookieAuth()
    @Post()
    async create(@Body() createData: CreateCompanyDto, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.create(createData, userId);
    }

    @ApiOperation({ summary: '更新公司信息' })
    @ApiCookieAuth()
    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: UpdateCompanyDto, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.update(+id, updateData, userId);
    }

    @ApiOperation({ summary: '删除公司节点' })
    @ApiCookieAuth()
    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.remove(+id, userId);
    }
}