import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TurkeyService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TelegramImprovedService))
    private readonly telegramService: TelegramImprovedService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'turkey-proofs');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async savePaymentProof(orderId: string, file: any): Promise<{ success: boolean; filePath: string }> {
    try {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `${orderId}_${timestamp}${ext}`;
      const filePath = path.join(this.uploadDir, filename);

      fs.writeFileSync(filePath, file.buffer);

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          turkey_payment_proof: filename,
          payment_method: 'Turkey IBAN Transfer',
        },
      });

      try {
        await this.telegramService.sendPaymentProofNotification(orderId, filePath, 'TURKEY');
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
      }

      return {
        success: true,
        filePath: filename,
      };
    } catch (error) {
      console.error('Error saving payment proof:', error);
      throw new HttpException(
        'Failed to save payment proof',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
