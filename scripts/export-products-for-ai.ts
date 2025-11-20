import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CategoryInfo {
  name: string;
  url: string;
}

interface ProductForAI {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  currency: string;
  condition: string | null;
  brand: string | null;
  description: string | null;
  subtitle: string | null;
  categories: CategoryInfo[];
  attributes: Record<string, string>;
  specifications: Record<string, string>;
  dimensions: {
    width?: number;
    height?: number;
    depth?: number;
    length?: number;
    size?: string;
  };
  materials: string[];
  colors: string[];
  inStock: boolean;
  url: string;
}

async function exportProductsForAI() {
  console.log('🔍 Fetching all products from database...');

  const products = await prisma.product.findMany({
    include: {
      attributes: {
        include: {
          attribute: true,
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
      seo: true,
    },
  });

  console.log(`✅ Found ${products.length} products`);
  console.log('🔄 Processing products...');

  const productsForAI: ProductForAI[] = products.map((product) => {
    // Extract description from SEO jsonld
    let description: string | null = null;
    if (product.seo?.jsonld) {
      try {
        const jsonld = typeof product.seo.jsonld === 'string' 
          ? JSON.parse(product.seo.jsonld) 
          : product.seo.jsonld;
        description = jsonld.description || null;
      } catch (e) {
        console.warn(`⚠️ Failed to parse jsonld for product ${product.id}`);
      }
    }

    // Fallback to subtitle or description_html if no SEO description
    if (!description) {
      description = product.subtitle || product.description_html || null;
    }

    // Build attributes map
    const attributes: Record<string, string> = {};
    const specifications: Record<string, string> = {};
    const materials: string[] = [];
    const colors: string[] = [];
    let brand: string | null = null;

    product.attributes.forEach((attr) => {
      const attrName = attr.attribute.name;
      const attrValue = attr.value;

      attributes[attrName] = attrValue;

      // Special handling for common attributes
      if (attrName.toLowerCase() === 'brand') {
        brand = attrValue;
      } else if (attrName.toLowerCase() === 'material' || attrName.toLowerCase().includes('material')) {
        materials.push(attrValue);
      } else if (attrName.toLowerCase() === 'color' || attrName.toLowerCase() === 'colour') {
        colors.push(attrValue);
      } else {
        specifications[attrName] = attrValue;
      }
    });

    // Extract dimensions
    const dimensions: ProductForAI['dimensions'] = {};
    
    // Look for dimension-related attributes
    Object.entries(attributes).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('width')) {
        dimensions.width = parseFloat(value) || undefined;
      } else if (lowerKey.includes('height')) {
        dimensions.height = parseFloat(value) || undefined;
      } else if (lowerKey.includes('depth')) {
        dimensions.depth = parseFloat(value) || undefined;
      } else if (lowerKey.includes('length')) {
        dimensions.length = parseFloat(value) || undefined;
      } else if (lowerKey.includes('size') || lowerKey === 'dimensions') {
        dimensions.size = value;
      }
    });

    // Extract categories with URLs
    const categories: CategoryInfo[] = product.categories.map((cat) => ({
      name: cat.category.name,
      url: cat.category.slug_without_id 
        ? `https://lux-store.eu/store/${cat.category.slug_without_id}`
        : '',
    }));

    // Build product URL
    const url = product.slug_without_id 
      ? `https://lux-store.eu/products/${product.slug_without_id}`
      : '';

    return {
      id: product.id.toString(),
      name: product.name,
      sku: product.sku,
      price: product.base_price,
      currency: product.currency,
      condition: product.condition,
      brand,
      description,
      subtitle: product.subtitle,
      categories,
      attributes,
      specifications,
      dimensions,
      materials,
      colors,
      inStock: !product.is_sold_out,
      url,
    };
  });

  // Write to JSON file
  const outputPath = path.join(__dirname, '../data/products-for-ai.json');
  const outputDir = path.dirname(outputPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(productsForAI, null, 2), 'utf-8');

  console.log(`✅ Exported ${productsForAI.length} products to ${outputPath}`);
  console.log('\n📊 Statistics:');
  console.log(`- Products with SKU: ${productsForAI.filter(p => p.sku).length}`);
  console.log(`- Products with price: ${productsForAI.filter(p => p.price).length}`);
  console.log(`- Products with description: ${productsForAI.filter(p => p.description).length}`);
  console.log(`- Products in stock: ${productsForAI.filter(p => p.inStock).length}`);
  console.log(`- Total brands: ${new Set(productsForAI.map(p => p.brand).filter(Boolean)).size}`);
  console.log(`- Total categories: ${new Set(productsForAI.flatMap(p => p.categories)).size}`);

  await prisma.$disconnect();
}

exportProductsForAI()
  .catch((error) => {
    console.error('❌ Error exporting products:', error);
    process.exit(1);
  });
