import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('promo-codes')
export class PromoCodesController {
  constructor(private prisma: PrismaService) {}

  @Post('validate')
  async validatePromoCode(@Body() body: { code: string }) {
    const { code } = body;

    if (!code) {
      throw new HttpException('Promo code is required', HttpStatus.BAD_REQUEST);
    }

    const promoCode = await this.prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        is_active: true,
      },
    });

    if (!promoCode) {
      throw new HttpException('Invalid or expired promo code', HttpStatus.NOT_FOUND);
    }

    // Increment usage count
    await this.prisma.promoCode.update({
      where: { id: promoCode.id },
      data: { used_count: { increment: 1 } },
    });

    return {
      valid: true,
      code: promoCode.code,
      discount: promoCode.discount,
      manager_name: promoCode.manager_name,
    };
  }
}
