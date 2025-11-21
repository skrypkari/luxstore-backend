import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { AmPayService } from './ampay.service';
import type { AmPayWebhookData } from './ampay.service';

@Controller('ampay')
export class AmPayController {
  private readonly logger = new Logger(AmPayController.name);

  constructor(private readonly amPayService: AmPayService) {}

    @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() webhookData: AmPayWebhookData) {
    this.logger.log(`Received AmPay webhook for order ${webhookData.client_transaction_id}`);

    try {
      await this.amPayService.handleWebhook(webhookData);
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);

      return { success: false, message: error.message };
    }
  }
}
