import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentCheckService {
  private readonly logger = new Logger(PaymentCheckService.name);

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {}

  /**
   * Проверка платежей CoinToPay каждые 10 минут
   * Делает реальный запрос к шлюзу CoinToPay
   */
  @Cron('*/10 * * * *', {
    name: 'check-cointopay-payments',
  })
  async checkPendingCointopayPayments() {
    this.logger.log('🔍 Starting CoinToPay payment check at gateway...');

    try {
      // Найти все заказы с методом оплаты "Open Banking" и статусом "pending"
      const pendingOrders = await this.prisma.order.findMany({
        where: {
          payment_method: 'Open Banking',
          payment_status: 'pending',
          gateway_payment_id: {
            not: null,
          },
        },
        select: {
          id: true,
          gateway_payment_id: true,
          created_at: true,
        },
      });

      this.logger.log(`Found ${pendingOrders.length} pending CoinToPay orders`);

      for (const order of pendingOrders) {
        try {
          // Проверить статус платежа
          const status = await this.ordersService.checkCointopayPaymentStatus(order.id);
          
          this.logger.log(
            `Order ${order.id}: Status=${status.status}, isPaid=${status.isPaid}, isPending=${status.isPending}, isExpired=${status.isExpired}`
          );

          // Если платёж истёк (более 72 часов), можно отменить заказ
          if (status.isExpired) {
            const hoursSinceCreation = 
              (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceCreation > 72) {
              this.logger.warn(`Order ${order.id} payment expired (${hoursSinceCreation.toFixed(1)}h ago)`);
              
              // Можно автоматически отменить заказ
              // await this.ordersService.updateOrderStatus(order.id, {
              //   status: 'cancelled',
              //   notes: 'Payment expired - automatically cancelled after 72 hours',
              // });
            }
          }

        } catch (error) {
          this.logger.error(`Failed to check payment for order ${order.id}:`, error.message);
        }
      }

      this.logger.log('CoinToPay payment check completed');

    } catch (error) {
      this.logger.error('Error during CoinToPay payment check:', error);
    }
  }

  /**
   * Ручной запуск проверки (для тестирования)
   */
  async triggerManualCheck() {
    this.logger.log('Manual CoinToPay payment check triggered');
    await this.checkPendingCointopayPayments();
  }
}
