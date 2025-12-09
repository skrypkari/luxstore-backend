import { Module, forwardRef } from '@nestjs/common';
import { TurkeyController } from './turkey.controller';
import { TurkeyService } from './turkey.service';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [forwardRef(() => TelegramModule)],
  controllers: [TurkeyController],
  providers: [TurkeyService, PrismaService],
  exports: [TurkeyService],
})
export class TurkeyModule {}
