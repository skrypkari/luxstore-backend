import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TelegramService } from '../telegram/telegram.service';
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
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
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
    await this.telegramService.sendOrderNotification(order);

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
}
