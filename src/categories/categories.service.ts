import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Helper функция для преобразования BigInt в строки
  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeBigInt(item));
    }
    
    if (typeof obj === 'object') {
      const serialized: any = {};
      for (const key in obj) {
        serialized[key] = this.serializeBigInt(obj[key]);
      }
      return serialized;
    }
    
    return obj;
  }

  async getCategoriesWithSubcategories() {
    // Получаем все категории верхнего уровня (parent_id = null)
    const topLevelCategories = await this.prisma.category.findMany({
      where: {
        parent_id: null,
      },
      include: {
        children: {
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return this.serializeBigInt(topLevelCategories);
  }

  async getAllCategories() {
    const categories = await this.prisma.category.findMany({
      include: {
        children: true,
        parent: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    
    return this.serializeBigInt(categories);
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        slug_without_id: slug,
      },
      include: {
        children: true,
        parent: true,
      },
    });
    
    return this.serializeBigInt(category);
  }
}
