import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import * as fs from 'fs';
import * as path from 'path';

interface SepaBankDetails {
  iban: string;
  bic_swift: string;
  accountName: string;
  bankName: string;
  bankAddress: string;
}

@Injectable()
export class SepaService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TelegramImprovedService))
    private readonly telegramService: TelegramImprovedService,
  ) {
    // Create uploads directory if it doesn't exist
    this.uploadDir = path.join(process.cwd(), 'uploads', 'sepa-proofs');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async getBankDetails(): Promise<SepaBankDetails> {
    try {
      const response = await fetch('https://id.lux-store.eu/sepa.php');
      
      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch bank details',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching SEPA bank details:', error);
      throw new HttpException(
        'Unable to retrieve bank details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async savePaymentProof(orderId: string, file: any): Promise<{ success: boolean; filePath: string }> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `${orderId}_${timestamp}${ext}`;
      const filePath = path.join(this.uploadDir, filename);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Update order with proof path
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          sepa_payment_proof: filename,
          payment_method: 'SEPA Instant Transfer',
        },
      });

      // Send Telegram notification with payment proof
      try {
        await this.telegramService.sendPaymentProofNotification(orderId, filePath, 'SEPA');
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
        // Don't throw error, file is saved successfully
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
        select: { sepa_payment_proof: true },
      });

      if (!order || !order.sepa_payment_proof) {
        return { exists: false };
      }

      const fullPath = path.join(this.uploadDir, order.sepa_payment_proof);
      
      if (!fs.existsSync(fullPath)) {
        return { exists: false };
      }

      const buffer = fs.readFileSync(fullPath);
      return {
        exists: true,
        filePath: order.sepa_payment_proof,
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
