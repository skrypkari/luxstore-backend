import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() body: any) {
    return this.ordersService.createOrder(body);
  }

  @Get()
  async getAllOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getAllOrders(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Patch(':id/status')
  async updateOrderStatus(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateOrderStatus(id, body);
  }

  @Patch(':id/tracking')
  async updateTracking(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateTracking(id, body);
  }

  @Post('track')
  async trackOrder(@Body() body: { orderId: string; email: string }) {
    return this.ordersService.trackOrder(body.orderId, body.email);
  }

  @Get('by-token/:token')
  async getOrderByToken(@Param('token') token: string) {
    return this.ordersService.getOrderByToken(token);
  }

  @Post(':id/cointopay-payment')
  async createCointopayPayment(@Param('id') id: string) {
    return this.ordersService.createCointopayPayment(id);
  }

  @Get(':id/cointopay-status')
  async getCointopayPaymentStatus(@Param('id') id: string) {
    // Frontend просто получает статус из БД, без запроса к шлюзу
    return this.ordersService.getOrderStatus(id);
  }

  @Post(':id/ampay-payment')
  async createAmPayPayment(@Param('id') id: string) {
    return this.ordersService.createAmPayPayment(id);
  }

  @Get('by-gateway-payment/:gatewayPaymentId')
  async getOrderByGatewayPaymentId(
    @Param('gatewayPaymentId') gatewayPaymentId: string,
  ) {
    // Используется PHP redirect скриптом для получения order_id по ConfirmCode
    return this.ordersService.getOrderByGatewayPaymentId(gatewayPaymentId);
  }

  @Get(':id/pending-url')
  async getPendingUrl(@Param('id') id: string) {
    // Используется PHP redirect скриптами для получения URL pending page
    return {
      url: `https://lux-store.eu/orders/pending?order=${id}`,
      order_id: id,
    };
  }
}
