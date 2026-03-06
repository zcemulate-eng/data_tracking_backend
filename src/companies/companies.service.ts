// backend/src/companies/companies.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
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

    // 专用于拦截未登录用户的“读权限”校验器
    private async checkLogin(userIdStr?: string) {
        if (!userIdStr) {
            throw new UnauthorizedException({ success: false, message: '未登录，禁止访问企业数据' });
        }
        const userId = parseInt(userIdStr, 10);
        if (isNaN(userId)) {
            throw new UnauthorizedException({ success: false, message: '无效的用户凭证' });
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException({ success: false, message: '用户不存在或凭证已失效' });
        }
        return { allowed: true, user };
    }


    private async checkPermission(userIdStr?: string) {
        if (!userIdStr) return { allowed: false, error: '未登录' };
        const userId = parseInt(userIdStr, 10);
        if (isNaN(userId)) return { allowed: false, error: '无效的用户ID' };

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { allowed: false, error: '用户不存在' };
        if (user.role === 'User') return { allowed: false, error: '越权操作：需要 Manager 或 Admin 权限' };

        return { allowed: true, user };
    }



    async findAll(query: CompanyQueryDto, userIdStr?: string) {

        await this.checkLogin(userIdStr); // 拦截未登录

        const page = parseInt(query.page as string) || 1;
        const pageSize = parseInt(query.pageSize as string) || 10;
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

    async getLevels(userIdStr?: string) {
        await this.checkLogin(userIdStr);
        try {
            const groups = await this.prisma.company.groupBy({ by: ['level'], orderBy: { level: 'asc' } });
            return { success: true, data: groups.map(g => g.level) };
        } catch (error) {
            return { success: false, data: [] };
        }
    }

    async create(data: CreateCompanyDto, userIdStr?: string) {
        // 1. 权限校验
        const auth = await this.checkPermission(userIdStr);
        if (!auth.allowed) return { success: false, message: auth.error };

        const parsedLevel = typeof data.level === 'string' ? parseInt(data.level) : data.level;
        const parsedParentId = data.parentId ? (typeof data.parentId === 'string' ? parseInt(data.parentId) : data.parentId) : null;

        // 2. 核心防御：父节点有效性与 Level 层级强制校验
        if (parsedParentId) {
            const parentCompany = await this.prisma.company.findUnique({
                where: { id: parsedParentId }
            });

            if (!parentCompany) {
                return { success: false, message: '创建失败：关联的父公司(Parent ID)不存在' };
            }
            if (parsedLevel !== parentCompany.level + 1) {
                return { success: false, message: `创建失败：层级逻辑错误！父节点层级为${parentCompany.level}，当前节点层级必须为${parentCompany.level + 1}` };
            }
        } else if (parsedLevel !== 1) {
            // 如果没有父节点，它必须是顶层(Level 1)
            return { success: false, message: '创建失败：非顶层公司必须关联一个父公司(Parent ID)' };
        }

        // 3. 数据库入库
        try {
            const newCompany = await this.prisma.company.create({
                data: {
                    companyCode: data.companyCode,
                    name: data.name,
                    level: parsedLevel,
                    country: data.country,
                    city: data.city,
                    foundedYear: data.foundedYear ? (typeof data.foundedYear === 'string' ? parseInt(data.foundedYear) : data.foundedYear) : null,
                    annualRevenue: data.annualRevenue ? BigInt(data.annualRevenue) : null,
                    employees: data.employees ? (typeof data.employees === 'string' ? parseInt(data.employees) : data.employees) : null,
                    parentId: parsedParentId,
                }
            });
            return { success: true, data: { ...newCompany, annualRevenue: Number(newCompany.annualRevenue) } };

        } catch (e: any) {
            // 4. 精准错误捕获 (Prisma 的唯一约束冲突代号是 P2002)
            if (e.code === 'P2002' && e.meta?.target?.includes('company_code')) {
                return { success: false, message: `创建失败：公司识别码 ${data.companyCode} 已被使用` };
            }
            console.error("Create Company Error:", e);
            return { success: false, message: '服务器内部错误，请检查输入数据' };
        }
    }

    // --- 4. 更新公司 (带严格的父子层级防御逻辑) ---
    async update(id: number, data: UpdateCompanyDto, userIdStr?: string) {
        // 1. 权限校验
        const auth = await this.checkPermission(userIdStr);
        if (!auth.allowed) return { success: false, message: auth.error };

        try {
            // 获取当前公司信息
            const currentCompany = await this.prisma.company.findUnique({ where: { id } });
            if (!currentCompany) return { success: false, message: '更新失败：公司不存在' };

            // 处理类型转换，如果前端没传该字段，则沿用当前数据库里的旧值
            const newLevel = data.level !== undefined ? (typeof data.level === 'string' ? parseInt(data.level) : data.level) : currentCompany.level;
            const newParentId = data.parentId !== undefined ? (data.parentId ? (typeof data.parentId === 'string' ? parseInt(data.parentId) : data.parentId) : null) : currentCompany.parentId;

            // 严格校验最终的 Level 与 ParentId 关系 
            if (newParentId) {
                // 不能把自己设为自己的父节点
                if (newParentId === id) return { success: false, message: '更新失败：公司不能作为自己的父公司' };

                const parentCompany = await this.prisma.company.findUnique({ where: { id: newParentId } });
                if (!parentCompany) return { success: false, message: '更新失败：关联的父公司(Parent ID)不存在' };

                // 校验层级是否等于父级+1
                if (newLevel !== parentCompany.level + 1) {
                    return { success: false, message: `层级逻辑错误！父节点层级为${parentCompany.level}，当前节点层级必须为${parentCompany.level + 1}` };
                }
            } else if (newLevel !== 1) {
                // 没有父节点的话，必须是顶层(Level 1)
                return { success: false, message: '更新失败：非顶层公司必须关联一个父公司(Parent ID)' };
            }

            // 3. 准备更新数据
            const updateData: any = { ...data };
            if (data.level !== undefined) updateData.level = newLevel;
            if (data.parentId !== undefined) updateData.parentId = newParentId;
            if (data.foundedYear !== undefined) updateData.foundedYear = data.foundedYear ? (typeof data.foundedYear === 'string' ? parseInt(data.foundedYear) : data.foundedYear) : null;
            if (data.annualRevenue !== undefined) updateData.annualRevenue = data.annualRevenue ? BigInt(data.annualRevenue) : null;
            if (data.employees !== undefined) updateData.employees = data.employees ? (typeof data.employees === 'string' ? parseInt(data.employees) : data.employees) : null;

            // 4. 执行入库
            const updatedCompany = await this.prisma.company.update({
                where: { id },
                data: updateData
            });

            return { success: true, data: { ...updatedCompany, annualRevenue: updatedCompany.annualRevenue ? Number(updatedCompany.annualRevenue) : null } };

        } catch (e: any) {
            if (e.code === 'P2002' && e.meta?.target?.includes('company_code')) {
                return { success: false, message: `更新失败：公司识别码已被其他公司使用` };
            }
            console.error("Update Company Error:", e);
            return { success: false, message: '服务器内部错误，请检查输入数据' };
        }
    }

    // --- 5. 删除公司 (带级联防御逻辑) ---
    async remove(id: number, userIdStr?: string) {
        // 1. 权限校验
        const auth = await this.checkPermission(userIdStr);
        if (!auth.allowed) return { success: false, message: auth.error };

        try {
            // 2. 检查要删除的公司是否存在
            const company = await this.prisma.company.findUnique({
                where: { id }
            });

            if (!company) {
                return { success: false, message: '删除失败：找不到该公司' };
            }

            // 核心防御：检查是否存在子节点 
            const childrenCount = await this.prisma.company.count({
                where: { parentId: id }
            });

            if (childrenCount > 0) {
                return {
                    success: false,
                    message: `删除失败：该公司下还有 ${childrenCount} 个子节点。请先删除或转移其子公司。`
                };
            }

            // 4. 安全执行删除
            await this.prisma.company.delete({
                where: { id }
            });

            return { success: true, message: '删除成功' };

        } catch (error: any) {
            console.error("Delete Company Error:", error);
            // 兜底防御 Prisma 的外键约束报错 (P2003)
            if (error.code === 'P2003') {
                return { success: false, message: '删除失败：存在关联的子级数据约束' };
            }
            return { success: false, message: '服务器内部错误，删除失败' };
        }
    }

    async getDashboardBasicStats(userIdStr?: string) {
        await this.checkLogin(userIdStr); // 拦截未登录
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

    async getLevelStats(userIdStr?: string) {
        await this.checkLogin(userIdStr); // 拦截未登录
        try {
            const levelStats = await this.prisma.company.groupBy({ by: ['level'], _count: { level: true }, orderBy: { level: 'asc' } });
            return { success: true, data: levelStats.map(stat => ({ level: stat.level, count: stat._count.level })) };
        } catch (error) {
            return { success: false, data: [] };
        }
    }

    async getGrowthStats(userIdStr?: string) {
        await this.checkLogin(userIdStr); // 拦截未登录
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

    async getFilterOptions(userIdStr?: string) {
        await this.checkLogin(userIdStr); // 拦截未登录
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

    async getAnalyticsData(payload: AnalyticsPayloadDto, userIdStr?: string) {
        await this.checkLogin(userIdStr); // 拦截未登录
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