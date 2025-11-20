import { Module } from '@nestjs/common';
import { TelegramImprovedService } from './telegram-improved.service';
import { PrismaService } from '../prisma.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [TelegramImprovedService, PrismaService],
  exports: [TelegramImprovedService],
})
export class TelegramModule {}
