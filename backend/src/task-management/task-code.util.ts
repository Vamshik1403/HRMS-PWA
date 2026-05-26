import { PrismaService } from '../prisma/prisma.service';

export async function nextCustomerCode(prisma: PrismaService, companyID?: number | null) {
  const where = companyID ? { companyID } : {};
  const count = await prisma.taskCustomer.count({ where });
  return `CUST-${String(count + 1).padStart(4, '0')}`;
}

export async function nextTaskCode(prisma: PrismaService, companyID?: number | null) {
  const where = companyID ? { companyID } : {};
  const count = await prisma.taskProject.count({ where });
  return `TASK-${String(count + 1).padStart(4, '0')}`;
}
