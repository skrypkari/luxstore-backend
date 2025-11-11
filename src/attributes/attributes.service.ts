import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AttributesService {
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

  // Получить все атрибуты с их значениями
  async getAllAttributes() {
    const attributes = await this.prisma.attribute.findMany({
      include: {
        products: {
          select: {
            value: true,
          },
          distinct: ['value'],
        },
      },
    });

    // Группируем значения по атрибутам
    const result = attributes.map(attr => ({
      id: attr.id.toString(),
      name: attr.name,
      type: attr.type,
      values: [...new Set(attr.products.map(p => p.value))].sort(),
    }));

    return this.serializeBigInt(result);
  }

  // Получить все значения для конкретного атрибута по имени
  async getAttributeValues(attributeName: string) {
    const attribute = await this.prisma.attribute.findFirst({
      where: {
        name: attributeName,
      },
      include: {
        products: {
          select: {
            value: true,
          },
          distinct: ['value'],
        },
      },
    });

    if (!attribute) {
      return {
        name: attributeName,
        values: [],
      };
    }

    const uniqueValues = [...new Set(attribute.products.map(p => p.value))].sort();

    return {
      id: attribute.id.toString(),
      name: attribute.name,
      type: attribute.type,
      values: uniqueValues,
    };
  }

  // Получить фильтры для категории (атрибуты товаров в категории)
  async getAttributesByCategory(categorySlug: string) {
    // Находим категорию
    const category = await this.prisma.category.findUnique({
      where: {
        slug_without_id: categorySlug,
      },
      include: {
        children: true,
      },
    });

    if (!category) {
      return [];
    }

    // Получаем ID категории и всех подкатегорий
    const categoryIds = [category.id, ...category.children.map(c => c.id)];

    // Получаем все атрибуты товаров в этих категориях
    const productAttributes = await this.prisma.productAttribute.findMany({
      where: {
        product: {
          categories: {
            some: {
              category_id: {
                in: categoryIds,
              },
            },
          },
        },
      },
      include: {
        attribute: true,
      },
      distinct: ['attribute_id', 'value'],
    });

    // Группируем по атрибутам
    const attributesMap = new Map<string, Set<string>>();
    const attributeInfo = new Map<string, { id: string; name: string; type: string }>();

    productAttributes.forEach(pa => {
      const attrId = pa.attribute.id.toString();
      
      if (!attributeInfo.has(attrId)) {
        attributeInfo.set(attrId, {
          id: attrId,
          name: pa.attribute.name,
          type: pa.attribute.type,
        });
      }

      if (!attributesMap.has(attrId)) {
        attributesMap.set(attrId, new Set());
      }
      
      attributesMap.get(attrId)?.add(pa.value);
    });

    // Формируем результат
    const result = Array.from(attributesMap.entries()).map(([attrId, values]) => ({
      ...attributeInfo.get(attrId),
      values: Array.from(values).sort(),
    }));

    return this.serializeBigInt(result);
  }

  // Получить все атрибуты для всех товаров (для страницы "all")
  async getAllProductAttributes() {
    const productAttributes = await this.prisma.productAttribute.findMany({
      include: {
        attribute: true,
      },
      distinct: ['attribute_id', 'value'],
    });

    // Группируем по атрибутам
    const attributesMap = new Map<string, Set<string>>();
    const attributeInfo = new Map<string, { id: string; name: string; type: string }>();

    productAttributes.forEach(pa => {
      const attrId = pa.attribute.id.toString();
      
      if (!attributeInfo.has(attrId)) {
        attributeInfo.set(attrId, {
          id: attrId,
          name: pa.attribute.name,
          type: pa.attribute.type,
        });
      }

      if (!attributesMap.has(attrId)) {
        attributesMap.set(attrId, new Set());
      }
      
      attributesMap.get(attrId)?.add(pa.value);
    });

    // Формируем результат
    const result = Array.from(attributesMap.entries()).map(([attrId, values]) => ({
      ...attributeInfo.get(attrId),
      values: Array.from(values).sort(),
    }));

    return this.serializeBigInt(result);
  }

  // Получить доступные атрибуты на основе текущих фильтров
  async getAvailableAttributes(
    categorySlug?: string,
    minPrice?: number,
    maxPrice?: number,
    filters?: Record<string, string | string[]>,
  ) {
    const whereCondition: any = {};

    if (categorySlug && categorySlug !== 'all') {
      const category = await this.prisma.category.findUnique({
        where: { slug_without_id: categorySlug },
        include: { children: true },
      });

      if (category) {
        let categoryIds = [category.id, ...category.children.map(c => c.id)];
        
        // Если передан параметр brand или Brand, пытаемся найти подкатегорию с таким slug
        if (filters) {
          const brandSlug = filters.brand || filters.Brand;
          if (brandSlug) {
            const brandValue = Array.isArray(brandSlug) ? brandSlug[0] : brandSlug;
            
            console.log('[Attributes] Looking for subcategory:', brandValue);
            console.log('[Attributes] Available subcategories:', category.children.map(c => ({ id: c.id, slug: c.slug_without_id, name: c.name })));
            
            // Ищем подкатегорию без учета регистра
            const subcategory = category.children.find(c => 
              c.slug_without_id?.toLowerCase() === brandValue.toLowerCase()
            );
            
            console.log('[Attributes] Found subcategory:', subcategory ? { id: subcategory.id, slug: subcategory.slug_without_id, name: subcategory.name } : 'NOT FOUND');
            
            if (subcategory) {
              // Если нашли подкатегорию, используем только её ID
              categoryIds = [subcategory.id];
              console.log('[Attributes] Using only subcategory ID:', subcategory.id);
              // Удаляем brand/Brand из фильтров, чтобы не искать его в атрибутах
              const { brand, Brand, ...restFilters } = filters;
              filters = restFilters;
            }
          }
        }
        
        whereCondition.categories = {
          some: {
            category_id: { in: categoryIds },
          },
        };
      }
    }

    // Фильтр по цене
    if (minPrice !== undefined || maxPrice !== undefined) {
      whereCondition.base_price = {};
      if (minPrice !== undefined) {
        whereCondition.base_price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        whereCondition.base_price.lte = maxPrice;
      }
    }

    // Применяем текущие фильтры
    if (filters) {
      const attributeFilters = Object.entries(filters).filter(
        ([key]) => !['skip', 'take', 'page', 'limit', 'minPrice', 'maxPrice', 'search', 'Category', 'categorySlug'].includes(key)
      );
      
      const categoryFilter = filters['Category'];
      const andConditions: any[] = [];

      // Фильтр по категориям из параметров
      if (categoryFilter) {
        const categoryValues = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
        andConditions.push({
          categories: {
            some: {
              category: {
                name: { in: categoryValues },
              },
            },
          },
        });
      }

      // Фильтры по атрибутам
      if (attributeFilters.length > 0) {
        attributeFilters.forEach(([attributeName, values]) => {
          const valueArray = Array.isArray(values) ? values : [values];
          andConditions.push({
            attributes: {
              some: {
                attribute: { name: attributeName },
                value: { in: valueArray },
              },
            },
          });
        });
      }

      if (andConditions.length > 0) {
        whereCondition.AND = andConditions;
      }
    }

    // Получаем атрибуты только тех товаров, которые соответствуют фильтрам
    const productAttributes = await this.prisma.productAttribute.findMany({
      where: {
        product: whereCondition,
      },
      include: {
        attribute: true,
      },
      distinct: ['attribute_id', 'value'],
    });

    // Группируем по атрибутам
    const attributesMap = new Map<string, Set<string>>();
    const attributeInfo = new Map<string, { id: string; name: string; type: string }>();

    productAttributes.forEach(pa => {
      const attrId = pa.attribute.id.toString();
      
      if (!attributeInfo.has(attrId)) {
        attributeInfo.set(attrId, {
          id: attrId,
          name: pa.attribute.name,
          type: pa.attribute.type,
        });
      }

      if (!attributesMap.has(attrId)) {
        attributesMap.set(attrId, new Set());
      }
      
      attributesMap.get(attrId)?.add(pa.value);
    });

    // Добавляем фильтр Category если нужно
    let result = Array.from(attributesMap.entries()).map(([attrId, values]) => ({
      ...attributeInfo.get(attrId),
      values: Array.from(values).sort(),
    }));

    // Если это страница "all", добавляем фильтр по категориям
    if (categorySlug === 'all' || !categorySlug) {
      const categories = await this.prisma.category.findMany({
        where: {
          parent_id: null, // только корневые категории
        },
        select: {
          name: true,
        },
      });

      if (categories.length > 0) {
        const categoryAttribute = {
          id: 'category-filter',
          name: 'Category',
          type: 'select',
          values: categories.map(cat => cat.name).sort(),
        };
        result = [categoryAttribute, ...result];
      }
    }

    return this.serializeBigInt(result);
  }
}
