import { Injectable, OnModuleInit } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../prisma.service';
import { ORDER_STATUSES, ORDER_STATUS_DESCRIPTIONS_SHORT } from '../orders/order-statuses.constant';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;
  private chatId: string = process.env.TELEGRAM_CHAT_ID || '';
  private readonly token: string = process.env.TELEGRAM_BOT_TOKEN || '';

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    if (!this.token) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
      return;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling: true });
      this.setupCommands();
      this.setupCallbackHandlers();
      console.log('✅ Telegram Bot initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram Bot:', error);
    }
  }

  private setupCommands() {
    // Command: /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(
        chatId,
        `🤖 *LUX Store Bot*\n\n` +
          `Welcome! I can help you manage orders.\n\n` +
          `*Available commands:*\n` +
          `/orders - View recent orders\n` +
          `/order <ORDER_ID> - View specific order\n` +
          `/track <ORDER_ID> <TRACKING> - Add tracking number\n` +
          `/help - Show this message\n\n` +
          `Example:\n` +
          `\`/order LS000154435891\``,
        { parse_mode: 'Markdown' },
      );
    });

    // Command: /help
    this.bot.onText(/\/help/, (msg) => {
      this.bot.sendMessage(
        msg.chat.id,
        `🤖 *LUX Store Bot - Help*\n\n` +
          `*Commands:*\n` +
          `/start - Show welcome message\n` +
          `/orders - List recent orders\n` +
          `/order <ID> - View order details\n` +
          `/track <ID> <TRACKING> - Add tracking\n\n` +
          `*Examples:*\n` +
          `\`/orders\`\n` +
          `\`/order LS000154435891\`\n` +
          `\`/track LS000154435891 DHL123456789\``,
        { parse_mode: 'Markdown' },
      );
    });

    // Command: /orders - List recent orders
    this.bot.onText(/\/orders/, async (msg) => {
      const chatId = msg.chat.id;
      
      try {
        const orders = await this.prisma.order.findMany({
          take: 10,
          orderBy: { created_at: 'desc' },
          include: {
            statuses: {
              where: { is_current: true },
              take: 1,
            },
          },
        });

        if (orders.length === 0) {
          await this.bot.sendMessage(chatId, '📦 No orders found yet.');
          return;
        }

        let message = '📦 *Recent Orders:*\n\n';
        orders.forEach((order) => {
          const status = order.statuses[0]?.status || 'Order Placed';
          message += `🆔 \`${order.id}\`\n`;
          message += `💰 €${order.total.toFixed(2)}\n`;
          message += `📍 ${status}\n`;
          message += `📅 ${new Date(order.created_at).toLocaleDateString()}\n`;
          message += `─────────────\n`;
        });

        message += `\nUse \`/order <ORDER_ID>\` to view details`;

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error fetching orders:', error);
        await this.bot.sendMessage(chatId, '❌ Error fetching orders. Please try again.');
      }
    });

    // Command: /order <ORDER_ID>
    this.bot.onText(/\/order (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const orderId = match?.[1]?.trim();

      if (!orderId) {
        await this.bot.sendMessage(chatId, '❌ Please provide an order ID.\nExample: `/order LS000154435891`', {
          parse_mode: 'Markdown',
        });
        return;
      }

      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: true,
            statuses: {
              orderBy: { created_at: 'desc' },
            },
          },
        });

        if (!order) {
          await this.bot.sendMessage(chatId, `❌ Order *${orderId}* not found.`, { parse_mode: 'Markdown' });
          return;
        }

        await this.sendOrderDetails(chatId, order);
      } catch (error) {
        console.error('Error fetching order:', error);
        await this.bot.sendMessage(chatId, '❌ Error fetching order details.');
      }
    });

    // Command: /track <ORDER_ID> <TRACKING_NUMBER> <TRACKING_URL>
    this.bot.onText(/\/track\s+(\S+)\s+(\S+)(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const orderId = match?.[1]?.trim();
      const trackingNumber = match?.[2]?.trim();
      const trackingUrl = match?.[3]?.trim();

      if (!orderId || !trackingNumber) {
        await this.bot.sendMessage(
          chatId,
          '❌ Please provide order ID and tracking number.\n\n' +
            '*Examples:*\n' +
            '`/track LS000154435891 DHL123456789`\n' +
            '`/track LS000154435891 DHL123456789 https://track.dhl.com/123456789`',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      try {
        // Update order with tracking number and URL
        await this.prisma.order.update({
          where: { id: orderId },
          data: { 
            tracking_number: trackingNumber,
            tracking_url: trackingUrl || null,
          },
        });

        // Update status to Shipped
        await this.prisma.orderStatus.updateMany({
          where: { order_id: orderId },
          data: { is_current: false },
        });

        await this.prisma.orderStatus.create({
          data: {
            order_id: orderId,
            status: ORDER_STATUSES.SHIPPED,
            location: 'Warehouse',
            is_current: true,
            is_completed: true,
          },
        });

        let message = `✅ Tracking information added to order *${orderId}*\n\n` +
          `📦 Tracking: \`${trackingNumber}\`\n`;
        
        if (trackingUrl) {
          message += `🔗 Link: ${trackingUrl}\n`;
        }
        
        message += `\n📍 Status updated to: *Shipped*`;

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error adding tracking:', error);
        await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    });
  }

  private setupCallbackHandlers() {
    // Handle callback queries from inline buttons
    this.bot.on('callback_query', async (query) => {
      const data = query.data;
      const chatId = query.message?.chat.id;

      if (!data || !chatId) return;

      // Parse callback data: action_orderId_status
      const [action, orderId, ...rest] = data.split('_');

      try {
        if (action === 'status') {
          const newStatus = rest.join('_');
          
          // Update all statuses to not current
          await this.prisma.orderStatus.updateMany({
            where: { order_id: orderId },
            data: { is_current: false },
          });

          // Create new status
          await this.prisma.orderStatus.create({
            data: {
              order_id: orderId,
              status: newStatus,
              location: 'Updated via Telegram',
              is_current: true,
              is_completed: true,
            },
          });

          await this.bot.answerCallbackQuery(query.id, {
            text: `✅ Status updated to: ${newStatus}`,
          });

          // Refresh order details
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
              items: true,
              statuses: { orderBy: { created_at: 'desc' } },
            },
          });

          if (order) {
            await this.sendOrderDetails(chatId, order);
          }
        } else if (action === 'tracking') {
          await this.bot.answerCallbackQuery(query.id);
          await this.bot.sendMessage(
            chatId,
            `📦 *Add Tracking Information*\n\n` +
              `Use command:\n` +
              `\`/track ${orderId} TRACKING_NUMBER [TRACKING_URL]\`\n\n` +
              `*Examples:*\n` +
              `\`/track ${orderId} DHL123456789\`\n` +
              `\`/track ${orderId} DHL123456789 https://track.dhl.com/123456789\``,
            { parse_mode: 'Markdown' },
          );
        }
      } catch (error) {
        console.error('Error handling callback:', error);
        await this.bot.answerCallbackQuery(query.id, { text: '❌ Error' });
      }
    });
  }

  private async sendOrderDetails(chatId: number, order: any) {
    const currentStatus = order.statuses.find((s: any) => s.is_current);
    
    let message = `🛍️ *ORDER DETAILS*\n\n`;
    message += `🆔 Order ID: \`${order.id}\`\n`;
    message += `💰 Total: €${order.total.toFixed(2)}\n`;
    message += `📍 Status: *${currentStatus?.status || 'Order Placed'}*\n`;
    if (order.tracking_number) {
      message += `📦 Tracking: \`${order.tracking_number}\`\n`;
      if (order.tracking_url) {
        message += `🔗 Link: ${order.tracking_url}\n`;
      }
    }
    message += `\n`;
    
    message += `👤 *Customer:*\n`;
    message += `${order.customer_first_name} ${order.customer_last_name}\n`;
    message += `📧 ${order.customer_email}\n`;
    if (order.customer_phone) {
      message += `📱 ${order.customer_phone}\n`;
    }
    message += `\n`;
    
    message += `📮 *Shipping Address:*\n`;
    message += `${order.shipping_address_1}\n`;
    if (order.shipping_address_2) {
      message += `${order.shipping_address_2}\n`;
    }
    message += `${order.shipping_city}, ${order.shipping_postal_code}\n`;
    message += `${order.shipping_country}\n`;
    message += `\n`;
    
    message += `📦 *Items (${order.items.length}):*\n`;
    order.items.forEach((item: any) => {
      message += `• ${item.product_name}\n`;
      message += `  €${item.price.toFixed(2)} × ${item.quantity}\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Payment Confirmed', callback_data: `status_${order.id}_${ORDER_STATUSES.PAYMENT_CONFIRMED}` },
          { text: '👔 Concierge Review', callback_data: `status_${order.id}_${ORDER_STATUSES.UNDER_CONCIERGE_REVIEW}` },
        ],
        [
          { text: '� Logistics', callback_data: `status_${order.id}_${ORDER_STATUSES.PROCESSED_BY_LOGISTICS}` },
          { text: '📦 Warehouse', callback_data: `status_${order.id}_${ORDER_STATUSES.BEING_PREPARED_AT_WAREHOUSE}` },
        ],
        [
          { text: '� Preparing Dispatch', callback_data: `status_${order.id}_${ORDER_STATUSES.PREPARING_FOR_DISPATCH}` },
          { text: '✈️ Shipped', callback_data: `status_${order.id}_${ORDER_STATUSES.SHIPPED}` },
        ],
        [
          { text: '🎉 Delivered', callback_data: `status_${order.id}_${ORDER_STATUSES.DELIVERED}` },
          { text: '❌ Cancelled', callback_data: `status_${order.id}_${ORDER_STATUSES.CANCELLED}` },
        ],
        [
          { text: '📍 Add Tracking', callback_data: `tracking_${order.id}` },
        ],
      ],
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async sendOrderNotification(order: any) {
    if (!this.token || !this.chatId) {
      console.warn('Telegram bot not configured');
      return;
    }

    const currentStatus = order.statuses.find((s: any) => s.is_current);
    const itemsList = order.items
      .map(
        (item: any) =>
          `• ${item.product_name} (${item.brand || 'N/A'})\n  Qty: ${item.quantity} × €${item.price}`,
      )
      .join('\n');

    const message = `
🛍 <b>New Order Received</b>

📦 <b>Order ID:</b> <code>${order.id}</code>
💰 <b>Total:</b> €${order.total.toFixed(2)}

👤 <b>Customer:</b>
${order.customer_first_name} ${order.customer_last_name}
📧 ${order.customer_email}
📱 ${order.customer_phone}

📍 <b>Address:</b>
${order.shipping_address_1}
${order.shipping_address_2 ? order.shipping_address_2 + '\n' : ''}${order.shipping_city}, ${order.shipping_state || ''} ${order.shipping_postal_code}
${order.shipping_country}

🛒 <b>Items:</b>
${itemsList}

💳 <b>Payment:</b> ${order.payment_method}
📊 <b>Status:</b> ${currentStatus?.status || 'Order Placed'}

${order.promo_code ? `🎁 <b>Promo Code:</b> ${order.promo_code}\n` : ''}
${order.notes ? `📝 <b>Notes:</b> ${order.notes}\n` : ''}
� <b>System Info:</b>
${order.ip_address ? `🌐 IP: ${order.ip_address}` : '🌐 IP: N/A'}
${order.geo_city || order.geo_country ? `📍 Geo: ${order.geo_city ? order.geo_city + ', ' : ''}${order.geo_region ? order.geo_region + ', ' : ''}${order.geo_country || ''}` : '📍 Geo: N/A'}
🕐 ${new Date(order.created_at).toLocaleString('en-GB')}
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '✅ Payment Confirmed',
            callback_data: `status_${order.id}_${ORDER_STATUSES.PAYMENT_CONFIRMED}`,
          },
          {
            text: '👔 Concierge Review',
            callback_data: `status_${order.id}_${ORDER_STATUSES.UNDER_CONCIERGE_REVIEW}`,
          },
        ],
        [
          {
            text: '📋 Logistics',
            callback_data: `status_${order.id}_${ORDER_STATUSES.PROCESSED_BY_LOGISTICS}`,
          },
          {
            text: '📦 Warehouse',
            callback_data: `status_${order.id}_${ORDER_STATUSES.BEING_PREPARED_AT_WAREHOUSE}`,
          },
        ],
        [
          {
            text: '🚀 Preparing Dispatch',
            callback_data: `status_${order.id}_${ORDER_STATUSES.PREPARING_FOR_DISPATCH}`,
          },
          {
            text: '✈️ Shipped',
            callback_data: `status_${order.id}_${ORDER_STATUSES.SHIPPED}`,
          },
        ],
        [
          {
            text: '🎉 Delivered',
            callback_data: `status_${order.id}_${ORDER_STATUSES.DELIVERED}`,
          },
          {
            text: '❌ Cancelled',
            callback_data: `status_${order.id}_${ORDER_STATUSES.CANCELLED}`,
          },
        ],
        [
          {
            text: '📍 Add Tracking',
            callback_data: `tracking_${order.id}`,
          },
        ],
      ],
    };

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
    }
  }

  async updateOrderStatusMessage(orderId: string, status: string, location?: string) {
    if (!this.token || !this.chatId) return;

    const message = `
🔄 <b>Order Status Updated</b>

📦 <b>Order ID:</b> <code>${orderId}</code>
📊 <b>New Status:</b> ${status}
📍 <b>Location:</b> ${location || 'N/A'}
🕐 <b>Updated:</b> ${new Date().toLocaleString('en-GB')}
    `.trim();

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Failed to send status update:', error);
    }
  }

  async sendTrackingUpdate(orderId: string, trackingNumber: string, trackingUrl?: string, courier?: string) {
    if (!this.token || !this.chatId) return;

    let message = `
📍 <b>Tracking Information Added</b>

📦 <b>Order ID:</b> <code>${orderId}</code>
🔢 <b>Tracking Number:</b> <code>${trackingNumber}</code>`;

    if (trackingUrl) {
      message += `\n� <b>Link:</b> ${trackingUrl}`;
    }

    message += `\n�🚚 <b>Courier:</b> ${courier || 'N/A'}`;
    message += `\n🕐 <b>Updated:</b> ${new Date().toLocaleString('en-GB')}`;
    
    message = message.trim();

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Failed to send tracking update:', error);
    }
  }

  async sendMessage(message: string) {
    if (!this.token || !this.chatId) return;

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }
}
