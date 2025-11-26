import { Injectable, OnModuleInit } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmailService } from '../email/email.service';
import { ORDER_STATUSES, ORDER_STATUS_DESCRIPTIONS_SHORT, ORDER_STATUS_LABELS } from '../orders/order-statuses.constant';


enum BotState {
  IDLE = 'IDLE',
  WAITING_ORDER_ID = 'WAITING_ORDER_ID',
  WAITING_TRACKING_ORDER_ID = 'WAITING_TRACKING_ORDER_ID',
  WAITING_TRACKING_CODE = 'WAITING_TRACKING_CODE',
  WAITING_TRACKING_URL = 'WAITING_TRACKING_URL',
  WAITING_DELETE_ORDER_ID = 'WAITING_DELETE_ORDER_ID',
  WAITING_PROMO_DISCOUNT = 'WAITING_PROMO_DISCOUNT',
  WAITING_PROMO_MANAGER = 'WAITING_PROMO_MANAGER',
}


interface UserState {
  state: BotState;
  data?: any;
}

@Injectable()
export class TelegramImprovedService implements OnModuleInit {
  private bot: TelegramBot;
  private allowedChatIds: Set<string>;
  private allowedManagerChatIds: Set<string>;
  private readonly token: string = process.env.TELEGRAM_BOT_TOKEN || '';
  private userStates: Map<string, UserState> = new Map();

  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private emailService: EmailService,
  ) {
    const chatIds = process.env.TELEGRAM_CHAT_ID || '';
    this.allowedChatIds = new Set(
      chatIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
    );
    const managerChatIds = process.env.TELEGRAM_MANAGER_CHAT_ID || '';
    this.allowedManagerChatIds = new Set(
      managerChatIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
    );
  }

  onModuleInit() {
    if (!this.token) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
      return;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling: true });
      this.setupCommands();
      this.setupCallbackHandlers();
      this.setupMessageHandlers();
      console.log('✅ Telegram Bot initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram Bot:', error);
    }
  }


  private setState(chatId: string, state: BotState, data?: any) {
    this.userStates.set(chatId, { state, data });
  }


  private getState(chatId: string): UserState {
    return this.userStates.get(chatId) || { state: BotState.IDLE };
  }


  private resetState(chatId: string) {
    this.userStates.delete(chatId);
  }


  private checkAccess(chatId: string): boolean {
    return this.allowedChatIds.has(chatId);
  }

  private checkManagerAccess(chatId: string): boolean {
    return this.allowedManagerChatIds.has(chatId);
  }

  private isAdmin(chatId: string): boolean {
    return this.allowedChatIds.has(chatId);
  }

  private setupCommands() {

    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      
      if (!this.checkAccess(chatId)) {
        this.bot.sendMessage(
          chatId,
          '🚫 *Access Denied*\n\nYour chat ID: `' + chatId + '`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      this.resetState(chatId);
      await this.showMainMenu(chatId);
    });
  }

  private async showMainMenu(chatId: string) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '📦 Orders', callback_data: 'menu_orders' }],
        [{ text: '🎟️ Promo Codes', callback_data: 'menu_promo' }],
        [{ text: '📊 Statistics', callback_data: 'menu_stats' }],
        [{ text: 'ℹ️ Help', callback_data: 'menu_help' }],
      ],
    };

    await this.bot.sendMessage(
      chatId,
      `🤖 *LUX Store Bot*\n\nSelect an option:`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    );
  }

  private setupCallbackHandlers() {
    this.bot.on('callback_query', async (query) => {
      if (!query.message || !query.data) return;
      
      const chatId = query.message.chat.id.toString();
      const data = query.data;

      if (!this.checkAccess(chatId) && !this.checkManagerAccess(chatId)) return;

      const isManagerOnly = this.checkManagerAccess(chatId) && !this.isAdmin(chatId);
      
      if (isManagerOnly && !data.startsWith('view_order_')) {
        await this.bot.sendMessage(chatId, '🚫 Access Denied. Managers can only view orders.');
        await this.bot.answerCallbackQuery(query.id);
        return;
      }

      try {

        if (data === 'menu_orders') {
          await this.showOrdersMenu(chatId);
        } else if (data === 'menu_promo') {
          await this.showPromoMenu(chatId);
        } else if (data === 'menu_stats') {
          await this.showStatistics(chatId);
        } else if (data === 'menu_help') {
          await this.showHelp(chatId);
        }
        

        else if (data === 'orders_view') {
          await this.bot.sendMessage(chatId, '📝 Please enter Order ID:');
          this.setState(chatId, BotState.WAITING_ORDER_ID);
        } else if (data === 'orders_add_track') {
          await this.bot.sendMessage(chatId, '📝 Please enter Order ID:');
          this.setState(chatId, BotState.WAITING_TRACKING_ORDER_ID);
        } else if (data === 'orders_delete') {
          await this.bot.sendMessage(chatId, '⚠️ Please enter Order ID to delete:');
          this.setState(chatId, BotState.WAITING_DELETE_ORDER_ID);
        } else if (data === 'orders_list') {
          await this.showRecentOrders(chatId);
        }
        

        else if (data === 'promo_create') {
          await this.bot.sendMessage(chatId, '📝 Enter discount percentage (e.g., 10 for 10%):');
          this.setState(chatId, BotState.WAITING_PROMO_DISCOUNT);
        } else if (data === 'promo_active') {
          await this.showActivePromoCodes(chatId);
        } else if (data === 'promo_delete') {
          await this.showPromoDeleteMenu(chatId);
        }
        

        else if (data.startsWith('status_')) {
          await this.handleStatusChange(chatId, data);
        }
        

        else if (data.startsWith('view_order_')) {
          const orderId = data.replace('view_order_', '');
          if (isManagerOnly) {
            await this.showOrderDetailsForManager(chatId, orderId);
          } else {
            await this.showOrderDetails(chatId, orderId);
          }
        }
        

        else if (data.startsWith('delete_promo_')) {
          const promoId = data.replace('delete_promo_', '');
          await this.showPromoDeleteConfirm(chatId, promoId);
        } else if (data.startsWith('confirm_delete_promo_')) {
          const promoId = data.replace('confirm_delete_promo_', '');
          await this.deletePromoCode(chatId, promoId);
        }
        

        else if (data.startsWith('confirm_delete_order_')) {
          const orderId = data.replace('confirm_delete_order_', '');
          await this.deleteOrder(chatId, orderId);
        } else if (data.startsWith('confirm_delete_')) {
          const orderId = data.replace('confirm_delete_', '');
          await this.showOrderDeleteConfirm(chatId, orderId);
        } else if (data.startsWith('cancel_delete_')) {
          const orderId = data.replace('cancel_delete_', '');
          await this.showOrderDetails(chatId, orderId);
        }
        

        else if (data === 'back_main') {
          await this.showMainMenu(chatId);
        } else if (data === 'back_orders') {
          await this.showOrdersMenu(chatId);
        } else if (data === 'back_promo') {
          await this.showPromoMenu(chatId);
        }

        await this.bot.answerCallbackQuery(query.id);
      } catch (error) {
        console.error('Callback handler error:', error);
        await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
      }
    });
  }

  private setupMessageHandlers() {
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id.toString();
      const text = msg.text;

      if (!this.checkAccess(chatId)) return;
      if (!text || text.startsWith('/')) return; // Ignore commands

      const userState = this.getState(chatId);

      try {
        switch (userState.state) {
          case BotState.WAITING_ORDER_ID:
            await this.showOrderDetails(chatId, text.trim());
            this.resetState(chatId);
            break;

          case BotState.WAITING_TRACKING_ORDER_ID:
            this.setState(chatId, BotState.WAITING_TRACKING_CODE, { orderId: text.trim() });
            await this.bot.sendMessage(chatId, '📝 Enter tracking code (номер отслеживания):');
            break;

          case BotState.WAITING_TRACKING_CODE:
            this.setState(chatId, BotState.WAITING_TRACKING_URL, { 
              orderId: userState.data.orderId,
              trackingCode: text.trim()
            });
            await this.bot.sendMessage(chatId, '📝 Now enter tracking URL:');
            break;

          case BotState.WAITING_TRACKING_URL:
            await this.addTracking(
              chatId, 
              userState.data.orderId, 
              userState.data.trackingCode,
              text.trim()
            );
            this.resetState(chatId);
            break;

          case BotState.WAITING_DELETE_ORDER_ID:
            await this.confirmDeleteOrder(chatId, text.trim());
            this.resetState(chatId);
            break;

          case BotState.WAITING_PROMO_DISCOUNT:
            const discount = parseFloat(text.trim());
            if (isNaN(discount) || discount <= 0 || discount > 100) {
              await this.bot.sendMessage(chatId, '❌ Invalid discount. Please enter a number between 1 and 100:');
              return;
            }
            this.setState(chatId, BotState.WAITING_PROMO_MANAGER, { discount });
            await this.bot.sendMessage(chatId, '📝 Enter manager name:');
            break;

          case BotState.WAITING_PROMO_MANAGER:
            await this.createPromoCode(chatId, userState.data.discount, text.trim());
            this.resetState(chatId);
            break;
        }
      } catch (error) {
        console.error('Message handler error:', error);
        await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        this.resetState(chatId);
      }
    });
  }


  private async showOrdersMenu(chatId: string) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '📋 View Order', callback_data: 'orders_view' }],
        [{ text: '📦 Recent Orders', callback_data: 'orders_list' }],
        [{ text: '🚚 Add Tracking', callback_data: 'orders_add_track' }],
        [{ text: '🗑️ Delete Order', callback_data: 'orders_delete' }],
        [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }],
      ],
    };

    await this.bot.sendMessage(
      chatId,
      '📦 *Orders Management*\n\nSelect an action:',
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  private async showRecentOrders(chatId: string) {
    const orders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        total: true,
        created_at: true,
        statuses: {
          where: { is_current: true },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    });

    if (orders.length === 0) {
      await this.bot.sendMessage(chatId, '📭 No orders found.');
      return;
    }

    const buttons = orders.map(order => {
      const date = order.created_at.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      });
      const status = order.statuses[0]?.status || 'N/A';

      const shortId = order.id.length > 6 
        ? `LS...${order.id.slice(-4)}` 
        : order.id;
      
      return [{
        text: `${date} - ${shortId} - €${order.total.toFixed(2)} - ${status}`,
        callback_data: `view_order_${order.id}`,
      }];
    });

    buttons.push([{ text: '🔙 Back', callback_data: 'back_orders' }]);

    await this.bot.sendMessage(
      chatId,
      '📦 *Recent Orders*\n\nClick to view details:',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      }
    );
  }

  private async showOrderDetailsForManager(chatId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statuses: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      await this.bot.sendMessage(chatId, `❌ Order ${orderId} not found.`);
      return;
    }

    let promoCodeInfo: { manager_name: string; discount: number } | null = null;
    if (order.promo_code) {
      promoCodeInfo = await this.prisma.promoCode.findUnique({
        where: { code: order.promo_code },
        select: { manager_name: true, discount: true },
      });
    }

    const itemsWithSlugs = await Promise.all(
      order.items.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.product_id },
          select: { slug_without_id: true },
        });
        return {
          ...item,
          slug_without_id: product?.slug_without_id || null,
        };
      })
    );

    const currentStatus = order.statuses[0];
    
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
    
    const itemsList = itemsWithSlugs
      .map((item, i) => {
        let itemText = `${i + 1}. ${escapeHtml(item.product_name)} x${item.quantity} - €${item.price}`;
        if (item.slug_without_id) {
          itemText += ` | <a href="https://lux-store.eu/products/${escapeHtml(item.slug_without_id)}">Link</a>`;
        }
        return itemText;
      })
      .join('\n');

    const orderDate = order.created_at.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const paidDate = order.paid_at ? order.paid_at.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : null;

    let message = `📦 <b>Order Details</b>\n\n`;
    message += `🆔 <b>Order ID:</b> <code>${order.id}</code>\n`;
    message += `📅 <b>Created:</b> ${orderDate}\n`;
    message += `🔘 <b>Status:</b> ${currentStatus?.status || 'N/A'}\n\n`;
    
    message += `👤 <b>Customer Information</b>\n`;
    message += `   Name: ${escapeHtml(order.customer_first_name)} ${escapeHtml(order.customer_last_name)}\n`;
    
    message += `\n💳 <b>Payment</b>\n`;
    message += `   Method: ${escapeHtml(order.payment_method)}\n`;
    message += `   Status: ${order.payment_status}\n`;
    if (paidDate) {
      message += `   Paid at: ${paidDate}\n`;
    }
    if (order.promo_code) {
      message += `   Promo: ${escapeHtml(order.promo_code)}\n`;
    }
    
    message += `\n💰 <b>Pricing</b>\n`;
    message += `   Subtotal: €${order.subtotal.toFixed(2)}\n`;
    if (order.discount > 0) {
      let discountText = `   Discount: -€${order.discount.toFixed(2)}`;
      if (promoCodeInfo?.manager_name) {
        discountText += ` (${escapeHtml(promoCodeInfo.manager_name)})`;
      }
      message += `${discountText}\n`;
    }
    message += `   Shipping: €${order.shipping.toFixed(2)}\n`;
    message += `   <b>Total: €${order.total.toFixed(2)}</b>\n`;
    
    if (order.tracking_number || order.tracking_url) {
      message += `\n🚚 <b>Tracking</b>\n`;
      if (order.tracking_number) {
        message += `   Code: <code>${order.tracking_number}</code>\n`;
      }
      if (order.courier) {
        message += `   Courier: ${escapeHtml(order.courier)}\n`;
      }
      if (order.tracking_url) {
        message += `   URL: ${order.tracking_url}\n`;
      }
    }
    
    message += `\n🛒 <b>Items</b>\n${itemsList}`;

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }

  private async showOrderDetails(chatId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statuses: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      await this.bot.sendMessage(chatId, `❌ Order ${orderId} not found.`);
      return;
    }

    let promoCodeInfo: { manager_name: string; discount: number } | null = null;
    if (order.promo_code) {
      promoCodeInfo = await this.prisma.promoCode.findUnique({
        where: { code: order.promo_code },
        select: { manager_name: true, discount: true },
      });
    }

    const itemsWithSlugs = await Promise.all(
      order.items.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.product_id },
          select: { slug_without_id: true },
        });
        return {
          ...item,
          slug_without_id: product?.slug_without_id || null,
        };
      })
    );

    const currentStatus = order.statuses[0];
    
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
    
    const itemsList = itemsWithSlugs
      .map((item, i) => {
        let itemText = `${i + 1}. ${escapeHtml(item.product_name)} x${item.quantity} - €${item.price}`;
        if (item.slug_without_id) {
          itemText += ` | <a href="https://lux-store.eu/products/${escapeHtml(item.slug_without_id)}">Link</a>`;
        }
        return itemText;
      })
      .join('\n');


    const orderDate = order.created_at.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const paidDate = order.paid_at ? order.paid_at.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : null;

    let message = `📦 <b>Order Details</b>\n\n`;
    message += `🆔 <b>Order ID:</b> <code>${order.id}</code>\n`;
    message += `📅 <b>Created:</b> ${orderDate}\n`;
    message += `🔘 <b>Status:</b> ${currentStatus?.status || 'N/A'}\n\n`;
    

    message += `👤 <b>Customer Information</b>\n`;
    message += `   Name: ${escapeHtml(order.customer_first_name)} ${escapeHtml(order.customer_last_name)}\n`;
    message += `   Email: ${escapeHtml(order.customer_email)}\n`;
    message += `   Phone: ${escapeHtml(order.customer_phone)}\n`;
    if (order.ip_address) {
      message += `   IP: ${order.ip_address}\n`;
    }
    if (order.geo_country) {
      message += `   Country: ${escapeHtml(order.geo_country)}\n`;
    }
    

    message += `\n📦 <b>Shipping Address</b>\n`;
    message += `   Address 1: ${escapeHtml(order.shipping_address_1)}\n`;
    if (order.shipping_address_2) {
      message += `   Address 2: ${escapeHtml(order.shipping_address_2)}\n`;
    }
    message += `   City: ${escapeHtml(order.shipping_city)}\n`;
    message += `   Postal Code: ${order.shipping_postal_code}\n`;
    if (order.shipping_state) {
      message += `   State: ${escapeHtml(order.shipping_state)}\n`;
    }
    message += `   Country: ${escapeHtml(order.shipping_country)}\n`;
    

    message += `\n💳 <b>Payment</b>\n`;
    message += `   Method: ${escapeHtml(order.payment_method)}\n`;
    message += `   Status: ${order.payment_status}\n`;
    if (paidDate) {
      message += `   Paid at: ${paidDate}\n`;
    }
    if (order.promo_code) {
      message += `   Promo: ${escapeHtml(order.promo_code)}\n`;
    }
    

    message += `\n💰 <b>Pricing</b>\n`;
    message += `   Subtotal: €${order.subtotal.toFixed(2)}\n`;
    if (order.discount > 0) {
      let discountText = `   Discount: -€${order.discount.toFixed(2)}`;
      if (promoCodeInfo?.manager_name) {
        discountText += ` (${escapeHtml(promoCodeInfo.manager_name)})`;
      }
      message += `${discountText}\n`;
    }
    message += `   Shipping: €${order.shipping.toFixed(2)}\n`;
    message += `   <b>Total: €${order.total.toFixed(2)}</b>\n`;
    

    if (order.tracking_number || order.tracking_url) {
      message += `\n🚚 <b>Tracking</b>\n`;
      if (order.tracking_number) {
        message += `   Code: <code>${order.tracking_number}</code>\n`;
      }
      if (order.courier) {
        message += `   Courier: ${escapeHtml(order.courier)}\n`;
      }
      if (order.tracking_url) {
        message += `   URL: ${order.tracking_url}\n`;
      }
    }
    

    message += `\n🛒 <b>Items</b>\n${itemsList}`;
    
    if (order.utm_source || order.utm_medium || order.utm_campaign || order.utm_term || order.utm_content) {
      message += `\n\n📊 <b>UTM Tracking</b>\n`;
      if (order.utm_source) message += `   Source: ${escapeHtml(order.utm_source)}\n`;
      if (order.utm_medium) message += `   Medium: ${escapeHtml(order.utm_medium)}\n`;
      if (order.utm_campaign) message += `   Campaign: ${escapeHtml(order.utm_campaign)}\n`;
      if (order.utm_term) message += `   Term: ${escapeHtml(order.utm_term)}\n`;
      if (order.utm_content) message += `   Content: ${escapeHtml(order.utm_content)}\n`;
    }

    if (order.notes) {
      message += `\n\n📝 <b>Notes:</b> ${escapeHtml(order.notes)}`;
    }



    const currentStatusKey = Object.entries(ORDER_STATUSES)
      .find(([_, value]) => value === currentStatus?.status)?.[0];
    
    const statusButtons: any[][] = Object.entries(ORDER_STATUSES)
      .filter(([key]) => key !== currentStatusKey)
      .map(([key, value]) => ([{
        text: value,
        callback_data: `status_${orderId}_${key}`,
      }]));


    statusButtons.push([
      { text: '🗑️ Delete Order', callback_data: `confirm_delete_${orderId}` },
      { text: '🔙 Back to Orders', callback_data: 'back_orders' }
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: statusButtons },
    });
  }

  private async handleStatusChange(chatId: string, data: string) {

    console.log('[handleStatusChange] Raw callback data:', data);
    

    let statusKey: string | undefined;
    let orderId: string | undefined;
    
    for (const key of Object.keys(ORDER_STATUSES)) {
      if (data.endsWith(`_${key}`)) {
        statusKey = key;

        orderId = data.substring(7, data.length - key.length - 1);
        break;
      }
    }
    
    console.log('[handleStatusChange] Parsed - orderId:', orderId, 'statusKey:', statusKey);
    
    if (!statusKey || !orderId) {
      await this.bot.sendMessage(chatId, `❌ Invalid callback data format.`);
      return;
    }
    
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        await this.bot.sendMessage(chatId, `❌ Order not found.`);
        return;
      }


      const statusFullName = ORDER_STATUSES[statusKey];
      
      if (!statusFullName) {
        await this.bot.sendMessage(chatId, `❌ Invalid status key: ${statusKey}`);
        return;
      }


      const previousStatus = await this.prisma.orderStatus.findFirst({
        where: { order_id: orderId, is_current: true },
      });

      await this.prisma.orderStatus.updateMany({
        where: { order_id: orderId, is_current: true },
        data: { is_current: false },
      });

      await this.prisma.orderStatus.create({
        data: {
          order_id: orderId,
          status: statusFullName, // Сохраняем полное название
          is_current: true,
          is_completed: false,
          gclid: previousStatus?.gclid,
          hashed_email: previousStatus?.hashed_email,
          hashed_phone_number: previousStatus?.hashed_phone_number,
          conversion_value: previousStatus?.conversion_value || order.total,
          currency_code: 'EUR',
          user_agent: previousStatus?.user_agent,
          ip_address: previousStatus?.ip_address || order.ip_address,
        },
      });


      if (statusFullName === ORDER_STATUSES.PAYMENT_CONFIRMED) {
        try {

          await this.prisma.order.update({
            where: { id: orderId },
            data: {
              payment_status: 'paid',
              paid_at: new Date(),
            },
          });


          const orderWithItems = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });

          if (orderWithItems) {
            const items = orderWithItems.items.map((item) => ({
              id: item.product_id?.toString() || item.sku || 'unknown',
              name: item.product_name,
              quantity: item.quantity,
              price: item.price,
            }));


            await this.analyticsService.trackPaymentSuccess(
              orderWithItems.id,
              orderWithItems.total,
              orderWithItems.currency || 'EUR',
              orderWithItems.payment_method || 'Manual',
              items,
              orderWithItems.ga_client_id || undefined,
              orderWithItems.ip_address || undefined,
            );

            console.log(`✅ Analytics sent for order ${orderId} (manual Payment Confirmed)`);


            try {
              await this.emailService.sendPaymentConfirmedEmail(orderWithItems);
              console.log(`✅ Email sent for order ${orderId} (manual Payment Confirmed)`);
            } catch (error) {
              console.error(`Failed to send email for order ${orderId}:`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to send analytics for order ${orderId}:`, error);
        }
      }


      const statusesWithEmails = [
        ORDER_STATUSES.UNDER_REVIEW,
        ORDER_STATUSES.BEING_PREPARED,
        ORDER_STATUSES.SCHEDULED_FOR_DISPATCH,
        ORDER_STATUSES.ON_ITS_WAY,
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.CLOSED,
      ];

      if (statusesWithEmails.includes(statusFullName)) {
        try {

          const orderWithItems = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });

          if (orderWithItems) {

            try {
              switch (statusFullName) {
                case ORDER_STATUSES.UNDER_REVIEW:
                  await this.emailService.sendUnderReviewEmail(orderWithItems);
                  console.log(`✅ Under Review email sent for order ${orderId}`);
                  break;
                case ORDER_STATUSES.BEING_PREPARED:
                  await this.emailService.sendBeingPreparedEmail(orderWithItems);
                  console.log(`✅ Being Prepared email sent for order ${orderId}`);
                  break;
                case ORDER_STATUSES.SCHEDULED_FOR_DISPATCH:
                  await this.emailService.sendScheduledForDispatchEmail(orderWithItems);
                  console.log(`✅ Scheduled for Dispatch email sent for order ${orderId}`);
                  break;
                case ORDER_STATUSES.ON_ITS_WAY:
                  await this.emailService.sendOnItsWayEmail(orderWithItems);
                  console.log(`✅ On Its Way email sent for order ${orderId}`);
                  break;
                case ORDER_STATUSES.DELIVERED:
                  await this.emailService.sendDeliveredEmail(orderWithItems);
                  console.log(`✅ Delivered email sent for order ${orderId}`);
                  break;
                case ORDER_STATUSES.CLOSED:
                  await this.emailService.sendOrderClosedEmail(orderWithItems);
                  console.log(`✅ Order Closed email sent for order ${orderId}`);
                  break;
              }
            } catch (error) {
              console.error(`Failed to send ${statusFullName} email for order ${orderId}:`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch order for ${statusFullName} email ${orderId}:`, error);
        }
      }

      await this.bot.sendMessage(
        chatId,
        `✅ Status updated to: *${statusFullName}*\n📧 Email notification sent to customer.`,
        { parse_mode: 'Markdown' }
      );


      await this.showOrderDetails(chatId, orderId);
    } catch (error) {
      console.error('Status change error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to update status.`);
    }
  }

  private async addTracking(chatId: string, orderId: string, trackingCode: string, trackingUrl: string) {
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { 
          tracking_number: trackingCode,
          tracking_url: trackingUrl 
        },
      });

      await this.bot.sendMessage(
        chatId,
        `✅ Tracking added to order <code>${orderId}</code>\n🆔 Code: <code>${trackingCode}</code>\n🚚 URL: ${trackingUrl}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Add tracking error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to add tracking. Order not found.`);
    }
  }

  private async confirmDeleteOrder(chatId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      await this.bot.sendMessage(chatId, `❌ Order ${orderId} not found.`);
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ YES, Delete', callback_data: `confirm_delete_order_${orderId}` },
          { text: '❌ NO, Cancel', callback_data: 'back_orders' },
        ],
      ],
    };

    await this.bot.sendMessage(
      chatId,
      `⚠️ *Confirm Delete*\n\nAre you sure you want to delete order \`${orderId}\`?\n\nThis action cannot be undone!`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  private async showOrderDeleteConfirm(chatId: string, orderId: string) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Yes, Delete', callback_data: `confirm_delete_order_${orderId}` },
          { text: '❌ Cancel', callback_data: `cancel_delete_${orderId}` }
        ]
      ]
    };

    await this.bot.sendMessage(
      chatId,
      `⚠️ *Confirm Delete*\n\nAre you sure you want to delete order \`${orderId}\`?\n\nThis action cannot be undone!`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  private async deleteOrder(chatId: string, orderId: string) {
    try {
      await this.prisma.order.delete({
        where: { id: orderId },
      });

      await this.bot.sendMessage(chatId, `✅ Order \`${orderId}\` deleted successfully.`, {
        parse_mode: 'Markdown',
      });
      
      await this.showOrdersMenu(chatId);
    } catch (error) {
      console.error('Delete order error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to delete order.`);
    }
  }


  private async showPromoMenu(chatId: string) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '➕ Create Promo Code', callback_data: 'promo_create' }],
        [{ text: '📋 Active Codes', callback_data: 'promo_active' }],
        [{ text: '🗑️ Delete Code', callback_data: 'promo_delete' }],
        [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }],
      ],
    };

    await this.bot.sendMessage(
      chatId,
      '🎟️ *Promo Codes Management*\n\nSelect an action:',
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  private async createPromoCode(chatId: string, discount: number, managerName: string) {
    try {

      const randomNum = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      const code = `LUX${randomNum}`;

      const username = this.allowedChatIds.values().next().value; // Get first admin

      const promoCode = await this.prisma.promoCode.create({
        data: {
          code,
          discount,
          manager_name: managerName,
          created_by: username,
        },
      });

      await this.bot.sendMessage(
        chatId,
        `✅ *Promo Code Created!*\n\n` +
          `🎟️ Code: \`${code}\`\n` +
          `💰 Discount: ${discount}%\n` +
          `👤 Manager: ${managerName}\n\n` +
          `The code is now active and ready to use.`,
        { parse_mode: 'Markdown' }
      );

      await this.showPromoMenu(chatId);
    } catch (error) {
      console.error('Create promo error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to create promo code.`);
    }
  }

  private async showActivePromoCodes(chatId: string) {
    const promoCodes = await this.prisma.promoCode.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });

    if (promoCodes.length === 0) {
      await this.bot.sendMessage(chatId, '📭 No active promo codes found.');
      return;
    }

    let message = '🎟️ *Active Promo Codes*\n\n';
    promoCodes.forEach((promo, i) => {
      message += `${i + 1}. \`${promo.code}\`\n`;
      message += `   💰 Discount: ${promo.discount}%\n`;
      message += `   👤 Manager: ${promo.manager_name}\n`;
      message += `   📊 Used: ${promo.used_count} times\n`;
      message += `   📅 Created: ${promo.created_at.toLocaleDateString()}\n\n`;
    });

    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_promo' }]],
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async showPromoDeleteMenu(chatId: string) {
    const promoCodes = await this.prisma.promoCode.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    if (promoCodes.length === 0) {
      await this.bot.sendMessage(chatId, '📭 No active promo codes to delete.');
      return;
    }

    const buttons = promoCodes.map(promo => ([{
      text: `${promo.code} (${promo.discount}%)`,
      callback_data: `delete_promo_${promo.id}`,
    }]));

    buttons.push([{ text: '🔙 Back', callback_data: 'back_promo' }]);

    await this.bot.sendMessage(
      chatId,
      '🗑️ *Delete Promo Code*\n\nSelect code to delete:',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      }
    );
  }

  private async showPromoDeleteConfirm(chatId: string, promoId: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id: promoId },
    });

    if (!promo) {
      await this.bot.sendMessage(chatId, `❌ Promo code not found.`);
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ YES, Delete', callback_data: `confirm_delete_promo_${promoId}` },
          { text: '❌ NO, Cancel', callback_data: 'back_promo' },
        ],
      ],
    };

    await this.bot.sendMessage(
      chatId,
      `⚠️ *Confirm Delete*\n\n` +
        `Are you sure you want to delete promo code:\n` +
        `🎟️ \`${promo.code}\` (${promo.discount}%)\n\n` +
        `This action cannot be undone!`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  private async deletePromoCode(chatId: string, promoId: string) {
    try {
      const promo = await this.prisma.promoCode.delete({
        where: { id: promoId },
      });

      await this.bot.sendMessage(
        chatId,
        `✅ Promo code \`${promo.code}\` deleted successfully.`,
        { parse_mode: 'Markdown' }
      );

      await this.showPromoMenu(chatId);
    } catch (error) {
      console.error('Delete promo error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to delete promo code.`);
    }
  }


  private async showStatistics(chatId: string) {
    const totalOrders = await this.prisma.order.count();
    const todayOrders = await this.prisma.order.count({
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const totalRevenue = await this.prisma.order.aggregate({
      _sum: { total: true },
    });

    const activeCodes = await this.prisma.promoCode.count({
      where: { is_active: true },
    });

    let message = `📊 *Statistics*\n\n`;
    message += `📦 Total Orders: ${totalOrders}\n`;
    message += `📅 Today's Orders: ${todayOrders}\n`;
    message += `💰 Total Revenue: €${(totalRevenue._sum.total || 0).toLocaleString()}\n`;
    message += `🎟️ Active Promo Codes: ${activeCodes}\n`;

    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]],
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }


  private async showHelp(chatId: string) {
    const message = `ℹ️ *Help*\n\n` +
      `*Orders Management:*\n` +
      `• View Order - See order details\n` +
      `• Recent Orders - List of latest orders\n` +
      `• Add Tracking - Add DHL tracking URL\n` +
      `• Delete Order - Remove order from system\n\n` +
      `*Promo Codes:*\n` +
      `• Create Code - Generate new promo code\n` +
      `• Active Codes - View all active codes\n` +
      `• Delete Code - Remove promo code\n\n` +
      `*Statistics:*\n` +
      `• View orders and revenue stats\n\n` +
      `Use the menu buttons to navigate.`;

    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]],
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }


  async sendOrderNotification(orderId: string) {
    if (!this.bot || this.allowedChatIds.size === 0) return;

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customer_email: true,
          customer_first_name: true,
          customer_last_name: true,
          total: true,
          subtotal: true,
          discount: true,
          promo_code: true,
          ip_address: true,
          geo_country: true,
          created_at: true,
          payment_method: true,
          sepa_payment_proof: true,
          utm_campaign: true,
          utm_medium: true,
          utm_source: true,
          utm_term: true,
          utm_content: true,
          ga_client_id: true,
          items: {
            select: {
              product_name: true,
              quantity: true,
            },
          },
          statuses: {
            where: { is_current: true },
            take: 1,
            select: {
              status: true,
            },
          },
        },
      });

      if (!order) return;


      let promoCodeInfo: { manager_name: string; discount: number } | null = null;
      if (order.promo_code) {
        promoCodeInfo = await this.prisma.promoCode.findUnique({
          where: { code: order.promo_code },
          select: { manager_name: true, discount: true },
        });
      }

      const currentStatus = order.statuses[0];
      const itemsList = order.items
        .map((item) => `${item.product_name} x${item.quantity}`)
        .join(', ');


      const orderDate = order.created_at.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const orderTime = order.created_at.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });

      let message = `─────────────\n`;
      message += `⏳ ${order.id}\n`;
      message += `💰 €${order.total.toFixed(2)} • ${currentStatus?.status || 'N/A'}\n`;
      message += `🔘 ${orderDate}\n`;
      message += `─────────────\n\n`;
      message += `*Date & Time:* ${orderDate} ${orderTime}\n`;
      message += `*Status:* ${currentStatus?.status || 'N/A'}\n`;
      message += `*Customer:* ${order.customer_first_name} ${order.customer_last_name}\n`;
      message += `*Email:* ${order.customer_email}\n`;
      message += `*Items:* ${itemsList}\n`;
      

      if (order.discount > 0) {
        message += `*Subtotal:* €${order.subtotal.toFixed(2)}\n`;
        let discountText = `*Discount:* -€${order.discount.toFixed(2)}`;
        if (promoCodeInfo?.manager_name) {
          discountText += ` (${promoCodeInfo.manager_name})`;
        }
        message += `${discountText}\n`;
        message += `*Total:* €${order.total.toFixed(2)}\n`;
      }
      
      message += `*IP:* ${order.ip_address || 'N/A'}\n`;
      message += `*Country:* ${order.geo_country || 'N/A'}`;

      if (order.utm_source || order.utm_medium || order.utm_campaign || order.utm_term || order.utm_content) {
        message += `\n\n*📊 UTM Tracking*\n`;
        if (order.utm_source) message += `*Source:* ${order.utm_source}\n`;
        if (order.utm_medium) message += `*Medium:* ${order.utm_medium}\n`;
        if (order.utm_campaign) message += `*Campaign:* ${order.utm_campaign}\n`;
        if (order.utm_term) message += `*Term:* ${order.utm_term}\n`;
        if (order.utm_content) message += `*Content:* ${order.utm_content}`;
      }

      const keyboard = {
        inline_keyboard: [[{ text: '👁️ View Order', callback_data: `view_order_${orderId}` }]],
      };

      for (const chatId of this.allowedChatIds) {

        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });


        if (order.payment_method === 'SEPA Instant Transfer' && order.sepa_payment_proof) {
          try {
            const fs = require('fs');
            const path = require('path');
            const proofPath = path.join(
              process.cwd(),
              'uploads',
              'sepa-proofs',
              order.sepa_payment_proof,
            );

            if (fs.existsSync(proofPath)) {
              const ext = path.extname(order.sepa_payment_proof).toLowerCase();
              if (ext === '.pdf') {
                await this.bot.sendDocument(chatId, proofPath, {
                  caption: '📎 SEPA Payment Proof',
                });
              } else {
                await this.bot.sendPhoto(chatId, proofPath, {
                  caption: '📎 SEPA Payment Proof',
                });
              }
            }
          } catch (fileError) {
            console.error('Failed to send payment proof:', fileError);
          }
        }
      }

      for (const chatId of this.allowedManagerChatIds) {
        let managerMessage = `─────────────\n`;
        managerMessage += `⏳ ${order.id}\n`;
        managerMessage += `💰 €${order.total.toFixed(2)} • ${currentStatus?.status || 'N/A'}\n`;
        managerMessage += `🔘 ${orderDate}\n`;
        managerMessage += `─────────────\n\n`;
        managerMessage += `*Date & Time:* ${orderDate} ${orderTime}\n`;
        managerMessage += `*Status:* ${currentStatus?.status || 'N/A'}\n`;
        managerMessage += `*Customer:* ${order.customer_first_name} ${order.customer_last_name}\n`;
        managerMessage += `*Items:* ${itemsList}\n`;
        
        if (order.discount > 0) {
          managerMessage += `*Subtotal:* €${order.subtotal.toFixed(2)}\n`;
          let discountText = `*Discount:* -€${order.discount.toFixed(2)}`;
          if (promoCodeInfo?.manager_name) {
            discountText += ` (${promoCodeInfo.manager_name})`;
          }
          managerMessage += `${discountText}\n`;
          managerMessage += `*Total:* €${order.total.toFixed(2)}\n`;
        }

        await this.bot.sendMessage(chatId, managerMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      console.error('Send order notification error:', error);
    }
  }


  async sendMessage(message: string) {
    if (!this.bot || this.allowedChatIds.size === 0) return;

    try {
      for (const chatId of this.allowedChatIds) {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }


  async updateOrderStatusMessage(orderId: string, status: string, location?: string) {
    if (!this.bot || this.allowedChatIds.size === 0) return;

    let message = `🔄 *Order Status Updated*\n\n`;
    message += `📦 Order ID: \`${orderId}\`\n`;
    message += `📊 New Status: ${status}\n`;
    if (location) {
      message += `📍 Location: ${location}\n`;
    }
    message += `🕐 Updated: ${new Date().toLocaleString('ru-RU')}`;

    try {
      for (const chatId of this.allowedChatIds) {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
        });
      }
    } catch (error) {
      console.error('Failed to send status update:', error);
    }
  }

  async sendTrackingUpdate(orderId: string, trackingNumber: string, courier?: string) {
    if (!this.bot || this.allowedChatIds.size === 0) return;

    let message = `📍 *Tracking Information Added*\n\n`;
    message += `📦 Order ID: \`${orderId}\`\n`;
    message += `🔢 Tracking: ${trackingNumber}\n`;
    if (courier) {
      message += `🚚 Courier: ${courier}\n`;
    }

    try {
      for (const chatId of this.allowedChatIds) {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
        });
      }
    } catch (error) {
      console.error('Failed to send tracking update:', error);
    }
  }

  async sendPaymentProofNotification(orderId: string, proofPath: string, paymentType: 'SEPA' | 'ACH' | 'FP' = 'SEPA') {
    if (!this.bot || this.allowedChatIds.size === 0) return;

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customer_first_name: true,
          customer_last_name: true,
          customer_email: true,
          total: true,
        },
      });

      if (!order) return;

      const paymentTypeLabel = 
        paymentType === 'ACH' ? 'ACH/Wire' : 
        paymentType === 'FP' ? 'Faster Payments' : 
        'SEPA';
      const message = `💳 *${paymentTypeLabel} Payment Proof Received*\n\n` +
        `📦 Order ID: \`${orderId}\`\n` +
        `👤 Customer: ${order.customer_first_name} ${order.customer_last_name}\n` +
        `📧 Email: ${order.customer_email}\n` +
        `💰 Amount: €${order.total.toFixed(2)}\n\n` +
        `📎 Payment proof attached below:`;

      const fs = require('fs');
      const path = require('path');
      const folderName = 
        paymentType === 'ACH' ? 'ach-proofs' : 
        paymentType === 'FP' ? 'fp-proofs' : 
        'sepa-proofs';
      const fullPath = path.join(process.cwd(), 'uploads', folderName, path.basename(proofPath));

      for (const chatId of this.allowedChatIds) {

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });


        if (fs.existsSync(fullPath)) {
          const ext = path.extname(fullPath).toLowerCase();
          if (ext === '.pdf') {
            await this.bot.sendDocument(chatId, fullPath, {
              caption: `📎 ${paymentTypeLabel} Payment Proof - ${orderId}`,
            });
          } else {
            await this.bot.sendPhoto(chatId, fullPath, {
              caption: `📎 ${paymentTypeLabel} Payment Proof - ${orderId}`,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to send payment proof notification:', error);
    }
  }
}
