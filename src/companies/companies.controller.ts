// backend/src/companies/companies.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import type { Request } from 'express';

@Controller('api/companies')
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) { }

    // 获取所有层级选项：GET /api/companies/levels
    // 注意：这个路由必须放在 /:id 前面，否则会被误认为是 id='levels'
    @Get('levels')
    async getLevels() {
        return this.companiesService.getLevels();
    }

    // 获取公司列表（带分页和搜索）：GET /api/companies
    @Get()
    async findAll(@Query() query: any) {
        return this.companiesService.findAll(query);
    }

    // 👇 新增：Dashboard 统计接口 (一定要放在 /:id 路由的前面！)
    @Get('stats/basic')
    async getDashboardBasicStats() {
        return this.companiesService.getDashboardBasicStats();
    }

    @Get('stats/levels')
    async getLevelStats() {
        return this.companiesService.getLevelStats();
    }

    @Get('stats/growth')
    async getGrowthStats() {
        return this.companiesService.getGrowthStats();
    }

    // 获取过滤器下拉选项
    @Get('filters')
    async getFilterOptions() {
        return this.companiesService.getFilterOptions();
    }

    // 强大的多维分析引擎接口
    @Post('analytics')
    async getAnalyticsData(@Body() payload: { dimension: string; filters: any }) {
        return this.companiesService.getAnalyticsData(payload);
    }

    // 创建公司：POST /api/companies
    @Post()
    async create(@Body() createData: any, @Req() req: Request) {
        const userId = req.cookies['userId']; // 从 Cookie 抓取用户身份
        return this.companiesService.create(createData, userId);
    }

    // 更新公司：PUT /api/companies/:id
    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: any, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.update(+id, updateData, userId);
    }

    // 删除公司：DELETE /api/companies/:id
    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req: Request) {
        const userId = req.cookies['userId'];
        return this.companiesService.remove(+id, userId);
    }
}