import { Module } from '@nestjs/common';
import { TelegramImprovedService } from './telegram-improved.service';
import { PrismaService } from '../prisma.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AnalyticsModule, EmailModule],
  providers: [TelegramImprovedService, PrismaService],
  exports: [TelegramImprovedService],
})
export class TelegramModule {}
