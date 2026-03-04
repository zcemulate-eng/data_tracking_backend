// backend/src/companies/companies.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Company } from '@prisma/client';
import { CompanyQueryDto, CreateCompanyDto, UpdateCompanyDto, AnalyticsPayloadDto, ChartFiltersDto } from './companies.dto';

// 解决递归函数 any 的专用接口
export interface TreeNode {
    id?: number;
    name: string;
    level: string | number;
    levelNum?: number;
    country?: string | null;
    city?: string | null;
    foundedYear?: number | null;
    revenue?: number;
    employees?: number | null;
    parentId?: number | null;
    value?: number;
    children?: TreeNode[];
}

@Injectable()
export class CompaniesService {
    constructor(private prisma: PrismaService) { }

    private async checkPermission(userIdStr?: string) {
        if (!userIdStr) return { allowed: false, error: '未登录' };
        const userId = parseInt(userIdStr, 10);
        if (isNaN(userId)) return { allowed: false, error: '无效的用户ID' };

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { allowed: false, error: '用户不存在' };
        if (user.role === 'User') return { allowed: false, error: '越权操作：需要 Manager 或 Admin 权限' };
        
        return { allowed: true, user };
    }

    async findAll(query: CompanyQueryDto) {
        const page = query.page ? parseInt(query.page) : 1;
        const pageSize = query.pageSize ? parseInt(query.pageSize) : 10;
        const search = query.search;
        const levels = query.levels ? query.levels.split(',').map(Number) : [];

        const where: Prisma.CompanyWhereInput = {};
        if (search) where.name = { contains: search };
        if (levels.length > 0) where.level = { in: levels };

        try {
            const total = await this.prisma.company.count({ where });
            const rawCompanies = await this.prisma.company.findMany({
                where,
                orderBy: { annualRevenue: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            });

            const companies = rawCompanies.map(c => ({
                ...c,
                annualRevenue: c.annualRevenue ? Number(c.annualRevenue) : 0,
            }));

            return { success: true, data: companies, total };
        } catch (error) {
            return { success: false, data: [], total: 0, error: '获取数据失败' };
        }
    }

    async getLevels() {
        try {
            const groups = await this.prisma.company.groupBy({ by: ['level'], orderBy: { level: 'asc' } });
            return { success: true, data: groups.map(g => g.level) };
        } catch (error) {
            return { success: false, data: [] };
        }
    }

    async create(data: CreateCompanyDto, userIdStr?: string) {
        const auth = await this.checkPermission(userIdStr);
        if (!auth.allowed) return { success: false, message: auth.error };

        try {
            const newCompany = await this.prisma.company.create({
                data: {
                    companyCode: data.companyCode,
                    name: data.name,
                    level: typeof data.level === 'string' ? parseInt(data.level) : data.level,
                    country: data.country,
                    city: data.city,
                    foundedYear: data.foundedYear ? (typeof data.foundedYear === 'string' ? parseInt(data.foundedYear) : data.foundedYear) : null,
                    annualRevenue: data.annualRevenue ? BigInt(data.annualRevenue) : null,
                    employees: data.employees ? (typeof data.employees === 'string' ? parseInt(data.employees) : data.employees) : null,
                    parentId: data.parentId ? (typeof data.parentId === 'string' ? parseInt(data.parentId) : data.parentId) : null,
                }
            });
            return { success: true, data: { ...newCompany, annualRevenue: Number(newCompany.annualRevenue) } };
        } catch (e) {
            return { success: false, message: '创建失败，可能是公司代码(Code)重复' };
        }
    }

    async update(id: number, data: UpdateCompanyDto, userIdStr?: string) {
        const auth = await this.checkPermission(userIdStr);
        if (!auth.allowed) return { success: false, message: auth.error };

        try {
            const updateData: any = { ...data };
            if (updateData.level !== undefined) updateData.level = typeof data.level === 'string' ? parseInt(data.level) : data.level;
            if (updateData.foundedYear !== undefined) updateData.foundedYear = typeof data.foundedYear === 'string' ? parseInt(data.foundedYear) : data.foundedYear;
            if (updateData.employees !== undefined) updateData.employees = typeof data.employees === 'string' ? parseInt(data.employees) : data.employees;
            if (updateData.annualRevenue !== undefined) updateData.annualRevenue = BigInt(updateData.annualRevenue);
            if (updateData.parentId !== undefined) updateData.parentId = data.parentId ? (typeof data.parentId === 'string' ? parseInt(data.parentId) : data.parentId) : null;

            const updated = await this.prisma.company.update({ where: { id }, data: updateData });
            return { success: true, data: { ...updated, annualRevenue: Number(updated.annualRevenue) } };
        } catch (e) {
            return { success: false, message: '更新失败，请检查数据格式' };
        }
    }

    async remove(id: number, userIdStr?: string) {
        const auth = await this.checkPermission(userIdStr);
        if (!auth.allowed) return { success: false, message: auth.error };

        try {
            await this.prisma.company.delete({ where: { id } });
            return { success: true, message: '删除成功' };
        } catch (e) {
            return { success: false, message: '删除失败！该公司可能存在关联的子节点。' };
        }
    }

    async getDashboardBasicStats() {
        try {
            const [aggregateData, countryGroups] = await Promise.all([
                this.prisma.company.aggregate({ _count: { id: true }, _sum: { annualRevenue: true, employees: true } }),
                this.prisma.company.groupBy({ by: ['country'], _count: { country: true }, where: { country: { not: null } } })
            ]);

            return {
                success: true,
                data: {
                    totalCompanies: aggregateData._count.id,
                    totalRevenue: aggregateData._sum.annualRevenue ? Number(aggregateData._sum.annualRevenue) : 0,
                    totalEmployees: aggregateData._sum.employees || 0,
                    uniqueCountries: countryGroups.length
                }
            };
        } catch (error) {
            return { success: false, data: { totalCompanies: 0, totalRevenue: 0, totalEmployees: 0, uniqueCountries: 0 } };
        }
    }

    async getLevelStats() {
        try {
            const levelStats = await this.prisma.company.groupBy({ by: ['level'], _count: { level: true }, orderBy: { level: 'asc' } });
            return { success: true, data: levelStats.map(stat => ({ level: stat.level, count: stat._count.level })) };
        } catch (error) {
            return { success: false, data: [] };
        }
    }

    async getGrowthStats() {
        try {
            const companiesByYear = await this.prisma.company.groupBy({ by: ['foundedYear'], _count: { id: true }, where: { foundedYear: { not: null } }, orderBy: { foundedYear: 'asc' } });
            let cumulativeCount = 0;
            const growthStats = companiesByYear.map((item) => {
                cumulativeCount += item._count.id;
                return { year: item.foundedYear, count: cumulativeCount };
            });
            return { success: true, data: growthStats };
        } catch (error) {
            return { success: false, data: [] };
        }
    }

    async getFilterOptions() {
        try {
            const [levels, locations] = await Promise.all([
                this.prisma.company.groupBy({ by: ['level'], orderBy: { level: 'asc' } }),
                this.prisma.company.groupBy({ by: ['country', 'city'], where: { country: { not: null }, city: { not: null } }, orderBy: { country: 'asc' } })
            ]);

            const uniqueCountries = Array.from(new Set(locations.map(l => l.country).filter(Boolean)));
            const uniqueCities = Array.from(new Set(locations.map(l => l.city).filter(Boolean)));

            return {
                success: true,
                data: { levels: levels.map(l => l.level), countries: uniqueCountries, cities: uniqueCities, rawLocations: locations.map(l => ({ country: l.country, city: l.city })) }
            };
        } catch (error) {
            return { success: false, data: { levels: [], countries: [], cities: [], rawLocations: [] } };
        }
    }

    private buildWhere(filters: ChartFiltersDto): Prisma.CompanyWhereInput {
        const where: Prisma.CompanyWhereInput = {};
        if (filters?.levels?.length) where.level = { in: filters.levels.map(Number) };
        if (filters?.countries?.length) where.country = { in: filters.countries };
        if (filters?.cities?.length) where.city = { in: filters.cities };

        if (filters?.foundedYear?.start || filters?.foundedYear?.end) {
            where.foundedYear = {};
            if (filters.foundedYear.start) where.foundedYear.gte = parseInt(filters.foundedYear.start);
            if (filters.foundedYear.end) where.foundedYear.lte = parseInt(filters.foundedYear.end);
        }
        if (filters?.employees?.min || filters?.employees?.max) {
            where.employees = {};
            if (filters.employees.min) where.employees.gte = parseInt(filters.employees.min);
            if (filters.employees.max) where.employees.lte = parseInt(filters.employees.max);
        }
        if (filters?.annualRevenue?.min || filters?.annualRevenue?.max) {
            where.annualRevenue = {};
            if (filters.annualRevenue.min) where.annualRevenue.gte = BigInt(filters.annualRevenue.min);
            if (filters.annualRevenue.max) where.annualRevenue.lte = BigInt(filters.annualRevenue.max);
        }
        return where;
    }

    private buildAndFilterTree(allCompanies: Company[], filters: ChartFiltersDto): TreeNode | null {
        const map = new Map<number, TreeNode>();
        
        allCompanies.forEach(c => {
            map.set(c.id, {
                id: c.id,
                name: c.name,
                level: `Level ${c.level}`,
                levelNum: c.level,
                country: c.country,
                city: c.city,
                foundedYear: c.foundedYear,
                revenue: c.annualRevenue ? Number(c.annualRevenue) : 0,
                employees: c.employees,
                parentId: c.parentId,
                children: []
            });
        });

        const root: TreeNode = { name: 'Global Supply Chain Network', level: 'Root', children: [] };
        
        map.forEach(node => {
            if (node.parentId && map.has(node.parentId)) {
                map.get(node.parentId)!.children!.push(node);
            } else {
                root.children!.push(node); 
            }
        });

        const filterNode = (node: TreeNode): TreeNode | null => {
            let isMatch = true;
            if (node.level !== 'Root') {
                if (filters?.levels?.length && !filters.levels.includes(node.levelNum as number)) isMatch = false;
                if (filters?.countries?.length && !filters.countries.includes(node.country as string)) isMatch = false;
                if (filters?.cities?.length && !filters.cities.includes(node.city as string)) isMatch = false;
                if (filters?.foundedYear?.start && (node.foundedYear as number) < parseInt(filters.foundedYear.start)) isMatch = false;
                if (filters?.foundedYear?.end && (node.foundedYear as number) > parseInt(filters.foundedYear.end)) isMatch = false;
                if (filters?.employees?.min && (node.employees as number) < parseInt(filters.employees.min)) isMatch = false;
                if (filters?.employees?.max && (node.employees as number) > parseInt(filters.employees.max)) isMatch = false;
                if (filters?.annualRevenue?.min && (node.revenue as number) < parseInt(filters.annualRevenue.min)) isMatch = false;
                if (filters?.annualRevenue?.max && (node.revenue as number) > parseInt(filters.annualRevenue.max)) isMatch = false;
            }

            let filteredChildren: TreeNode[] = [];
            if (node.children) {
                filteredChildren = node.children.map(filterNode).filter((child): child is TreeNode => child !== null);
            }

            if (isMatch) {
                const hasChildren = filteredChildren.length > 0;
                return {
                    ...node,
                    children: hasChildren ? filteredChildren : undefined,
                    value: (!hasChildren && !node.value) ? (node.revenue || 1000) : node.value
                };
            }
            if (filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }
            return null;
        };

        return filterNode(root);
    }

    async getAnalyticsData(payload: AnalyticsPayloadDto) {
        try {
            const { dimension, filters } = payload;
            const where = this.buildWhere(filters);

            const groupByField = dimension as 'level' | 'country' | 'city';
            const grouped = await this.prisma.company.groupBy({
                by: [groupByField], _count: { id: true }, where, orderBy: { _count: { id: 'desc' } }, take: 20
            });
            
            const validResults = grouped.filter(item => item[groupByField] !== null);
            const barChart = {
                labels: validResults.map(item => String(item[groupByField])),
                data: validResults.map(item => item._count.id)
            };

            const allCompanies = await this.prisma.company.findMany();
            const bubbleChart = this.buildAndFilterTree(allCompanies, filters);

            return { success: true, barChart, bubbleChart };
        } catch (error) {
            console.error("Analytics Error:", error);
            return { success: false, barChart: { labels: [], data: [] }, bubbleChart: null };
        }
    }
}