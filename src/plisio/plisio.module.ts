import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlisioController } from './plisio.controller';
import { PlisioService } from './plisio.service';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ConfigModule, TelegramModule, AnalyticsModule],
  controllers: [PlisioController],
  providers: [PlisioService, PrismaService],
  exports: [PlisioService],
})
export class PlisioModule {}
