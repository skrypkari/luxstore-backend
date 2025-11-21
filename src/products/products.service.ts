import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeBigInt(item));
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

  async getRandomProducts(limit: number = 8) {
    const products = await this.prisma.$queryRaw`
      SELECT 
        p.*,
        (SELECT url_800 FROM ProductMedia WHERE product_id = p.id AND is_main = true LIMIT 1) as main_image
      FROM Product p
      WHERE p.is_sold_out = false
      ORDER BY RAND()
      LIMIT ${limit}
    `;

    return this.serializeBigInt(products);
  }

  async searchProducts(
    search: string,
    skip: number = 0,
    take: number = 20,
    minPrice?: number,
    maxPrice?: number,
    filters?: Record<string, string | string[]>,
  ) {
    let selectClause = `
      SELECT DISTINCT p.id,
        (
          -- Точное совпадение в начале названия (наивысший приоритет)
          CASE WHEN LOWER(p.name) LIKE LOWER(CONCAT(?, '%')) THEN 100 ELSE 0 END +
          -- Полное совпадение в названии
          CASE WHEN LOWER(p.name) = LOWER(?) THEN 80 ELSE 0 END +
          -- Совпадение в названии
          CASE WHEN LOWER(p.name) LIKE LOWER(CONCAT('%', ?, '%')) THEN 50 ELSE 0 END +
          -- Совпадение в SKU
          CASE WHEN LOWER(p.sku) LIKE LOWER(CONCAT('%', ?, '%')) THEN 30 ELSE 0 END +
          -- Совпадение в атрибутах (например, бренд)
          CASE WHEN EXISTS (
            SELECT 1 FROM ProductAttribute pa
            WHERE pa.product_id = p.id
            AND LOWER(pa.value) LIKE LOWER(CONCAT('%', ?, '%'))
          ) THEN 40 ELSE 0 END +
          -- Совпадение в категории
          CASE WHEN EXISTS (
            SELECT 1 FROM ProductCategory pc
            INNER JOIN Category c ON pc.category_id = c.id
            WHERE pc.product_id = p.id
            AND LOWER(c.name) LIKE LOWER(CONCAT('%', ?, '%'))
          ) THEN 20 ELSE 0 END
        ) as relevance
      FROM Product p
    `;

    let whereClause = `WHERE (
      LOWER(p.name) LIKE LOWER(CONCAT('%', ?, '%'))
      OR LOWER(p.sku) LIKE LOWER(CONCAT('%', ?, '%'))
      OR EXISTS (
        SELECT 1 FROM ProductAttribute pa
        WHERE pa.product_id = p.id
        AND LOWER(pa.value) LIKE LOWER(CONCAT('%', ?, '%'))
      )
      OR EXISTS (
        SELECT 1 FROM ProductCategory pc
        INNER JOIN Category c ON pc.category_id = c.id
        WHERE pc.product_id = p.id
        AND LOWER(c.name) LIKE LOWER(CONCAT('%', ?, '%'))
      )
    )`;

    const countParams: any[] = [search, search, search, search];

    if (minPrice !== undefined) {
      whereClause += ` AND p.base_price >= ?`;
      countParams.push(minPrice);
    }
    if (maxPrice !== undefined) {
      whereClause += ` AND p.base_price <= ?`;
      countParams.push(maxPrice);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM Product p
      ${whereClause}
    `;

    const countResult: any = await this.prisma.$queryRawUnsafe(
      countQuery,
      ...countParams,
    );
    const total = Number(countResult[0]?.total || 0);

    const selectParams: any[] = [
      search,
      search,
      search,
      search,
      search,
      search, // для релевантности
      search,
      search,
      search,
      search, // для WHERE
    ];

    if (minPrice !== undefined) {
      selectParams.push(minPrice);
    }
    if (maxPrice !== undefined) {
      selectParams.push(maxPrice);
    }

    const productsQuery = `
      ${selectClause}
      ${whereClause}
      ORDER BY relevance DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const productIds: any = await this.prisma.$queryRawUnsafe(
      productsQuery,
      ...selectParams,
      take,
      skip,
    );

    const ids = productIds.map((row: any) => BigInt(row.id));

    if (ids.length === 0) {
      return {
        products: [],
        total: 0,
        skip,
        take,
        hasMore: false,
      };
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        media: {
          where: {
            is_main: true,
          },
          take: 1,
        },
        categories: {
          include: {
            category: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      products: this.serializeBigInt(products),
      total,
      skip,
      take,
      hasMore: skip + take < total,
    };
  }

  async getAllProducts(
    skip: number = 0,
    take: number = 20,
    minPrice?: number,
    maxPrice?: number,
    filters?: Record<string, string | string[]>,
    search?: string,
    sortBy?: string,
  ) {
    if (search && search.trim()) {
      return this.searchProducts(
        search,
        skip,
        take,
        minPrice,
        maxPrice,
        filters,
      );
    }

    const whereCondition: any = {};

    if (minPrice !== undefined || maxPrice !== undefined) {
      whereCondition.base_price = {};
      if (minPrice !== undefined) {
        whereCondition.base_price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        whereCondition.base_price.lte = maxPrice;
      }
    }

    if (filters) {
      const attributeFilters = Object.entries(filters).filter(
        ([key]) =>
          ![
            'skip',
            'take',
            'page',
            'limit',
            'minPrice',
            'maxPrice',
            'search',
            'Category',
            'sortBy',
          ].includes(key),
      );

      const categoryFilter = filters['Category'];

      const andConditions: any[] = [];

      if (categoryFilter) {
        const categoryValues = Array.isArray(categoryFilter)
          ? categoryFilter
          : [categoryFilter];
        andConditions.push({
          categories: {
            some: {
              category: {
                name: {
                  in: categoryValues,
                },
              },
            },
          },
        });
      }

      if (attributeFilters.length > 0) {
        attributeFilters.forEach(([attributeName, values]) => {
          const valueArray = Array.isArray(values) ? values : [values];
          andConditions.push({
            attributes: {
              some: {
                attribute: {
                  name: attributeName,
                },
                value: {
                  in: valueArray,
                },
              },
            },
          });
        });
      }

      if (andConditions.length > 0) {
        whereCondition.AND = andConditions;
      }
    }

    let orderBy: any = { created_at: 'desc' }; // По умолчанию

    switch (sortBy) {
      case 'price-asc':
        orderBy = { base_price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { base_price: 'desc' };
        break;
      case 'newest':
        orderBy = { created_at: 'desc' };
        break;
      case 'bestsellers':
        orderBy = { views: 'desc' };
        break;
      case 'a-z':
        orderBy = { name: 'asc' };
        break;
      case 'z-a':
        orderBy = { name: 'desc' };
        break;
      case 'featured':
      default:
        orderBy = { created_at: 'desc' };
        break;
    }

    const total = await this.prisma.product.count({
      where: whereCondition,
    });

    const products = await this.prisma.product.findMany({
      where: whereCondition,
      skip,
      take,
      include: {
        media: {
          where: {
            is_main: true,
          },
          take: 1,
        },
        categories: {
          include: {
            category: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
      orderBy,
    });

    return {
      products: this.serializeBigInt(products),
      total,
      skip,
      take,
      hasMore: skip + take < total,
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: BigInt(id),
      },
      include: {
        media: {
          orderBy: {
            position: 'asc',
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
          },
        },
        seo: true,
        urls: true,
      },
    });

    if (product) {
      await this.prisma.product.update({
        where: {
          id: BigInt(id),
        },
        data: {
          views: {
            increment: 1,
          },
        },
      });

      product.views = product.views + 1;
    }

    return this.serializeBigInt(product);
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: {
        slug_without_id: slug,
      },
      include: {
        media: {
          orderBy: {
            position: 'asc',
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
          },
        },
        seo: true,
        urls: true,
      },
    });

    return this.serializeBigInt(product);
  }

  async getProductsByCategory(
    categorySlug: string,
    skip: number = 0,
    take: number = 20,
    minPrice?: number,
    maxPrice?: number,
    filters?: Record<string, string | string[]>,
    sortBy?: string,
  ) {
    const category = await this.prisma.category.findUnique({
      where: {
        slug_without_id: categorySlug,
      },
      include: {
        children: true,
      },
    });

    if (!category) {
      return {
        products: [],
        total: 0,
        skip,
        take,
        hasMore: false,
      };
    }

    let categoryIds = [category.id, ...category.children.map((c) => c.id)];

    if (filters) {
      const brandSlug = filters.brand || filters.Brand;
      if (brandSlug) {
        const brandValue = Array.isArray(brandSlug) ? brandSlug[0] : brandSlug;

        console.log('Looking for subcategory:', brandValue);
        console.log(
          'Available subcategories:',
          category.children.map((c) => ({
            id: c.id,
            slug: c.slug_without_id,
            name: c.name,
          })),
        );

        const subcategory = category.children.find(
          (c) => c.slug_without_id?.toLowerCase() === brandValue.toLowerCase(),
        );

        console.log(
          'Found subcategory:',
          subcategory
            ? {
                id: subcategory.id,
                slug: subcategory.slug_without_id,
                name: subcategory.name,
              }
            : 'NOT FOUND',
        );

        if (subcategory) {
          categoryIds = [subcategory.id];
          console.log('Using only subcategory ID:', subcategory.id);

          const { brand, Brand, ...restFilters } = filters;
          filters = restFilters;
        }
      }
    }

    const whereCondition: any = {
      categories: {
        some: {
          category_id: {
            in: categoryIds,
          },
        },
      },
    };

    if (minPrice !== undefined || maxPrice !== undefined) {
      whereCondition.base_price = {};
      if (minPrice !== undefined) {
        whereCondition.base_price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        whereCondition.base_price.lte = maxPrice;
      }
    }

    if (filters) {
      const attributeFilters = Object.entries(filters).filter(
        ([key]) =>
          !['skip', 'take', 'minPrice', 'maxPrice', 'sortBy'].includes(key),
      );

      if (attributeFilters.length > 0) {
        whereCondition.AND = attributeFilters.map(([attributeName, values]) => {
          const valueArray = Array.isArray(values) ? values : [values];
          return {
            attributes: {
              some: {
                attribute: {
                  name: attributeName,
                },
                value: {
                  in: valueArray,
                },
              },
            },
          };
        });
      }
    }

    let orderBy: any = { created_at: 'desc' }; // По умолчанию

    switch (sortBy) {
      case 'price-asc':
        orderBy = { base_price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { base_price: 'desc' };
        break;
      case 'newest':
        orderBy = { created_at: 'desc' };
        break;
      case 'bestsellers':
        orderBy = { views: 'desc' };
        break;
      case 'a-z':
        orderBy = { name: 'asc' };
        break;
      case 'z-a':
        orderBy = { name: 'desc' };
        break;
      case 'featured':
      default:
        orderBy = { created_at: 'desc' };
        break;
    }

    const total = await this.prisma.product.count({
      where: whereCondition,
    });

    const products = await this.prisma.product.findMany({
      where: whereCondition,
      skip,
      take,
      include: {
        media: {
          where: {
            is_main: true,
          },
          take: 1,
        },
        categories: {
          include: {
            category: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
      orderBy,
    });

    return {
      products: this.serializeBigInt(products),
      total,
      skip,
      take,
      hasMore: skip + take < total,
    };
  }
}
