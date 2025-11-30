import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const OUTPUT_PATH = path.join(__dirname, '../exports/products-feed.csv');
const STORE_URL = 'https://lux-store.eu';

const CSV_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'link',
  'image link',
  'price',
  'identifier exists',
  'gtin',
  'mpn',
  'brand',
  'product highlight',
  'product detail',
  'additional image link',
  'condition',
  'adult',
  'color',
  'size',
  'gender',
  'material',
  'pattern',
  'age group',
  'multipack',
  'is bundle',
  'unit pricing measure',
  'unit pricing base measure',
  'energy efficiency class',
  'min energy efficiency class',
  'max energy efficiency class',
  'item group id',
  'sell on google quantity',
];

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    attributes: {
      include: {
        attribute: true;
      };
    };
    media: true;
    categories: {
      include: {
        category: true;
      };
    };
  };
}>;

function csvEscape(value: string | number | null | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (str === '') {
    return '';
  }
  const needsQuotes = /[",\n]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function stripHtml(value?: string | null): string {
  if (!value) {
    return '';
  }
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }
  return value.slice(0, length - 1).trim() + '…';
}

function getRawJson(product: ProductWithRelations): Record<string, any> | null {
  if (!product.raw_json) {
    return null;
  }
  if (typeof product.raw_json === 'string') {
    try {
      return JSON.parse(product.raw_json);
    } catch {
      return null;
    }
  }
  return product.raw_json as Record<string, any>;
}

function getAttributeValue(
  product: ProductWithRelations,
  predicate: (name: string, type: string) => boolean,
): string | undefined {
  const attribute = product.attributes.find((attr) =>
    predicate(attr.attribute.name.toLowerCase(), attr.attribute.type.toLowerCase()),
  );
  return attribute?.value;
}

function getAttributeByName(product: ProductWithRelations, name: string): string | undefined {
  return getAttributeValue(
    product,
    (attrName) => attrName === name.toLowerCase(),
  );
}

function getBrand(product: ProductWithRelations): string {
  const brandAttr =
    getAttributeValue(
      product,
      (name, type) => name === 'brand' || type === 'brand',
    ) || '';
  if (brandAttr) {
    return brandAttr;
  }
  const tokens = product.name.split(' ');
  return tokens.length ? tokens[0].toUpperCase() : 'Luxury Brand';
}

function detectGenderFromValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized.includes('her') || normalized.includes('woman') || normalized.includes('female')) {
    return 'female';
  }
  if (normalized.includes('him') || normalized.includes('man') || normalized.includes('male')) {
    return 'male';
  }
  if (normalized.includes('unisex')) {
    return 'unisex';
  }
  if (normalized.includes('for her')) {
    return 'female';
  }
  if (normalized.includes('for him')) {
    return 'male';
  }
  return null;
}

function getGender(product: ProductWithRelations): string {
  for (const attr of product.attributes) {
    const name = attr.attribute.name.toLowerCase();
    const type = attr.attribute.type.toLowerCase();
    const value = attr.value;

    if (
      name.includes('gender') ||
      name.includes('selection for') ||
      name.includes('for him') ||
      name.includes('for her') ||
      name.includes('for whom') ||
      type.includes('gender')
    ) {
      const detected = detectGenderFromValue(value);
      if (detected) {
        return detected;
      }
    }

    const detectedFromValue = detectGenderFromValue(value);
    if (detectedFromValue) {
      return detectedFromValue;
    }
  }
  return 'unisex';
}

function getAgeGroup(product: ProductWithRelations): string {
  const ageAttr = getAttributeValue(product, (name) => name.includes('age'));
  if (ageAttr) {
    const value = ageAttr.toLowerCase();
    if (['newborn', 'infant', 'toddler', 'children', 'adult'].includes(value)) {
      return value;
    }
  }
  return 'adult';
}

function getColor(product: ProductWithRelations): string {
  return (
    getAttributeValue(product, (name) => name.includes('color') || name.includes('colour')) || ''
  );
}

