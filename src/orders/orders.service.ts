import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TelegramImprovedService } from '../telegram/telegram-improved.service';
import {
  CointopayService,
  PaymentStatusResponse,
} from '../cointopay/cointopay.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AmPayService } from '../ampay/ampay.service';
import { convertCountryCodeWithFallback } from '../ampay/country-codes.util';
import { ORDER_STATUSES } from './order-statuses.constant';
import { createHash } from 'crypto';

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
  gaClientId?: string;
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  userAgent?: string;
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
  gclid?: string;
  userAgent?: string;
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
    private amPayService: AmPayService,
  ) {}

  private generateOrderId(): string {
    const timestamp = Date.now().toString().slice(-9); // Last 9 digits
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `LS${timestamp}${random}`;
  }

  private hashSHA256(value: string): string {
    return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
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
        ga_client_id: data.gaClientId,
        utm_source: data.utmSource,
        utm_medium: data.utmMedium,
        utm_campaign: data.utmCampaign,
        utm_term: data.utmTerm,
        utm_content: data.utmContent,
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
              gclid: data.gclid,
              hashed_email: this.hashSHA256(data.customerEmail),
              hashed_phone_number: this.hashSHA256(data.customerPhone),
              conversion_value: data.total,
              currency_code: 'EUR',
              user_agent: data.userAgent,
              ip_address: data.ipAddress,
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

    await this.telegramService.sendOrderNotification(order.id);

    const items = order.items.map((item) => ({
      id: item.sku || item.product_id.toString(),
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
    }));

    await this.analyticsService.trackOrderPlaced(
      order.id,
      order.total,
      order.currency,
      order.payment_method,
      items,
      order.ga_client_id || undefined,
      order.ip_address || undefined,
    );

    // Track TikTok PlaceAnOrder event
    const itemsWithDetails = order.items.map((item) => ({
      id: item.sku || item.product_id.toString(),
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      brand: item.brand || undefined,
      category: undefined,
    }));

    await this.analyticsService.trackTikTokOrderPlaced(
      order.id,
      order.total,
      order.currency,
      itemsWithDetails,
      order.customer_email,
      order.customer_phone,
      order.ip_address || undefined,
      data.userAgent,
    );

    return this.serializeOrder(order);
  }

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
    // Получаем заказ для доступа к email, phone, total
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    await this.prisma.orderStatus.updateMany({
      where: { order_id: orderId },
      data: { is_current: false },
    });

    const status = await this.prisma.orderStatus.create({
      data: {
        order_id: orderId,
        status: data.status,
        location: data.location,
        notes: data.notes,
        is_current: true,
        is_completed: true,
        gclid: data.gclid,
        hashed_email: this.hashSHA256(order.customer_email),
        hashed_phone_number: this.hashSHA256(order.customer_phone),
        conversion_value: order.total,
        currency_code: 'EUR',
        user_agent: data.userAgent,
        ip_address: order.ip_address,
      },
    });

    if (data.status === ORDER_STATUSES.PAYMENT_CONFIRMED) {
      const orderWithItems = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (orderWithItems && orderWithItems.payment_status !== 'paid') {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            payment_status: 'paid',
            paid_at: new Date(),
          },
        });

        const items = orderWithItems.items.map((item) => ({
          id: item.sku || item.product_id.toString(),
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
        }));

        await this.analyticsService.trackPaymentSuccess(
          orderWithItems.id,
          orderWithItems.total,
          orderWithItems.currency,
          orderWithItems.payment_method,
          items,
          orderWithItems.ga_client_id || undefined,
          orderWithItems.ip_address || undefined,
        );

        // Track TikTok purchase event
        const itemsWithDetails = orderWithItems.items.map((item) => ({
          id: item.sku || item.product_id.toString(),
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          brand: undefined,
          category: undefined,
        }));

        await this.analyticsService.trackTikTokPurchase(
          orderWithItems.id,
          orderWithItems.total,
          orderWithItems.currency,
          itemsWithDetails,
          orderWithItems.customer_email,
          orderWithItems.customer_phone,
          orderWithItems.ip_address || undefined,
          undefined,
        );
      }
    }

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
      orders: orders.map((order) => this.serializeOrder(order)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async trackOrder(orderId: string, email: string) {
    const normalizedOrderId = orderId.trim().toUpperCase();

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

    const payment = await this.cointopayService.createPayment(
      order.total,
      orderId,
    );

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

  async createAmPayPayment(orderId: string) {
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

    const country3Letter = convertCountryCodeWithFallback(
      order.shipping_country,
      'USA',
    );

    const payment = await this.amPayService.createPayment({
      orderId: order.id,
      amount: order.total,
      currency: order.currency || 'EUR',
      customerEmail: order.customer_email,
      customerFullName: `${order.customer_first_name} ${order.customer_last_name}`,
      customerIp: order.ip_address || '0.0.0.0',
      customerCountry: country3Letter,
    });

    this.logger.log(
      `AmPay payment created for order ${orderId}: ${payment.system_id}`,
    );

    if (payment.system_id) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          gateway_payment_id: payment.system_id,
          payment_url: payment.redirect_url,
        },
      });
    }

    return {
      orderId: order.id,
      status: payment.status,
      system_id: payment.system_id,
      tracker_id: payment.tracker_id,
      redirect_url: payment.redirect_url,
      amount: payment.amount,
      currency: payment.currency,
      error_message: payment.error_message,
    };
  }

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

    const currentStatus = order.statuses[0]?.status || 'awaiting_payment';

    return {
      id: order.id,
      order_number: order.id,
      access_token: order.access_token,
      payment_status: order.payment_status,
      status: currentStatus,
      gateway_payment_id: order.gateway_payment_id,
      total: order.total,
    };
  }

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

    const status = await this.cointopayService.checkPaymentStatus(
      order.gateway_payment_id,
    );

    const isPaid = this.cointopayService.isPaymentPaid(status);
    const isPending = this.cointopayService.isPaymentPending(status);
    const isExpired = this.cointopayService.isPaymentExpired(status);

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

      const fullOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (fullOrder) {
        const items = fullOrder.items.map((item) => ({
          id: item.sku || item.product_id.toString(),
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
        }));

        await this.analyticsService.trackPaymentSuccess(
          fullOrder.id,
          fullOrder.total,
          fullOrder.currency,
          fullOrder.payment_method,
          items,
          fullOrder.ga_client_id || undefined,
          fullOrder.ip_address || undefined,
        );
      }

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
