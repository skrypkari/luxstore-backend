import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { ORDER_STATUSES } from './order-statuses.constant';
import { EmailService } from '../email/email.service';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';

@Injectable()
export class OrderStatusSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(OrderStatusSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly telegramService: TelegramImprovedService,
  ) {}

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
            lte: new Date(Date.now() - 30 * 60 * 1000),
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

  @Cron(CronExpression.EVERY_HOUR)
  async sendPaymentReminders() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      const ordersAwaitingPayment = await this.prisma.order.findMany({
        where: {
          created_at: {
            gte: twentyFiveHoursAgo,
            lte: twentyFourHoursAgo,
          },
          statuses: {
            some: {
              status: ORDER_STATUSES.AWAITING_PAYMENT,
              is_current: true,
            },
          },
        },
        include: {
          items: true,
        },
      });

      if (ordersAwaitingPayment.length === 0) {
        return;
      }

      this.logger.log(
        `[PaymentReminder] Found ${ordersAwaitingPayment.length} orders awaiting payment for 24+ hours`,
      );

      for (const order of ordersAwaitingPayment) {
        try {
          await this.emailService.sendPaymentReminderEmail(order);

          const itemsList = order.items
            .map((item) => `- ${item.product_name} x${item.quantity}`)
            .join('\n');

          const message = `
🔔 <b>Payment Reminder Sent</b>

Order: <code>${order.id}</code>
Customer: ${order.customer_first_name} ${order.customer_last_name}
Email: ${order.customer_email}
Amount: €${order.total.toFixed(2)}

Items:
${itemsList}

Created: ${order.created_at.toLocaleString('en-US', { timeZone: 'Europe/London' })}

Status: ⏳ Awaiting Payment (24+ hours)
          `.trim();

          await this.telegramService.sendMessage(message);

          this.logger.log(
            `[PaymentReminder] Sent reminder for order ${order.id}`,
          );
        } catch (error) {
          this.logger.error(
            `[PaymentReminder] Failed to send reminder for order ${order.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `[PaymentReminder] Successfully processed ${ordersAwaitingPayment.length} reminders`,
      );
    } catch (error) {
      this.logger.error('[PaymentReminder] Error in payment reminders:', error);
    }
  }
}