function getSize(product: ProductWithRelations): string {
  return getAttributeValue(product, (name) => name.includes('size') || name.includes('dimensions')) || '';
}

function getMaterial(product: ProductWithRelations): string {
  if (isBagCategory(product)) {
    return 'leather';
  }

  const metal =
    getAttributeValue(
      product,
      (name, type) => name.includes('metal') || type.includes('metal'),
    ) || '';

  if (metal) {
    return metal;
  }

  return getAttributeValue(product, (name) => name.includes('material')) || '';
}

function getPattern(product: ProductWithRelations): string {
  return getAttributeValue(product, (name) => name.includes('pattern')) || '';
}

function isBagCategory(product: ProductWithRelations): boolean {
  return product.categories.some((categoryLink) => {
    const category = categoryLink.category;
    if (!category) {
      return false;
    }
    const name = category.name?.toLowerCase() || '';
    const slugWithoutId = category.slug_without_id?.toLowerCase() || '';
    const slugWithId = category.slug_with_id?.toLowerCase() || '';
    return name.includes('bag') || slugWithoutId.includes('bag') || slugWithId.includes('bag');
  });
}

function buildProductDetail(product: ProductWithRelations): string {
  if (!product.attributes.length) {
    return '';
  }
  return product.attributes
    .map((attr) => `${attr.attribute.name}: ${attr.value}`)
    .join(' | ');
}

function getDescription(product: ProductWithRelations): string {
  const raw = getRawJson(product);
  if (raw?.description && typeof raw.description === 'string') {
    return stripHtml(raw.description);
  }
  return stripHtml(product.description_html) || product.subtitle || product.name;
}

function getHighlight(product: ProductWithRelations, description: string): string {
  const raw = getRawJson(product);
  const source =
    product.subtitle ||
    (typeof raw?.short_description === 'string' ? raw.short_description : null) ||
    description;
  return truncate(stripHtml(source), 150);
}

function getMediaUrls(product: ProductWithRelations) {
  const sortedMedia = [...product.media].sort((a, b) => a.position - b.position);
  const primary = sortedMedia[0]?.url_original || sortedMedia[0]?.url_800 || '';
  const secondary = sortedMedia[1]?.url_original || sortedMedia[1]?.url_800 || '';
  return { primary, secondary };
}

function formatPrice(product: ProductWithRelations): string {
  const price = product.base_price ?? 0;
  return `${price.toFixed(2)} ${product.currency || 'EUR'}`;
}

function buildLink(product: ProductWithRelations): string {
  const slug = product.slug_without_id || product.slug_with_id || '';
  return slug ? `${STORE_URL}/products/${slug}` : STORE_URL;
}

function buildRow(product: ProductWithRelations): string[] {
  const description = getDescription(product);
  const highlight = getHighlight(product, description);
  const { primary, secondary } = getMediaUrls(product);
  const brand = getBrand(product);

  return [
    product.id.toString(),
    product.name,
    description,
    'in_stock',
    buildLink(product),
    primary,
    formatPrice(product),
    'no',
    '',
    product.sku || '',
    brand,
    highlight,
    buildProductDetail(product),
    secondary,
    'new',
    'no',
    getColor(product),
    getSize(product),
    getGender(product),
    getMaterial(product),
    getPattern(product),
    getAgeGroup(product),
    '',
    'no',
    '',
    '',
    '',
    '',
    '',
    '',
  ];
}

async function exportProductsFeed() {
  console.log('🔍 Fetching products...');
  const products = await prisma.product.findMany({
    include: {
      attributes: {
        include: {
          attribute: true,
        },
      },
      media: true,
      categories: {
        include: {
          category: true,
        },
      },
    },
  });

  console.log(`✅ Found ${products.length} products. Building feed...`);

  const rows = products.map(buildRow);
  const csvLines = [
    CSV_HEADERS.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, csvLines.join('\n'), 'utf-8');
  console.log(`📦 Feed saved to ${OUTPUT_PATH}`);
  console.log(`ℹ️ Total rows: ${rows.length}`);
}

exportProductsFeed()
  .catch((error) => {
    console.error('❌ Failed to export products feed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


