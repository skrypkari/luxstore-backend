import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping старых статусов к новым
const statusMapping = {
  'AWAITING': 'Awaiting Payment',
  'PAYMENT': 'Payment Confirmed',
  'UNDER': 'Under Concierge Review',
  'PROCESSED': 'Processed by Logistics Team',
  'BEING': 'Being Prepared at Our Warehouse',
  'PREPARING': 'Preparing for Dispatch',
  'SHIPPED': 'Shipped',
  'DELIVERED': 'Delivered',
  'CANCELLED': 'Cancelled',
};

async function updateStatuses() {
  console.log('🔄 Starting status update...');

  for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
    const updated = await prisma.orderStatus.updateMany({
      where: {
        status: oldStatus,
      },
      data: {
        status: newStatus,
      },
    });

    if (updated.count > 0) {
      console.log(`✅ Updated ${updated.count} records: "${oldStatus}" → "${newStatus}"`);
    }
  }

  console.log('✅ Status update completed!');
}

updateStatuses()
  .catch((error) => {
    console.error('❌ Error updating statuses:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
