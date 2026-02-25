// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- 辅助工具函数 ---
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const generateCode = () => 'COMP-' + Math.random().toString(36).substring(2, 8).toUpperCase();

const locationMap: Record<string, string[]> = {
  'Canada': ['Calgary', 'Hamilton', 'Montreal', 'Ottawa', 'Winnipeg'],
  'China': ['Beijing', 'Guangzhou', 'Hangzhou', 'Nanjing', 'Shanghai', 'Shenzhen', 'Tianjin'],
  'France': ['Bordeaux', 'Lille', 'Lyon', 'Marseille', 'Montpellier', 'Nantes', 'Nice', 'Toulouse'],
  'Germany': ['Berlin', 'Cologne', 'Dortmund', 'Essen', 'Frankfurt', 'Leipzig', 'Munich', 'Stuttgart'],
  'India': ['Bangalore', 'Delhi', 'Hyderabad', 'Jaipur'],
  'Japan': ['Fukuoka', 'Kawasaki', 'Kobe', 'Nagoya', 'Osaka', 'Saitama', 'Sapporo', 'Tokyo', 'Yokohama'],
  'UK': ['Birmingham', 'Bristol', 'Cardiff', 'Edinburgh', 'Liverpool', 'London', 'Manchester', 'Sheffield'],
  'USA': ['Chicago', 'Dallas', 'Houston', 'Los Angeles', 'Philadelphia', 'San Jose']
};
const countries = Object.keys(locationMap);
const prefixes = ['Global', 'Tech', 'Eco', 'Smart', 'Future', 'Cyber', 'Nano', 'Green', 'Data', 'Cloud'];
const suffixes = ['Corp', 'Inc', 'Ltd', 'Group', 'Systems', 'Solutions', 'Logistics', 'Holdings'];

const generateName = (level: number, index: number) => `${pick(prefixes)} ${pick(suffixes)} L${level}-${index}`;

// --- 递归插入数据的核心逻辑 ---
async function seedLevel(parentId: number, currentDepth: number, maxDepth: number) {
  if (currentDepth > maxDepth) return;

  const numChildren = randomInt(3, 6); 
  for (let i = 1; i <= numChildren; i++) {
    const country = pick(countries);
    const city = pick(locationMap[country]);
    const baseRevenue = 1000 / currentDepth; 
    const revenueVal = randomInt(baseRevenue * 0.5, baseRevenue * 1.5) * 1000000; // 转换成真实的金额数字

    // 1. 插入当前子节点
    const newCompany = await prisma.company.create({
      data: {
        companyCode: generateCode(),
        name: generateName(currentDepth, i),
        level: currentDepth,
        country: country,
        city: city,
        foundedYear: randomInt(1990, 2024),
        annualRevenue: BigInt(Math.round(revenueVal)), // 注意：数据库是 BigInt，必须转换
        employees: randomInt(50, 5000) * (4 - currentDepth),
        parentId: parentId, // 👉 核心：关联父节点的 ID
      }
    });

    // 2. 递归：如果还没到底层，继续以当前节点为父节点往下生成
    if (currentDepth < maxDepth) {
      await seedLevel(newCompany.id, currentDepth + 1, maxDepth);
    }
  }
}

// --- 主执行函数 ---
async function main() {
  console.log('🧹 清理旧的公司数据...');
  await prisma.company.deleteMany({});

  console.log('🌱 开始播种 Root 节点 (Level 1)...');
  const roots = [
    { name: "Alpha Holdings (L1)", country: "USA", city: "Chicago", year: 1995, rev: 5200000000, emp: 45000 },
    { name: "Beta Logistics (L1)", country: "China", city: "Shanghai", year: 2008, rev: 3800000000, emp: 32000 },
    { name: "Gamma Systems (L1)", country: "Germany", city: "Berlin", year: 2001, rev: 4500000000, emp: 28000 }
  ];

  for (const root of roots) {
    const rootNode = await prisma.company.create({
      data: {
        companyCode: generateCode(),
        name: root.name,
        level: 1,
        country: root.country,
        city: root.city,
        foundedYear: root.year,
        annualRevenue: BigInt(root.rev),
        employees: root.emp,
        parentId: null // 顶层节点没有父节点
      }
    });
    
    console.log(`正在为 ${root.name} 生成子网络...`);
    // 生成 Level 2 和 Level 3
    await seedLevel(rootNode.id, 2, 3);
  }
  
  console.log('✅ 数据播种完成！所有层级关系已持久化到数据库。');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });