-- Update existing order statuses to new values
-- This script should be run before applying the Prisma migration

-- Update status values in OrderStatus table
UPDATE `OrderStatus` SET `status` = 'Awaiting Payment' WHERE `status` IN ('Awaiting Payment', 'AWAITING_PAYMENT');
UPDATE `OrderStatus` SET `status` = 'Payment Confirmed' WHERE `status` IN ('Payment Confirmed', 'PAYMENT_CONFIRMED');
UPDATE `OrderStatus` SET `status` = 'Under Review' WHERE `status` IN ('Under Concierge Review', 'UNDER_CONCIERGE_REVIEW');
UPDATE `OrderStatus` SET `status` = 'Being Prepared' WHERE `status` IN ('Processed by Logistics Team', 'PROCESSED_BY_LOGISTICS', 'Being Prepared at Our Warehouse', 'BEING_PREPARED_AT_WAREHOUSE');
UPDATE `OrderStatus` SET `status` = 'Scheduled for Dispatch' WHERE `status` IN ('Preparing for Dispatch', 'PREPARING_FOR_DISPATCH');
UPDATE `OrderStatus` SET `status` = 'On Its Way to You' WHERE `status` IN ('Shipped', 'SHIPPED');
UPDATE `OrderStatus` SET `status` = 'Delivered' WHERE `status` IN ('Delivered', 'DELIVERED');
UPDATE `OrderStatus` SET `status` = 'Order Closed' WHERE `status` IN ('Cancelled', 'CANCELLED');

-- Note: Payment Failed status is new, no existing records to update
