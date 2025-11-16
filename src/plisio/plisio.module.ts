import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlisioController } from './plisio.controller';
import { PlisioService } from './plisio.service';
import { PrismaService } from '../prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Module({
  imports: [ConfigModule],
  controllers: [PlisioController],
  providers: [PlisioService, PrismaService, TelegramService],
  exports: [PlisioService],
})
export class PlisioModule {}
