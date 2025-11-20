import { Controller, Post, Body } from '@nestjs/common';
import { ContactService } from './contact.service';

class ContactFormDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async submitContactForm(@Body() data: ContactFormDto) {
    await this.contactService.sendToTelegram(data);
    return { success: true };
  }
}
