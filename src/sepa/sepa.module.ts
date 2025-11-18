import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SepaController } from './sepa.controller';
import { SepaService } from './sepa.service';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    forwardRef(() => TelegramModule),
  ],
  controllers: [SepaController],
  providers: [SepaService, PrismaService],
  exports: [SepaService],
})
export class SepaModule {}
