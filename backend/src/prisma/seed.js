import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 12);
  const adminPassword = await bcrypt.hash('admin@123', 12);

  const categories = [
    { key: 'PLUMBER', name: 'Plumbing', icon: 'Droplets', keywords: ['pipe', 'leak', 'water', 'drain', 'tap', 'toilet', 'plumber'] },
    { key: 'ELECTRICIAN', name: 'Electrical', icon: 'Zap', keywords: ['electric', 'power', 'wire', 'light', 'switch', 'socket', 'electrician'] },
    { key: 'AC_TECHNICIAN', name: 'AC & Cooling', icon: 'Snowflake', keywords: ['ac', 'air conditioner', 'cooling', 'compressor', 'hvac'] },
    { key: 'CARPENTER', name: 'Carpentry', icon: 'Hammer', keywords: ['wood', 'furniture', 'door', 'cabinet', 'carpenter'] },
  ];
  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { key: category.key },
      update: { ...category, status: 'APPROVED' },
      create: { ...category, status: 'APPROVED' },
    });
  }

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { password: adminPassword, role: 'ADMIN' },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'ADMIN',
      phone: '+919999999999',
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'user@zoon.com' },
    update: {},
    create: {
      name: 'Rahul Kumar',
      email: 'user@zoon.com',
      password: hashedPassword,
      role: 'USER',
      phone: '+919876543210',
      latitude: 11.2588,
      longitude: 75.7804,
      address: 'Kozhikode, Kerala',
    },
  });
  console.log('✅ User created:', user.email);

  // Create Workers
  const workers = [
    { name: 'Suresh Plumber', email: 'plumber@zoon.com', serviceType: 'PLUMBER', lat: 11.262, lon: 75.783 },
    { name: 'Arun Electric', email: 'electric@zoon.com', serviceType: 'ELECTRICIAN', lat: 11.255, lon: 75.776 },
    { name: 'Babu AC Tech', email: 'ac@zoon.com', serviceType: 'AC_TECHNICIAN', lat: 11.265, lon: 75.790 },
    { name: 'Ravi Carpenter', email: 'carpenter@zoon.com', serviceType: 'CARPENTER', lat: 11.252, lon: 75.785 },
  ];

  for (const w of workers) {
    const worker = await prisma.user.upsert({
      where: { email: w.email },
      update: {},
      create: {
        name: w.name,
        email: w.email,
        password: hashedPassword,
        role: 'WORKER',
        phone: '+91' + Math.floor(7000000000 + Math.random() * 2999999999),
        latitude: w.lat,
        longitude: w.lon,
        workerProfile: {
          create: {
            serviceType: w.serviceType,
            latitude: w.lat,
            longitude: w.lon,
            isAvailable: true,
            rating: 4.2 + Math.random() * 0.8,
            bio: `Experienced ${w.serviceType.replace('_', ' ').toLowerCase()} with 5+ years of service in Kozhikode area.`,
          },
        },
      },
    });
    await prisma.workerProfile.update({
      where: { userId: worker.id },
      data: { serviceKey: w.serviceType, applicationStatus: 'APPROVED', isAvailable: true },
    });
    const profile = await prisma.workerProfile.findUnique({ where: { userId: worker.id } });
    const category = await prisma.serviceCategory.findUnique({ where: { key: w.serviceType } });
    if (profile && category) {
      await prisma.workerService.upsert({
        where: { workerId_categoryId: { workerId: profile.id, categoryId: category.id } },
        create: { workerId: profile.id, categoryId: category.id },
        update: {},
      });
    }
    console.log(`✅ Worker created: ${worker.name} (${w.serviceType})`);
  }

  console.log('\n🎉 Seed complete!');
  console.log('Login credentials (all use password: password123):');
  console.log('  Admin: admin@example.com (password: admin@123)');
  console.log('  User:  user@zoon.com');
  console.log('  Workers: plumber@zoon.com, electric@zoon.com, ac@zoon.com, carpenter@zoon.com');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
