import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TIDIO_CLIENT_ID = 'ci_cfff4f9e757d411ba9a56113f7e43640';
const TIDIO_CLIENT_SECRET = 'cs_65d7e72239c74c778fd56bd7945bf48e';
const TIDIO_API_URL = 'https://api.tidio.com/products';
const DELAY_MS = 1500; 
const START_FROM_INDEX = parseInt(process.env.START_FROM_INDEX || '0'); 

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deleteProduct(productId: number, index: number, total: number): Promise<boolean> {
  console.log(`\n🗑️  [${index + 1}/${total}] Deleting product ID: ${productId}...`);

  try {
    const response = await fetch(`${TIDIO_API_URL}/${productId}`, {
      method: 'DELETE',
      headers: {
        'X-Tidio-Openapi-Client-Id': TIDIO_CLIENT_ID,
        'X-Tidio-Openapi-Client-Secret': TIDIO_CLIENT_SECRET,
        'Accept': 'application/json; version=1',
        'Content-Type': 'application/json; version=1',
      },
    });

    if (response.ok || response.status === 204) {
      console.log(`✅ [${index + 1}/${total}] Product ${productId} deleted successfully`);
      return true;
    } else if (response.status === 404) {
      console.log(`⚠️  [${index + 1}/${total}] Product ${productId} not found (already deleted or doesn't exist)`);
      return true; 
    } else {
      const data = await response.json().catch(() => null);
      console.error(`❌ [${index + 1}/${total}] Failed to delete product ${productId}`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Response:`, JSON.stringify(data, null, 2));
      console.error(`\n⚠️  TO RESUME FROM THIS PRODUCT, run: START_FROM_INDEX=${index} npm run delete:tidio\n`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [${index + 1}/${total}] ERROR deleting product ${productId}:`, error);
    console.error(`\n⚠️  TO RESUME FROM THIS PRODUCT, run: START_FROM_INDEX=${index} npm run delete:tidio\n`);
    return false;
  }
}

async function deleteAllProductsFromTidio() {
  console.log('🔍 Fetching products from database...');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`✅ Found ${products.length} products in database`);

  if (START_FROM_INDEX > 0) {
    console.log(`⏭️  Skipping to product index ${START_FROM_INDEX + 1}...`);
    if (START_FROM_INDEX >= products.length) {
      console.error(`❌ START_FROM_INDEX (${START_FROM_INDEX}) is out of range. Max index is ${products.length - 1}`);
      return;
    }
  }

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (let i = START_FROM_INDEX; i < products.length; i++) {
    const product = products[i];
    const success = await deleteProduct(Number(product.id), i, products.length);

    if (success) {
      successCount++;
    } else {
      failedCount++;
      console.error(`\n🛑 Deletion stopped due to error at product ${i + 1}/${products.length}`);
      console.error(`📊 Summary: ${successCount} deleted, ${failedCount} failed, ${products.length - i - 1} remaining`);
      console.error(`📍 Failed at product ID: ${product.id} (${product.name})`);
      console.error(`\n💡 To continue from where it stopped, run:`);
      console.error(`   START_FROM_INDEX=${i} npm run delete:tidio\n`);
      process.exit(1);
    }

    if (i < products.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  if (START_FROM_INDEX > 0) {
    skippedCount = START_FROM_INDEX;
  }

  console.log('\n✨ All products deleted from Tidio successfully!');
  console.log(`📊 Final summary:`);
  console.log(`   - Skipped: ${skippedCount}`);
  console.log(`   - Deleted: ${successCount}`);
  console.log(`   - Failed: ${failedCount}`);
  console.log(`   - Total: ${products.length}`);
}

deleteAllProductsFromTidio()
  .catch(error => {
    console.error('❌ Failed to delete products from Tidio:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

