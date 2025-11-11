import { Controller, Get, Param, Query } from '@nestjs/common';
import { AttributesService } from './attributes.service';

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  // Получить все атрибуты со значениями
  @Get()
  async getAllAttributes() {
    return this.attributesService.getAllAttributes();
  }

  // Получить значения конкретного атрибута
  @Get(':name')
  async getAttributeValues(@Param('name') name: string) {
    return this.attributesService.getAttributeValues(name);
  }

  // Получить атрибуты для категории
  @Get('category/:categorySlug')
  async getAttributesByCategory(@Param('categorySlug') categorySlug: string) {
    if (categorySlug === 'all') {
      return this.attributesService.getAllProductAttributes();
    }
    return this.attributesService.getAttributesByCategory(categorySlug);
  }
}
