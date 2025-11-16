import { Module, forwardRef } from '@nestjs/common';
import { CointopayService } from './cointopay.service';
import { PaymentCheckService } from './payment-check.service';
import { PrismaService } from '../prisma.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  providers: [CointopayService, PaymentCheckService, PrismaService],
  exports: [CointopayService, PaymentCheckService],
})
export class CointopayModule {}
