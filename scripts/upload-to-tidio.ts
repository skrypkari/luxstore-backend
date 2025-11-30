import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TIDIO_CLIENT_ID = 'ci_cfff4f9e757d411ba9a56113f7e43640';
const TIDIO_CLIENT_SECRET = 'cs_65d7e72239c74c778fd56bd7945bf48e';
const TIDIO_API_URL = 'https://api.tidio.com/products/batch';
const BATCH_SIZE = 100;
const DELAY_MS = 10000; 
const START_FROM_BATCH = 30; 

interface TidioProduct {
  id: number;
  sku: string;
  title: string;
  url: string;
  image_url?: string;
  price: number;
  default_currency: string;
  description: string;
  vendor?: string;
  product_type?: string;
  status: 'visible' | 'hidden';
  barcode?: string;
  features: Record<string, string | number | boolean>;
  updated_at: string;
}

function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadBatch(products: TidioProduct[], batchNumber: number, totalBatches: number): Promise<boolean> {
  const startIndex = (batchNumber - 1) * BATCH_SIZE;
  const endIndex = startIndex + products.length - 1;
  
  console.log(`\n📤 [Batch ${batchNumber}/${totalBatches}] Uploading products ${startIndex}-${endIndex}...`);

  try {
    const response = await fetch(TIDIO_API_URL, {
      method: 'PUT',
      headers: {
        'X-Tidio-Openapi-Client-Id': TIDIO_CLIENT_ID,
        'X-Tidio-Openapi-Client-Secret': TIDIO_CLIENT_SECRET,
        'Accept': 'application/json; version=1',
        'Content-Type': 'application/json; version=1',
      },
      body: JSON.stringify({
        products: products,
      }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      console.log(`✅ [Batch ${batchNumber}/${totalBatches}] Success! Products ${startIndex}-${endIndex} uploaded (Status: ${response.status})`);
      return true;
    } else {
      console.error(`❌ [Batch ${batchNumber}/${totalBatches}] FAILED at products ${startIndex}-${endIndex}`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Response:`, JSON.stringify(data, null, 2));
      console.error(`\n⚠️  TO RESUME FROM THIS BATCH, run: START_FROM_BATCH=${batchNumber - 1} npm run upload:tidio\n`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [Batch ${batchNumber}/${totalBatches}] ERROR at products ${startIndex}-${endIndex}:`, error);
    console.error(`\n⚠️  TO RESUME FROM THIS BATCH, run: START_FROM_BATCH=${batchNumber - 1} npm run upload:tidio\n`);
    return false;
  }
}

async function uploadProductsToTidio() {
  console.log('🔍 Fetching products from database...');

  const products = await prisma.product.findMany({
    include: {
      attributes: {
        include: {
          attribute: true,
        },
      },
      media: {
        orderBy: {
          position: 'asc',
        },
        take: 1,
      },
      categories: {
        include: {
          category: true,
        },
      },
    },
  });

  console.log(`✅ Found ${products.length} products in database`);

  // Transform products to Tidio format
  const tidioProducts: TidioProduct[] = products.map(product => {
    // Get brand from attributes
    const brandAttr = product.attributes.find(
      attr => attr.attribute.name === 'Brand' || attr.attribute.type === 'BRAND'
    );
    const vendor = brandAttr?.value || product.name.split(' ')[0];

    // Get category/product type
    const mainCategory = product.categories[0]?.category;
    const productType = mainCategory?.name || 'Luxury Item';

    // Build features object from attributes
    const features: Record<string, string | number | boolean> = {};
    
    // Add product condition
    features['Condition'] = 'Brand New';
    // Add brand
    features['Brand'] = vendor;
    
    features['Shipping'] = 'Free Shipping';
    
    // Add other attributes
    product.attributes.forEach(attr => {
      const name = attr.attribute.name;
      const value = attr.value;

      // Try to parse as number or boolean
      if (value === 'true' || value === 'false') {
        features[name] = value === 'true';
      } else if (!isNaN(Number(value)) && value.trim() !== '') {
        features[name] = Number(value);
      } else {
        features[name] = value;
      }
    });

    // Get description
    let description = '';
    if (product.description_html) {
      description = stripHtml(product.description_html);
    } else if (product.subtitle) {
      description = product.subtitle;
    } else {
      description = product.name;
    }

    // Limit description to reasonable length
    if (description.length > 5000) {
      description = description.substring(0, 4997) + '...';
    }

    // Get product URL
    const slug = product.slug_without_id || product.slug_with_id || '';
    const url = `https://lux-store.eu/products/${slug}`;

    // Get image URL
    const imageUrl = product.media[0]?.url_original || product.media[0]?.url_800 || undefined;

    // Determine status (visible if not sold out)
    const status: 'visible' | 'hidden' = product.is_sold_out ? 'hidden' : 'visible';

    // Calculate quantity based on price
    const price = product.base_price || 0;
    let quantity: number;
    if (price < 1000) {
      quantity = 5;
    } else if (price < 5000) {
      quantity = 3;
    } else if (price < 50000) {
      quantity = 2;
    } else {
      quantity = 1;
    }
    
    features['In Stock'] = `${quantity} in stock`;

    return {
      id: Number(product.id),
      sku: product.sku || `PROD-${product.id}`,
      title: product.name.substring(0, 512), // Limit to 512 chars
      url: url,
      image_url: imageUrl,
      price: product.base_price || 0,
      default_currency: product.currency || 'EUR',
      description: description,
      vendor: vendor.substring(0, 255), // Limit to 255 chars
      product_type: productType.substring(0, 255), // Limit to 255 chars
      status: status,
      features: features,
      updated_at: product.updated_at.toISOString(),
    };
  });

  console.log(`📦 Prepared ${tidioProducts.length} products for upload`);

  // Split into batches and upload
  const batches: TidioProduct[][] = [];
  for (let i = 0; i < tidioProducts.length; i += BATCH_SIZE) {
    batches.push(tidioProducts.slice(i, i + BATCH_SIZE));
  }

  console.log(`📊 Total batches: ${batches.length}`);
  
  if (START_FROM_BATCH > 0) {
    console.log(`⏭️  Skipping to batch ${START_FROM_BATCH + 1}...`);
    if (START_FROM_BATCH >= batches.length) {
      console.error(`❌ START_FROM_BATCH (${START_FROM_BATCH}) is out of range. Max batch index is ${batches.length - 1}`);
      return;
    }
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = START_FROM_BATCH; i < batches.length; i++) {
    const success = await uploadBatch(batches[i], i + 1, batches.length);
    
    if (success) {
      successCount++;
    } else {
      failedCount++;
      console.error(`\n🛑 Upload stopped due to error at batch ${i + 1}`);
      console.error(`📊 Summary: ${successCount} batches succeeded, ${failedCount} batch failed`);
      console.error(`📍 Failed at products ${i * BATCH_SIZE}-${(i + 1) * BATCH_SIZE - 1}`);
      console.error(`\n💡 To continue from where it stopped, run:`);
      console.error(`   START_FROM_BATCH=${i} npm run upload:tidio\n`);
      process.exit(1);
    }

    // Wait before next batch (except for the last one)
    if (i < batches.length - 1) {
      console.log(`⏱️  Waiting ${DELAY_MS / 1000} seconds before next batch...`);
      await sleep(DELAY_MS);
    }
  }

  console.log('\n✨ All products uploaded successfully!');
  console.log(`📊 Final summary: ${successCount} batches uploaded (${successCount * BATCH_SIZE} products approximately)`);
}

// Run the upload
uploadProductsToTidio()
  .catch(error => {
    console.error('❌ Failed to upload products to Tidio:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

