import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 12);

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@homefix.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@homefix.com',
      password: hashedPassword,
      role: 'ADMIN',
      phone: '+919999999999',
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'user@homefix.com' },
    update: {},
    create: {
      name: 'Rahul Kumar',
      email: 'user@homefix.com',
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
    { name: 'Suresh Plumber', email: 'plumber@homefix.com', serviceType: 'PLUMBER', lat: 11.262, lon: 75.783 },
    { name: 'Arun Electric', email: 'electric@homefix.com', serviceType: 'ELECTRICIAN', lat: 11.255, lon: 75.776 },
    { name: 'Babu AC Tech', email: 'ac@homefix.com', serviceType: 'AC_TECHNICIAN', lat: 11.265, lon: 75.790 },
    { name: 'Ravi Carpenter', email: 'carpenter@homefix.com', serviceType: 'CARPENTER', lat: 11.252, lon: 75.785 },
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
    console.log(`✅ Worker created: ${worker.name} (${w.serviceType})`);
  }

  console.log('\n🎉 Seed complete!');
  console.log('Login credentials (all use password: password123):');
  console.log('  Admin: admin@homefix.com');
  console.log('  User:  user@homefix.com');
  console.log('  Workers: plumber@homefix.com, electric@homefix.com, ac@homefix.com, carpenter@homefix.com');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
