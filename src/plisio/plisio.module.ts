import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlisioController } from './plisio.controller';
import { PlisioService } from './plisio.service';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [ConfigModule, TelegramModule],
  controllers: [PlisioController],
  providers: [PlisioService, PrismaService],
  exports: [PlisioService],
})
export class PlisioModule {}
