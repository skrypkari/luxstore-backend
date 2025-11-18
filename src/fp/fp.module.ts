import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FpController } from './fp.controller';
import { FpService } from './fp.service';
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
  controllers: [FpController],
  providers: [FpService, PrismaService],
  exports: [FpService],
})
export class FpModule {}
