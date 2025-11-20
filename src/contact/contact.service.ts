import { Injectable } from '@nestjs/common';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

@Injectable()
export class ContactService {
  constructor(private readonly telegramService: TelegramImprovedService) {}

  async sendToTelegram(data: ContactFormData): Promise<void> {
    const message = this.formatContactMessage(data);

    try {
      await this.telegramService.sendMessage(message);
      console.log('✅ Contact form sent to Telegram');
    } catch (error) {
      console.error('❌ Failed to send contact form to Telegram:', error);
      throw error;
    }
  }

  private formatContactMessage(data: ContactFormData): string {
    return `
🔔 <b>NEW CONTACT FORM SUBMISSION</b>

👤 <b>Name:</b> ${data.firstName} ${data.lastName}
📧 <b>Email:</b> ${data.email}
${data.phone ? `📱 <b>Phone:</b> ${data.phone}\n` : ''}
📋 <b>Subject:</b> ${data.subject}

💬 <b>Message:</b>
${data.message}

⏰ <b>Received:</b> ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Brussels' })}
    `.trim();
  }
}
