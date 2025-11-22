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

  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoTransitionPaymentConfirmed() {
    try {
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

      for (const orderStatus of ordersToUpdate) {
        try {
          await this.prisma.orderStatus.update({
            where: { id: orderStatus.id },
            data: { is_current: false },
          });

          await this.prisma.orderStatus.create({
            data: {
              order_id: orderStatus.order_id,
              status: ORDER_STATUSES.UNDER_REVIEW,
              is_current: true,
              is_completed: false,
              gclid: orderStatus.gclid,
              hashed_email: orderStatus.hashed_email,
              hashed_phone_number: orderStatus.hashed_phone_number,
              conversion_value: orderStatus.conversion_value,
              currency_code: 'EUR',
              user_agent: orderStatus.user_agent,
              ip_address: orderStatus.ip_address,
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
