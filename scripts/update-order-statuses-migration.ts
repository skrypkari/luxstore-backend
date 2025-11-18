import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_TO_NEW_STATUS_MAP = {
  'Awaiting Payment': 'Awaiting Payment',
  'Payment Confirmed': 'Payment Confirmed',
  'Under Concierge Review': 'Under Review',
  'Processed by Logistics Team': 'Being Prepared',
  'Being Prepared at Our Warehouse': 'Being Prepared',
  'Preparing for Dispatch': 'Scheduled for Dispatch',
  'Shipped': 'On Its Way to You',
  'Delivered': 'Delivered',
  'Cancelled': 'Order Closed',
};

async function updateOrderStatuses() {
  console.log('🔄 Starting order status migration...');

  try {
    for (const [oldStatus, newStatus] of Object.entries(OLD_TO_NEW_STATUS_MAP)) {
      const result = await prisma.orderStatus.updateMany({
        where: {
          status: oldStatus,
        },
        data: {
          status: newStatus,
        },
      });

      if (result.count > 0) {
        console.log(`✅ Updated ${result.count} records from "${oldStatus}" to "${newStatus}"`);
      }
    }

    console.log('✨ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateOrderStatuses();
