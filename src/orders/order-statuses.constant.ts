export const ORDER_STATUSES = {
  AWAITING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  UNDER_REVIEW: 'Under Review',
  BEING_PREPARED: 'Being Prepared',
  SCHEDULED_FOR_DISPATCH: 'Scheduled for Dispatch',
  ON_ITS_WAY: 'On Its Way to You',
  DELIVERED: 'Delivered',
  PAYMENT_FAILED: 'Payment Failed',
  CLOSED: 'Order Closed',
} as const;


export const ORDER_STATUS_DESCRIPTIONS = {
  [ORDER_STATUSES.AWAITING_PAYMENT]:
    'Your order has been reserved and is currently awaiting payment. Once the payment is completed, our concierge team will begin processing your request with priority.',
  [ORDER_STATUSES.PAYMENT_CONFIRMED]:
    'Your payment has been successfully confirmed. Our concierge team will now proceed to prepare your order with the utmost attention to detail.',
  [ORDER_STATUSES.UNDER_REVIEW]:
    'Your order is being reviewed by our concierge team. We are validating item availability, quality, and packaging requirements to ensure a flawless experience.',
  [ORDER_STATUSES.BEING_PREPARED]:
    'Your order is now being carefully prepared by our concierge team. Each item is inspected, assembled, and packaged with precision to meet the standards of a premium Maison.',
  [ORDER_STATUSES.SCHEDULED_FOR_DISPATCH]:
    'Your order is ready and scheduled for dispatch. Our logistics partners will ensure secure handling and a smooth delivery to your chosen destination.',
  [ORDER_STATUSES.ON_ITS_WAY]:
    'Your order has been dispatched and is now on its way to you. You may track its journey at any time using the tracking details provided.',
  [ORDER_STATUSES.DELIVERED]:
    'Your order has been successfully delivered. We hope you enjoy your new piece, and our concierge team remains at your service should you need any assistance.',
  [ORDER_STATUSES.PAYMENT_FAILED]:
    'Unfortunately, your payment could not be completed. You may try again at your convenience, and our concierge team will gladly assist you should you need guidance.',
  [ORDER_STATUSES.CLOSED]:
    'Your order has been closed. If this was done in error or if you wish to place a new request, our concierge team is always here to assist you.',
} as const;


export const ORDER_STATUS_DESCRIPTIONS_SHORT = {
  [ORDER_STATUSES.AWAITING_PAYMENT]: 'Order reserved, awaiting payment.',
  [ORDER_STATUSES.PAYMENT_CONFIRMED]: 'Payment confirmed successfully.',
  [ORDER_STATUSES.UNDER_REVIEW]: 'Order under review by concierge team.',
  [ORDER_STATUSES.BEING_PREPARED]: 'Being prepared with care.',
  [ORDER_STATUSES.SCHEDULED_FOR_DISPATCH]: 'Scheduled for dispatch.',
  [ORDER_STATUSES.ON_ITS_WAY]: 'On its way to you.',
  [ORDER_STATUSES.DELIVERED]: 'Successfully delivered.',
  [ORDER_STATUSES.PAYMENT_FAILED]: 'Payment could not be completed.',
  [ORDER_STATUSES.CLOSED]: 'Order closed.',
} as const;


export const ORDER_STATUS_LABELS = {
  [ORDER_STATUSES.AWAITING_PAYMENT]: 'Awaiting',
  [ORDER_STATUSES.PAYMENT_CONFIRMED]: 'Confirmed',
  [ORDER_STATUSES.UNDER_REVIEW]: 'Review',
  [ORDER_STATUSES.BEING_PREPARED]: 'Preparing',
  [ORDER_STATUSES.SCHEDULED_FOR_DISPATCH]: 'Scheduled',
  [ORDER_STATUSES.ON_ITS_WAY]: 'Shipped',
  [ORDER_STATUSES.DELIVERED]: 'Delivered',
  [ORDER_STATUSES.PAYMENT_FAILED]: 'Failed',
  [ORDER_STATUSES.CLOSED]: 'Closed',
} as const;
