import { Controller, Post, Body, Get, Logger, Param } from '@nestjs/common';
import { PlisioService } from './plisio.service';
import { PrismaService } from '../prisma.service';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('plisio')
export class PlisioController {
  private readonly logger = new Logger(PlisioController.name);

  constructor(
    private readonly plisioService: PlisioService,
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramImprovedService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post('create-invoice')
  async createInvoice(@Body() body: any) {
    try {
      const { orderId, cryptocurrency } = body;

      // Get order from database
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      // Create Plisio invoice
      const invoice = await this.plisioService.createInvoice({
        sourceAmount: order.total,
        orderNumber: orderId.replace('LS', ''), // Remove LS prefix
        currency: cryptocurrency,
        email: order.customer_email,
        orderName: orderId,
      });

      if (invoice.status === 'error' || !invoice.data) {
        return { success: false, message: 'Payment gateway temporarily unavailable' };
      }

      // Cast to the correct type
      const invoiceData = invoice.data as any;

      // Update order with crypto payment info
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          crypto_txn_id: invoiceData.txn_id,
          crypto_currency: invoiceData.currency,
          crypto_amount: invoiceData.invoice_total_sum,
          payment_method: `Crypto (${cryptocurrency})`,
        },
      });

      return {
        success: true,
        data: {
          txn_id: invoiceData.txn_id,
          invoice_url: invoiceData.invoice_url,
          wallet_hash: invoiceData.wallet_hash,
          amount: invoiceData.amount,
          qr_code: invoiceData.qr_code,
          invoice_commission: invoiceData.invoice_commission,
          invoice_sum: invoiceData.invoice_sum,
          invoice_total_sum: invoiceData.invoice_total_sum,
          currency: invoiceData.currency,
          expire_utc: invoiceData.expire_utc,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create invoice: ${error.message}`);
      return { success: false, message: 'Payment gateway temporarily unavailable' };
    }
  }

  @Post('callback')
  async handleCallback(@Body() body: any) {
    try {
      this.logger.log(`Received Plisio callback: ${JSON.stringify(body)}`);

      const {
        txn_id,
        order_name,
        status,
        amount,
        currency,
        confirmations,
        verify_hash,
        tx_urls,
        invoice_commission,
        invoice_sum,
        invoice_total_sum,
      } = body;

      // Verify hash
      if (!this.plisioService.verifyCallback(body, verify_hash)) {
        this.logger.error('Invalid callback hash');
        return { success: false };
      }

      // Find order by order_name (LS prefix ID)
      const order = await this.prisma.order.findFirst({
        where: { 
          OR: [
            { crypto_txn_id: txn_id },
            { id: order_name }
          ]
        },
        include: {
          items: true,
        },
      });

      if (!order) {
        this.logger.error(`Order not found for txn_id: ${txn_id}, order_name: ${order_name}`);
        return { success: false };
      }

      // Update order with transaction info
      const updateData: any = {
        payment_status: status,
      };

      if (tx_urls) {
        updateData.crypto_tx_urls = tx_urls;
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });

      // Handle different statuses
      if (status === 'new') {
        this.logger.log(`Invoice created for order ${order_name}`);
        // Just log, no action needed
      } else if (status === 'pending' || status === 'pending internal') {
        this.logger.log(`Payment pending for order ${order_name}, confirmations: ${confirmations || 0}`);
        
        // Notify about pending payment only on first confirmation
        if (confirmations === 1) {
          await this.telegramService.sendMessage(
            `💰 Crypto payment received!\n\n` +
            `Order: ${order_name}\n` +
            `Amount: ${amount} ${currency}\n` +
            `Confirmations: ${confirmations || 0}\n` +
            `Status: Waiting for confirmations`,
          );
        }
      } else if (status === 'completed' || status === 'paid') {
        this.logger.log(`Payment completed for order ${order_name}`);

        // Update payment status
        await this.prisma.order.update({
          where: { id: order.id },
          data: { 
            payment_status: 'paid',
            paid_at: new Date(),
          },
        });

        // Update order status to Payment Confirmed
        await this.prisma.orderStatus.updateMany({
          where: { order_id: order.id },
          data: { is_current: false },
        });

        await this.prisma.orderStatus.create({
          data: {
            order_id: order.id,
            status: 'Payment Confirmed',
            location: `${order.shipping_city}, ${order.shipping_country}`,
            is_current: true,
            is_completed: true,
          },
        });

        // Send Google Analytics event - payment success
        const items = order.items.map(item => ({
          id: item.sku || item.product_id.toString(),
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
        }));

        await this.analyticsService.trackPaymentSuccess(
          order.id,
          order.total,
          order.currency,
          order.payment_method,
          items,
          order.ga_client_id || undefined,
          order.ip_address || undefined,
        );

        // Send transaction URLs in Telegram
        const txUrlsText = tx_urls
          ? tx_urls.map((url: string, i: number) => `TX ${i + 1}: ${url}`).join('\n')
          : 'No transaction URLs';

        await this.telegramService.sendMessage(
          `✅ Crypto payment confirmed!\n\n` +
          `Order: ${order_name}\n` +
          `Amount: ${amount} ${currency}\n` +
          `Customer: ${order.customer_first_name} ${order.customer_last_name}\n` +
          `Email: ${order.customer_email}\n\n` +
          `Transaction URLs:\n${txUrlsText}`,
        );
      } else if (status === 'expired') {
        this.logger.log(`Invoice expired for order ${order_name}, amount received: ${amount}`);
        
        await this.prisma.order.update({
          where: { id: order.id },
          data: { payment_status: 'expired' },
        });

        // Update order status to Payment Expired
        await this.prisma.orderStatus.updateMany({
          where: { order_id: order.id },
          data: { is_current: false },
        });

        await this.prisma.orderStatus.create({
          data: {
            order_id: order.id,
            status: 'Payment Expired',
            location: `${order.shipping_city}, ${order.shipping_country}`,
            is_current: true,
            is_completed: false,
          },
        });

        // Notify about expired invoice
        await this.telegramService.sendMessage(
          `⏰ Invoice Expired\n\n` +
          `Order: ${order_name}\n` +
          `Customer: ${order.customer_first_name} ${order.customer_last_name}\n` +
          `Email: ${order.customer_email}\n` +
          (amount && parseFloat(amount) > 0 
            ? `⚠️ Partial payment received: ${amount} ${currency}\n` 
            : `No payment received\n`) +
          `Status: Expired - requires manual review`,
        );
      } else if (status === 'cancelled') {
        this.logger.log(`Payment cancelled for order ${order_name}`);
        
        await this.prisma.order.update({
          where: { id: order.id },
          data: { payment_status: 'cancelled' },
        });

        // Update order status to Payment Cancelled
        await this.prisma.orderStatus.updateMany({
          where: { order_id: order.id },
          data: { is_current: false },
        });

        await this.prisma.orderStatus.create({
          data: {
            order_id: order.id,
            status: 'Payment Cancelled',
            location: `${order.shipping_city}, ${order.shipping_country}`,
            is_current: true,
            is_completed: false,
          },
        });

        // Notify about cancelled payment
        await this.telegramService.sendMessage(
          `❌ Payment Cancelled\n\n` +
          `Order: ${order_name}\n` +
          `Customer: ${order.customer_first_name} ${order.customer_last_name}\n` +
          `Email: ${order.customer_email}\n` +
          `Reason: No payment within 10 hours\n` +
          `Status: Cancelled`,
        );
      } else if (status === 'error') {
        this.logger.error(`Payment error for order ${order_name}`);
        
        await this.prisma.order.update({
          where: { id: order.id },
          data: { payment_status: 'error' },
        });

        // Update order status to Payment Error
        await this.prisma.orderStatus.updateMany({
          where: { order_id: order.id },
          data: { is_current: false },
        });

        await this.prisma.orderStatus.create({
          data: {
            order_id: order.id,
            status: 'Payment Error',
            location: `${order.shipping_city}, ${order.shipping_country}`,
            is_current: true,
            is_completed: false,
          },
        });

        // Notify about payment error
        await this.telegramService.sendMessage(
          `⚠️ Payment Error\n\n` +
          `Order: ${order_name}\n` +
          `Customer: ${order.customer_first_name} ${order.customer_last_name}\n` +
          `Email: ${order.customer_email}\n` +
          `Amount: ${amount} ${currency}\n` +
          `Status: Error - requires immediate attention!`,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Callback error: ${error.message}`);
      return { success: false };
    }
  }

  @Get('cryptocurrencies')
  getSupportedCryptocurrencies() {
    return this.plisioService.getSupportedCryptocurrencies();
  }

  @Get('invoice/:txnId')
  async getInvoice(@Param('txnId') txnId: string) {
    try {
      const response = await this.plisioService.getInvoice(txnId);
      this.logger.debug(`Invoice response: ${JSON.stringify(response)}`);
      const apiResponse = response as any;
      if (apiResponse.status === 'error' || !apiResponse.data || !apiResponse.data.invoice) {
        return { success: false, message: 'Invoice not found' };
      }
      const invoice = apiResponse.data.invoice;
      // Найти заказ по txn_id
      const order = await this.prisma.order.findFirst({ where: { crypto_txn_id: txnId } });
      // Generate QR code URL using the wallet address
      const walletAddress = invoice.wallet_hash || invoice.qr_url;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(walletAddress)}`;
      
      // Get confirmations from transactions array
      let confirmations = 0;
      if (invoice.tx && Array.isArray(invoice.tx) && invoice.tx.length > 0) {
        // Get the maximum confirmations from all transactions
        confirmations = Math.max(...invoice.tx.map((t: any) => t.confirmations || 0));
      }
      
      return {
        txn_id: invoice.txn_id,
        invoice_url: invoice.invoice_url,
        wallet_hash: walletAddress,
        amount: invoice.amount,
        qr_code: qrCodeUrl,
        invoice_commission: invoice.invoice_commission,
        invoice_sum: invoice.invoice_sum,
        invoice_total_sum: invoice.invoice_total_sum,
        currency: invoice.currency,
        expire_utc: parseInt(invoice.expire_utc || invoice.expire_at_utc),
        status: invoice.status,
        confirmations: confirmations,
        expected_confirmations: invoice.expected_confirmations || 1,
        orderId: order?.id || null,
        accessToken: order?.access_token || null,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch invoice: ${error.message}`);
      return { success: false, message: 'Failed to fetch invoice' };
    }
  }
}
