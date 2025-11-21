import { Controller, Get, Param, Query } from '@nestjs/common';
import { AttributesService } from './attributes.service';

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}


  @Get()
  async getAllAttributes() {
    return this.attributesService.getAllAttributes();
  }


  @Get('available/filtered')
  async getAvailableAttributes(
    @Query('categorySlug') categorySlug?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query() filters?: Record<string, string | string[]>,
  ) {
    const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : undefined;
    
    return this.attributesService.getAvailableAttributes(
      categorySlug,
      minPriceNum,
      maxPriceNum,
      filters,
    );
  }


  @Get(':name')
  async getAttributeValues(@Param('name') name: string) {
    return this.attributesService.getAttributeValues(name);
  }


  @Get('category/:categorySlug')
  async getAttributesByCategory(@Param('categorySlug') categorySlug: string) {
    if (categorySlug === 'all') {
      return this.attributesService.getAllProductAttributes();
    }
    return this.attributesService.getAttributesByCategory(categorySlug);
  }
}
