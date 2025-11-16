import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

async function updateOrderTokens() {
  const orders = await prisma.order.findMany({
    where: {
      access_token: null,
    },
    select: {
      id: true,
    },
  });

  console.log(`Found ${orders.length} orders without tokens`);

  for (const order of orders) {
    const token = generateToken();
    await prisma.order.update({
      where: { id: order.id },
      data: { access_token: token },
    });
    console.log(`Updated order ${order.id} with token`);
  }

  console.log('Done!');
}

updateOrderTokens()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
