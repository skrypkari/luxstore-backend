import { Module } from '@nestjs/common';
import { TelegramImprovedService } from './telegram-improved.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [TelegramImprovedService, PrismaService],
  exports: [TelegramImprovedService],
})
export class TelegramModule {}
