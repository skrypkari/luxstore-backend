import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { ORDER_STATUSES } from './order-statuses.constant';

@Injectable()
export class OrderStatusSchedulerService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    console.log('✅ Order Status Scheduler initialized');
  }

  /**
   * Runs every 5 minutes to check for orders that need auto-transition
   * from "Payment Confirmed" to "Under Review" after 30 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoTransitionPaymentConfirmed() {
    try {
      // Find all orders with current status "Payment Confirmed"
      const ordersToUpdate = await this.prisma.orderStatus.findMany({
        where: {
          status: ORDER_STATUSES.PAYMENT_CONFIRMED,
          is_current: true,
          created_at: {
            lte: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          },
        },
        include: {
          order: true,
        },
      });

      if (ordersToUpdate.length === 0) {
        return;
      }

      console.log(
        `[OrderStatusScheduler] Found ${ordersToUpdate.length} orders to auto-transition`,
      );

      // Update each order
      for (const orderStatus of ordersToUpdate) {
        try {
          // Set current status to not current
          await this.prisma.orderStatus.update({
            where: { id: orderStatus.id },
            data: { is_current: false },
          });

          // Create new status
          await this.prisma.orderStatus.create({
            data: {
              order_id: orderStatus.order_id,
              status: ORDER_STATUSES.UNDER_REVIEW,
              //notes: 'Automatically transitioned after 30 minutes',
              is_current: true,
              is_completed: false,
            },
          });

          console.log(
            `[OrderStatusScheduler] Auto-transitioned order ${orderStatus.order_id} to Under Review`,
          );
        } catch (error) {
          console.error(
            `[OrderStatusScheduler] Failed to transition order ${orderStatus.order_id}:`,
            error,
          );
        }
      }

      console.log(
        `[OrderStatusScheduler] Successfully transitioned ${ordersToUpdate.length} orders`,
      );
    } catch (error) {
      console.error('[OrderStatusScheduler] Error in auto-transition:', error);
    }
  }
}
