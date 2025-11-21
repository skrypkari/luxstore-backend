import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import * as fs from 'fs';
import * as path from 'path';

interface FpBankDetails {
  accountNumber: string;
  sortCode: string;
  accountName: string;
  bankName: string;
  bankAddress: string;
}

@Injectable()
export class FpService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TelegramImprovedService))
    private readonly telegramService: TelegramImprovedService,
  ) {

    this.uploadDir = path.join(process.cwd(), 'uploads', 'fp-proofs');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async getBankDetails(): Promise<FpBankDetails> {
    try {
      const response = await fetch('https://id.lux-store.eu/fp.php');
      
      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch bank details',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching FP bank details:', error);
      throw new HttpException(
        'Unable to retrieve bank details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
          fp_payment_proof: filename,
          payment_method: 'Faster Payments',
        },
      });


      try {
        await this.telegramService.sendPaymentProofNotification(orderId, filePath, 'FP');
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

  async getPaymentProof(orderId: string): Promise<{ exists: boolean; filePath?: string; buffer?: Buffer }> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { fp_payment_proof: true },
      });

      if (!order || !order.fp_payment_proof) {
        return { exists: false };
      }

      const fullPath = path.join(this.uploadDir, order.fp_payment_proof);
      
      if (!fs.existsSync(fullPath)) {
        return { exists: false };
      }

      const buffer = fs.readFileSync(fullPath);
      return {
        exists: true,
        filePath: order.fp_payment_proof,
        buffer,
      };
    } catch (error) {
      console.error('Error retrieving payment proof:', error);
      throw new HttpException(
        'Failed to retrieve payment proof',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
