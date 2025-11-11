import { Controller, Get, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories() {
    return this.categoriesService.getCategoriesWithSubcategories();
  }

  @Get('all')
  async getAllCategories() {
    return this.categoriesService.getAllCategories();
  }

  @Get(':slug')
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.getCategoryBySlug(slug);
  }
}
