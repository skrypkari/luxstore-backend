import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatusSchedulerService } from './order-status-scheduler.service';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';
import { CointopayModule } from '../cointopay/cointopay.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AmPayModule } from '../ampay/ampay.module';

@Module({
  imports: [
    TelegramModule,
    forwardRef(() => CointopayModule),
    AnalyticsModule,
    AmPayModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusSchedulerService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
