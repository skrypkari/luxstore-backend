import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('random')
  async getRandomProducts(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 8;
    return this.productsService.getRandomProducts(limitNum);
  }

  @Get()
  async getAllProducts(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query() filters?: Record<string, string | string[]>,
  ) {
    // Support both skip/take and page/limit formats
    let skipNum: number;
    let takeNum: number;
    
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      skipNum = (pageNum - 1) * limitNum;
      takeNum = limitNum;
    } else {
      skipNum = skip ? parseInt(skip, 10) : 0;
      takeNum = take ? parseInt(take, 10) : 20;
    }
    
    const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : undefined;
    
    return this.productsService.getAllProducts(skipNum, takeNum, minPriceNum, maxPriceNum, filters, search, sortBy);
  }

  @Get('category/:categorySlug')
  async getProductsByCategory(
    @Param('categorySlug') categorySlug: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query() filters?: Record<string, string | string[]>,
  ) {
    // Support both skip/take and page/limit formats
    let skipNum: number;
    let takeNum: number;
    
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      skipNum = (pageNum - 1) * limitNum;
      takeNum = limitNum;
    } else {
      skipNum = skip ? parseInt(skip, 10) : 0;
      takeNum = take ? parseInt(take, 10) : 20;
    }
    
    const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : undefined;
    
    return this.productsService.getProductsByCategory(categorySlug, skipNum, takeNum, minPriceNum, maxPriceNum, filters, sortBy);
  }

  @Get('slug/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    return this.productsService.getProductBySlug(slug);
  }

  @Get(':id')
  async getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }
}
