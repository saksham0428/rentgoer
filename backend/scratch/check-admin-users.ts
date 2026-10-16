import { prisma } from '../src/lib/prisma';

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tokenVersion: true,
      createdAt: true,
    },
  });
  console.log('Total users:', users.length);
  console.log('Users summary:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

checkUsers().catch(console.error);
