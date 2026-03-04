// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// 1. 定义 CSV 数据的类型接口，解决 "record 类型未知" 的报错
interface CompanyCsvRecord {
  company_code: string;
  company_name: string;
  level: string;
  country: string;
  city: string;
  founded_year: string;
  annual_revenue: string;
  employees: string;
  parent_company: string;
}

async function main() {
  console.log('🧹 开始清理旧的数据库数据...');
  
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE companies;');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('✅ 旧数据清理完成！');

  console.log('📄 正在读取 CSV 文件...');
  const csvFilePath = path.join(__dirname, 'companies_0110.csv');
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  
  // 2. 将解析出来的数据断言为我们刚刚定义的 CompanyCsvRecord 数组类型
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CompanyCsvRecord[];

  // 排序
  records.sort((a, b) => parseInt(a.level) - parseInt(b.level));

  console.log(`🌱 开始导入真实数据，共 ${records.length} 条...`);
  
  const codeToIdMap = new Map<string, number>();

  for (const record of records) {
    const parentCode = record.parent_company;
    
    // 3. 显式声明类型为 number | null
    let parentId: number | null = null;
    
    if (parentCode && codeToIdMap.has(parentCode)) {
      // 4. Map.get() 返回的是 number | undefined
      // 使用 ?? null 确保当它为 undefined 时 fallback 到 null，解决类型冲突报错
      parentId = codeToIdMap.get(parentCode) ?? null;
    }

    const company = await prisma.company.create({
      data: {
        companyCode: record.company_code, 
        name: record.company_name,
        level: parseInt(record.level),
        country: record.country || null,
        city: record.city || null,
        foundedYear: record.founded_year ? parseInt(record.founded_year) : null,
        annualRevenue: record.annual_revenue ? BigInt(record.annual_revenue) : null,
        employees: record.employees ? parseInt(record.employees) : null,
        parentId: parentId, 
      }
    });

    codeToIdMap.set(company.companyCode, company.id);
  }

  console.log('✅ 数据播种完成！所有真实公司数据及其层级关系已持久化到数据库。');
}

main()
  .catch(e => {
    console.error('❌ 导入过程中发生错误: ', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });