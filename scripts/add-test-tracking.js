const mysql = require('mysql2/promise');

async function addTestTracking() {
  const connection = await mysql.createConnection({
    host: 'lux0.mysql.tools',
    user: 'lux0_base',
    password: 'DYTu13&N4c',
    database: 'lux0_base',
  });

  try {
    console.log('Connected to database');


    const timestamp = Date.now().toString().slice(-9);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const orderId = `LS${timestamp}${random}`;
    const trackingNumber = `DHL${Math.floor(Math.random() * 10000000000)}`;

    console.log('Creating order:', orderId);
    console.log('Tracking number:', trackingNumber);


    const [orderResult] = await connection.execute(
      `INSERT INTO Order (
        id, 
        customer_email, 
        customer_first_name, 
        customer_last_name, 
        customer_phone,
        shipping_country, 
        shipping_state, 
        shipping_city, 
        shipping_address_1,
        shipping_postal_code,
        subtotal, 
        discount, 
        shipping, 
        total,
        payment_method,
        payment_status,
        tracking_number,
        courier,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        orderId,
        'customer@example.com',
        'John',
        'Doe',
        '+44-7700-18-44-35',
        'United Kingdom',
        'England',
        'Birmingham',
        '6 Brindley Place',
        'B1 2JB',
        5800,
        0,
        0,
        5800,
        'Credit Card',
        'paid',
        trackingNumber,
        'DHL Express',
      ]
    );

    console.log('Order created');


    await connection.execute(
      `INSERT INTO OrderItem (
        order_id,
        product_id,
        product_name,
        product_slug,
        product_image,
        brand,
        price,
        quantity,
        options
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        1,
        'Lady Dior Bag',
        'lady-dior-bag',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
        'Dior',
        5800,
        1,
        JSON.stringify({ color: 'Black', size: 'Medium' }),
      ]
    );

    console.log('Order item added');


    const statuses = [
      {
        status: 'Order Placed',
        location: 'Birmingham, UK',
        is_completed: true,
        is_current: false,
        delay: 0,
      },
      {
        status: 'Payment Confirmed',
        location: 'Birmingham, UK',
        is_completed: true,
        is_current: false,
        delay: 5 * 60, // 5 minutes after
      },
      {
        status: 'Processing',
        location: 'Langkawi, Malaysia',
        is_completed: true,
        is_current: false,
        delay: 24 * 60 * 60, // 1 day after
      },
      {
        status: 'Shipped',
        location: 'Kuala Lumpur, Malaysia',
        is_completed: true,
        is_current: false,
        delay: 2 * 24 * 60 * 60, // 2 days after
      },
      {
        status: 'In Transit',
        location: 'Dubai, UAE',
        is_completed: true,
        is_current: true,
        delay: 3 * 24 * 60 * 60, // 3 days after
        notes: 'Package has arrived at DHL hub in Dubai',
      },
      {
        status: 'In Transit',
        location: 'London Heathrow, UK',
        is_completed: false,
        is_current: false,
        delay: 5 * 24 * 60 * 60, // 5 days after (future)
      },
      {
        status: 'Out for Delivery',
        location: 'Birmingham, UK',
        is_completed: false,
        is_current: false,
        delay: 7 * 24 * 60 * 60, // 7 days after (future)
      },
      {
        status: 'Delivered',
        location: '6 Brindley Place, Birmingham',
        is_completed: false,
        is_current: false,
        delay: 7 * 24 * 60 * 60 + 6 * 60 * 60, // 7 days + 6 hours (future)
      },
    ];

    for (const statusData of statuses) {
      await connection.execute(
        `INSERT INTO OrderStatus (
          order_id,
          status,
          location,
          notes,
          is_current,
          is_completed,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
        [
          orderId,
          statusData.status,
          statusData.location,
          statusData.notes || null,
          statusData.is_current,
          statusData.is_completed,
          statusData.delay,
        ]
      );
    }

    console.log('Timeline statuses added');
    console.log('\n✅ Test order created successfully!');
    console.log('═══════════════════════════════════════');
    console.log(`Order ID: ${orderId}`);
    console.log(`Tracking Number: ${trackingNumber}`);
    console.log('═══════════════════════════════════════');
    console.log('\nYou can now test the tracking page at:');
    console.log(`http://localhost:3000/track`);
    console.log(`\nEnter tracking number: ${trackingNumber}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

addTestTracking();
