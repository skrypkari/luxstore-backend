import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import { CointopayService, PaymentStatusResponse } from '../cointopay/cointopay.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ORDER_STATUSES } from './order-statuses.constant';

interface CreateOrderDto {
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  shippingCountry: string;
  shippingState?: string;
  shippingCity: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  shippingPostalCode: string;
  subtotal: number;
  discount?: number;
  shipping?: number;
  total: number;
  paymentMethod: string;
  promoCode?: string;
  notes?: string;
  ipAddress?: string;
  geoCountry?: string;
  geoCity?: string;
  geoRegion?: string;
  items: Array<{
    productId: number;
    productName: string;
    productSlug?: string;
    productImage?: string;
    brand?: string;
    sku?: string;
    price: number;
    quantity: number;
    options?: any;
  }>;
}

interface UpdateOrderStatusDto {
  status: string;
  location?: string;
  notes?: string;
}

interface UpdateTrackingDto {
  trackingNumber: string;
  courier?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramImprovedService,
    private cointopayService: CointopayService,
    private analyticsService: AnalyticsService,
  ) {}

  // Generate unique order ID in format LS000154435891
  private generateOrderId(): string {
    const timestamp = Date.now().toString().slice(-9); // Last 9 digits
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LS${timestamp}${random}`;
  }

  async createOrder(data: CreateOrderDto) {
    const orderId = this.generateOrderId();

    const order = await this.prisma.order.create({
      data: {
        id: orderId,
        customer_email: data.customerEmail,
        customer_first_name: data.customerFirstName,
        customer_last_name: data.customerLastName,
        customer_phone: data.customerPhone,
        shipping_country: data.shippingCountry,
        shipping_state: data.shippingState,
        shipping_city: data.shippingCity,
        shipping_address_1: data.shippingAddress1,
        shipping_address_2: data.shippingAddress2,
        shipping_postal_code: data.shippingPostalCode,
        subtotal: data.subtotal,
        discount: data.discount || 0,
        shipping: data.shipping || 0,
        total: data.total,
        payment_method: data.paymentMethod,
        payment_status: 'pending',
        promo_code: data.promoCode,
        notes: data.notes,
        ip_address: data.ipAddress,
        geo_country: data.geoCountry,
        geo_city: data.geoCity,
        geo_region: data.geoRegion,
        items: {
          create: data.items.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            product_slug: item.productSlug,
            product_image: item.productImage,
            brand: item.brand,
            sku: item.sku,
            price: item.price,
            quantity: item.quantity,
            options: item.options,
          })),
        },
        statuses: {
          create: [
            {
              status: ORDER_STATUSES.AWAITING_PAYMENT,
              location: `${data.shippingCity}, ${data.shippingCountry}`,
              is_current: true,
              is_completed: false,
            },
          ],
        },
      },
      include: {
        items: true,
        statuses: {
          orderBy: {
            created_at: 'asc',
          },
        },
      },
    });

    // Send Telegram notification
    await this.telegramService.sendOrderNotification(order.id);

    // Send Google Analytics event - order placed
    await this.analyticsService.trackOrderPlaced(
      order.id,
      order.total,
      order.currency,
      order.ip_address || undefined,
    );

    // Convert BigInt fields to regular numbers for JSON serialization
    return this.serializeOrder(order);
  }

  // Helper method to convert BigInt to numbers in order objects
  private serializeOrder(order: any) {
    return {
      ...order,
      items: order.items?.map((item: any) => ({
        ...item,
        product_id: Number(item.product_id),
      })),
      statuses: order.statuses?.map((status: any) => ({
        ...status,
        id: Number(status.id),
      })),
    };
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statuses: {
          orderBy: {
            created_at: 'asc',
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.serializeOrder(order);
  }

  async updateOrderStatus(orderId: string, data: UpdateOrderStatusDto) {
    // Set all existing statuses to not current
    await this.prisma.orderStatus.updateMany({
      where: { order_id: orderId },
      data: { is_current: false },
    });

    // Create new status
    const status = await this.prisma.orderStatus.create({
      data: {
        order_id: orderId,
        status: data.status,
        location: data.location,
        notes: data.notes,
        is_current: true,
        is_completed: true,
      },
    });

    // If status is Payment Confirmed, send analytics event and update payment_status
    if (data.status === ORDER_STATUSES.PAYMENT_CONFIRMED) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (order && order.payment_status !== 'paid') {
        // Update payment status
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            payment_status: 'paid',
            paid_at: new Date(),
          },
        });

        // Send Google Analytics event - payment success
        await this.analyticsService.trackPaymentSuccess(
          order.id,
          order.total,
          order.currency,
          order.ip_address || undefined,
        );
      }
    }

    // Send Telegram notification
    await this.telegramService.updateOrderStatusMessage(
      orderId,
      data.status,
      data.location,
    );

    return this.getOrder(orderId);
  }

  async updateTracking(orderId: string, data: UpdateTrackingDto) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        tracking_number: data.trackingNumber,
        courier: data.courier,
      },
      include: {
        items: true,
        statuses: {
          orderBy: {
            created_at: 'asc',
          },
        },
      },
    });

    // Send Telegram notification
    await this.telegramService.sendTrackingUpdate(
      orderId,
      data.trackingNumber,
      data.courier,
    );

    return this.serializeOrder(order);
  }

  async getAllOrders(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          items: true,
          statuses: {
            where: { is_current: true },
          },
        },
      }),
      this.prisma.order.count(),
    ]);

    return {
      orders: orders.map(order => this.serializeOrder(order)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async trackOrder(orderId: string, email: string) {
    // Normalize order ID to uppercase and remove spaces
    const normalizedOrderId = orderId.trim().toUpperCase();

    // Find order by ID and email
    const order = await this.prisma.order.findFirst({
      where: {
        id: normalizedOrderId,
        customer_email: email.trim().toLowerCase(),
      },
      select: {
        id: true,
        access_token: true,
      },
    });

    if (!order) {
      return {
        success: false,
        message: 'Order not found or email does not match',
      };
    }

    return {
      success: true,
      orderId: order.id,
      token: order.access_token,
    };
  }

  async getOrderByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { access_token: token },
      include: {
        items: true,
        statuses: {
          orderBy: {
            created_at: 'asc',
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.serializeOrder(order);
  }

  /**
   * Создать платёж CoinToPay для заказа
   */
  async createCointopayPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.payment_method !== 'Open Banking') {
      throw new Error('Order payment method is not Open Banking');
    }

    if (order.payment_status === 'paid') {
      throw new Error('Order already paid');
    }

    // Создать платёж через CoinToPay
    const payment = await this.cointopayService.createPayment(
      order.total,
      orderId,
    );

    // Сохранить gateway_payment_id в базу
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        gateway_payment_id: payment.gateway_payment_id,
        payment_url: payment.payment_url,
      },
    });

    return {
      orderId: orderId,
      gatewayPaymentId: payment.gateway_payment_id,
      paymentUrl: payment.payment_url,
    };
  }

  /**
   * Получить статус заказа из БД (для фронтенда)
   * НЕ делает запрос к шлюзу - только читает из БД
   */
  async getOrderStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        access_token: true,
        payment_status: true,
        payment_method: true,
        gateway_payment_id: true,
        total: true,
        paid_at: true,
        statuses: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Get the latest status
    const currentStatus = order.statuses[0]?.status || 'awaiting_payment';

    return {
      id: order.id,
      order_number: order.id, // Use ID as order number
      access_token: order.access_token, // For secure redirect to order details
      payment_status: order.payment_status,
      status: currentStatus, // Latest OrderStatusType
      gateway_payment_id: order.gateway_payment_id,
      total: order.total,
    };
  }

  /**
   * Найти заказ по gateway_payment_id (ConfirmCode от CoinToPay)
   * Используется PHP redirect скриптом
   */
  async getOrderByGatewayPaymentId(gatewayPaymentId: string) {
    const order = await this.prisma.order.findFirst({
      where: { gateway_payment_id: gatewayPaymentId },
      select: {
        id: true,
        payment_status: true,
        gateway_payment_id: true,
        total: true,
      },
    });

    if (!order) {
      throw new Error('Order not found by gateway_payment_id');
    }

    return order;
  }

  /**
   * Проверить статус платежа CoinToPay у шлюза
   * Используется только в CRON задаче
   */
  async checkCointopayPaymentStatus(orderId: string): Promise<{
    orderId: string;
    gatewayPaymentId: string;
    status: string;
    isPaid: boolean;
    isPending: boolean;
    isExpired: boolean;
    rawStatus: PaymentStatusResponse;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.gateway_payment_id) {
      throw new Error('No CoinToPay payment for this order');
    }

    // Проверить статус через CoinToPay
    const status = await this.cointopayService.checkPaymentStatus(
      order.gateway_payment_id,
    );

    const isPaid = this.cointopayService.isPaymentPaid(status);
    const isPending = this.cointopayService.isPaymentPending(status);
    const isExpired = this.cointopayService.isPaymentExpired(status);

    // Обновить статус заказа если оплачен
    if (isPaid && order.payment_status !== 'paid') {
      await this.updateOrderStatus(orderId, {
        status: ORDER_STATUSES.PAYMENT_CONFIRMED,
      });

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          payment_status: 'paid',
          paid_at: new Date(),
        },
      });

      // Send Google Analytics event - payment success
      await this.analyticsService.trackPaymentSuccess(
        order.id,
        order.total,
        order.currency,
        order.ip_address || undefined,
      );

      this.logger.log(`Order ${orderId} marked as paid via CoinToPay`);
    }

    return {
      orderId: orderId,
      gatewayPaymentId: order.gateway_payment_id,
      status: status.data?.Status || 'unknown',
      isPaid,
      isPending,
      isExpired,
      rawStatus: status,
    };
  }
}
