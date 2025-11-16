export const ORDER_STATUSES = {
  AWAITING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  UNDER_CONCIERGE_REVIEW: 'Under Concierge Review',
  PROCESSED_BY_LOGISTICS: 'Processed by Logistics Team',
  BEING_PREPARED_AT_WAREHOUSE: 'Being Prepared at Our Warehouse',
  PREPARING_FOR_DISPATCH: 'Preparing for Dispatch',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
} as const;

// Full descriptions for website
export const ORDER_STATUS_DESCRIPTIONS = {
  [ORDER_STATUSES.AWAITING_PAYMENT]:
    'Your order is reserved and awaiting payment confirmation.',
  [ORDER_STATUSES.PAYMENT_CONFIRMED]:
    'Your payment has been successfully received — thank you.',
  [ORDER_STATUSES.UNDER_CONCIERGE_REVIEW]:
    'Our concierge team is carefully reviewing and validating your order.',
  [ORDER_STATUSES.PROCESSED_BY_LOGISTICS]:
    'Your order has been forwarded to our logistics department for coordination.',
  [ORDER_STATUSES.BEING_PREPARED_AT_WAREHOUSE]:
    'Your item is being handled and assembled at our warehouse with the utmost care.',
  [ORDER_STATUSES.PREPARING_FOR_DISPATCH]:
    'Your order is being finalised and prepared for secure international shipment.',
  [ORDER_STATUSES.SHIPPED]:
    'Your parcel has been dispatched and is now on its way to you.',
  [ORDER_STATUSES.DELIVERED]:
    'Your order has been successfully delivered — we hope it brings you joy.',
  [ORDER_STATUSES.CANCELLED]:
    'Your order has been cancelled as requested or due to an unresolved issue.',
} as const;

// Short descriptions for Telegram bot
export const ORDER_STATUS_DESCRIPTIONS_SHORT = {
  [ORDER_STATUSES.AWAITING_PAYMENT]: 'Order reserved, awaiting payment.',
  [ORDER_STATUSES.PAYMENT_CONFIRMED]: 'Payment received successfully.',
  [ORDER_STATUSES.UNDER_CONCIERGE_REVIEW]: 'Order under review.',
  [ORDER_STATUSES.PROCESSED_BY_LOGISTICS]: 'Forwarded to logistics.',
  [ORDER_STATUSES.BEING_PREPARED_AT_WAREHOUSE]: 'Being prepared at warehouse.',
  [ORDER_STATUSES.PREPARING_FOR_DISPATCH]: 'Preparing for shipment.',
  [ORDER_STATUSES.SHIPPED]: 'Dispatched and on the way.',
  [ORDER_STATUSES.DELIVERED]: 'Successfully delivered.',
  [ORDER_STATUSES.CANCELLED]: 'Order cancelled.',
} as const;
