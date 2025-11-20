import { Module } from '@nestjs/common';
import { AmPayController } from './ampay.controller';
import { AmPayService } from './ampay.service';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [TelegramModule, AnalyticsModule],
  controllers: [AmPayController],
  providers: [AmPayService, PrismaService],
  exports: [AmPayService],
})
export class AmPayModule {}
