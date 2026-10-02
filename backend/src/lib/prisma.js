import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const prisma = new PrismaClient({
  log: ['warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
