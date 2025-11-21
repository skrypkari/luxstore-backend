import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmailService } from '../email/email.service';

export interface AmPayPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerFullName: string;
  customerIp: string;
  customerCountry: string; // 3-letter ISO code
}

export interface AmPayPaymentResponse {
  status: string;
  system_id: string;
  tracker_id: string;
  redirect_url: string;
  amount?: number;
  commission?: number;
  amount_after_commission?: number;
  currency?: string;
  client_transaction_id?: string;
  payment_method?: string;
  error_message?: string;
}

export interface AmPayWebhookData {
  status: string; // ACCEPTED, PENDING, PROCESSING, EXPIRED, FAILED
  system_id: string;
  tracker_id?: string;
  client_transaction_id: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  error_message?: string;
  [key: string]: any;
}

@Injectable()
export class AmPayService {
  private readonly logger = new Logger(AmPayService.name);
  private readonly amPayGatewayUrl = 'https://traffer.uk/gateway/ampay/ampay.php';

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramImprovedService,
    private analyticsService: AnalyticsService,
    private emailService: EmailService,
  ) {}

    async createPayment(request: AmPayPaymentRequest): Promise<AmPayPaymentResponse> {
    this.logger.log(`Creating AmPay payment for order ${request.orderId}`);

    try {
      const payload = {
        client_merchant_id: 'TRAFFER',
        sub_method: 'GAM',
        currency: request.currency,
        amount: request.amount,
        callback_url: 'https://traffer.uk/gateway/ampay/callback.php',
        client_transaction_id: request.orderId,
        transaction_description: request.orderId,
        customer: {
          ip: request.customerIp,
          email: request.customerEmail,
          full_name: request.customerFullName,
          country: request.customerCountry,
        },
        success_redirect_url: `https://traffer.uk/gateway/ampay/success.php?order_id=${request.orderId}`,
        error_redirect_url: `https://traffer.uk/gateway/ampay/error.php?order_id=${request.orderId}`,
      };

      this.logger.debug('AmPay request payload:', payload);

      const response = await fetch(this.amPayGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`AmPay API error: ${response.status} - ${errorText}`);
        throw new Error(`AmPay API error: ${response.status}`);
      }

      const result: AmPayPaymentResponse = await response.json();
      
      this.logger.log(`AmPay payment created successfully for order ${request.orderId}`);
      this.logger.debug('AmPay response:', result);

      return result;
    } catch (error) {
      this.logger.error(`Failed to create AmPay payment: ${error.message}`, error.stack);
      throw error;
    }
  }

    async handleWebhook(webhookData: AmPayWebhookData): Promise<void> {
    this.logger.log(`Received AmPay webhook for order ${webhookData.client_transaction_id}`);
    this.logger.debug('Webhook data:', webhookData);

    try {
      const orderId = webhookData.client_transaction_id;
      const status = webhookData.status;


      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        this.logger.error(`Order not found: ${orderId}`);
        throw new Error(`Order not found: ${orderId}`);
      }

      this.logger.log(`Processing webhook status: ${status} for order ${orderId}`);


      switch (status) {
        case 'ACCEPTED':
          await this.handleAcceptedPayment(order, webhookData);
          break;

        case 'EXPIRED':
        case 'FAILED':
          await this.handleFailedPayment(order, webhookData);
          break;

        case 'PENDING':
        case 'PROCESSING':
          this.logger.log(`Status ${status} - no action needed for order ${orderId}`);
          break;

        default:
          this.logger.warn(`Unknown webhook status: ${status} for order ${orderId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process AmPay webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

    private async handleAcceptedPayment(order: any, webhookData: AmPayWebhookData): Promise<void> {
    this.logger.log(`Payment accepted for order ${order.id}`);


    await this.prisma.orderStatus.updateMany({
      where: { order_id: order.id },
      data: { is_current: false },
    });


    await this.prisma.orderStatus.create({
      data: {
        order_id: order.id,
        status: 'Payment Confirmed',
        notes: `AmPay Payment Confirmed\nSystem ID: ${webhookData.system_id}${webhookData.tracker_id ? `\nTracker ID: ${webhookData.tracker_id}` : ''}`,
        is_current: true,
        is_completed: true,
      },
    });


    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payment_status: 'paid',
        paid_at: new Date(),
        gateway_payment_id: webhookData.system_id,
        updated_at: new Date(),
      },
    });


    try {
      const items = order.items.map((item) => ({
        item_id: item.product_id?.toString() || item.sku || 'unknown',
        item_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
      }));

      await this.analyticsService.trackPaymentSuccess(
        order.id,
        order.total,
        order.currency || 'EUR',
        'Open Banking',
        items,
        order.ga_client_id,
        order.ip_address,
      );
    } catch (error) {
      this.logger.error(`Failed to send analytics for order ${order.id}:`, error.message);
    }


    try {
      await this.emailService.sendPaymentConfirmedEmail(order);
    } catch (error) {
      this.logger.error(`Failed to send payment confirmed email for order ${order.id}:`, error.message);
    }


    try {
      const message = `
💰 <b>Payment Confirmed - AmPay Open Banking</b>

📋 Order: <code>${order.id}</code>
💵 Amount: ${order.total} ${order.currency || 'EUR'}
🏦 Payment Method: Open Banking (AmPay)

👤 Customer: ${order.customer_first_name} ${order.customer_last_name}
📧 Email: ${order.customer_email}

🔑 AmPay System ID: <code>${webhookData.system_id}</code>
${webhookData.tracker_id ? `🎯 Tracker ID: <code>${webhookData.tracker_id}</code>` : ''}
      `.trim();

      await this.telegramService.sendMessage(message);
    } catch (error) {
      this.logger.error(`Failed to send Telegram notification for order ${order.id}:`, error.message);
    }

    this.logger.log(`Order ${order.id} marked as Payment Confirmed`);
  }

    private async handleFailedPayment(order: any, webhookData: AmPayWebhookData): Promise<void> {
    this.logger.log(`Payment ${webhookData.status.toLowerCase()} for order ${order.id}`);


    await this.prisma.orderStatus.updateMany({
      where: { order_id: order.id },
      data: { is_current: false },
    });


    await this.prisma.orderStatus.create({
      data: {
        order_id: order.id,
        status: 'Cancelled',
        notes: `AmPay: ${webhookData.status} - ${webhookData.error_message || 'Payment failed'}\nSystem ID: ${webhookData.system_id}`,
        is_current: true,
        is_completed: true,
      },
    });


    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payment_status: 'failed',
        gateway_payment_id: webhookData.system_id,
        notes: order.notes
          ? `${order.notes}\n\nAmPay: ${webhookData.status} - ${webhookData.error_message || 'Payment failed'}`
          : `AmPay: ${webhookData.status} - ${webhookData.error_message || 'Payment failed'}`,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Order ${order.id} marked as Cancelled`);
  }
}
