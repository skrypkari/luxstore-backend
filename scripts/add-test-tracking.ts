import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTestTracking() {
  try {

    const timestamp = Date.now().toString().slice(-9);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const orderId = `LS${timestamp}${random}`;
    const trackingNumber = `DHL${Math.floor(Math.random() * 10000000000)}`;

    console.log('Creating order:', orderId);
    console.log('Tracking number:', trackingNumber);


    const order = await prisma.order.create({
      data: {
        id: orderId,
        customer_email: 'customer@example.com',
        customer_first_name: 'John',
        customer_last_name: 'Doe',
        customer_phone: '+44-7700-18-44-35',
        shipping_country: 'United Kingdom',
        shipping_state: 'England',
        shipping_city: 'Birmingham',
        shipping_address_1: '6 Brindley Place',
        shipping_postal_code: 'B1 2JB',
        subtotal: 5800,
        discount: 0,
        shipping: 0,
        total: 5800,
        payment_method: 'Credit Card',
        payment_status: 'paid',
        tracking_number: trackingNumber,
        courier: 'DHL Express',
        items: {
          create: [
            {
              product_id: 1,
              product_name: 'Lady Dior Bag',
              product_slug: 'lady-dior-bag',
              product_image:
                'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
              brand: 'Dior',
              price: 5800,
              quantity: 1,
              options: { color: 'Black', size: 'Medium' },
            },
          ],
        },
        statuses: {
          create: [
            {
              status: 'Order Placed',
              location: 'Birmingham, UK',
              is_completed: true,
              is_current: false,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            },
            {
              status: 'Payment Confirmed',
              location: 'Birmingham, UK',
              is_completed: true,
              is_current: false,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000), // 3 days ago + 5 min
            },
            {
              status: 'Processing',
              location: 'Langkawi, Malaysia',
              is_completed: true,
              is_current: false,
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            },
            {
              status: 'Shipped',
              location: 'Kuala Lumpur, Malaysia',
              is_completed: true,
              is_current: false,
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            },
            {
              status: 'In Transit',
              location: 'Dubai, UAE',
              is_completed: true,
              is_current: true,
              notes: 'Package has arrived at DHL hub in Dubai',
              created_at: new Date(), // now
            },
          ],
        },
      },
      include: {
        items: true,
        statuses: true,
      },
    });

    console.log('\n✅ Test order created successfully!');
    console.log('═══════════════════════════════════════');
    console.log(`Order ID: ${order.id}`);
    console.log(`Tracking Number: ${trackingNumber}`);
    console.log('═══════════════════════════════════════');
    console.log('\nYou can now test the tracking page at:');
    console.log(`http://localhost:3000/track`);
    console.log(`\nEnter tracking number: ${trackingNumber}`);
    console.log('\nOrder details:');
    console.log(`- Items: ${order.items.length}`);
    console.log(`- Statuses: ${order.statuses.length}`);
    console.log(
      `- Current status: ${order.statuses.find((s) => s.is_current)?.status}`
    );
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestTracking();
