import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

export interface CreatePaymentResponse {
  gateway_payment_id: string;
  payment_url: string;
}

export interface PaymentStatusData {
  Status: string;
  TransactionID: number;
  ConfirmCode: string;
  Amount: string;
  MerchantID: number;
  AltCoinID: number;
  coinAddress: string;
  CustomerReferenceNr: string;
  inputCurrency: string;
  EURAmount: string;
  OriginalAmount: string;
  CoinName: string;
  CreatedOn: string;
  TransactionConfirmedOn: string;

}

export interface PaymentStatusResponse {
  result: string;
  status_code: number;
  message: string;
  data: PaymentStatusData;
}

@Injectable()
export class CointopayService {
  private readonly logger = new Logger(CointopayService.name);
  private readonly proxyUrl: string;

  constructor() {

    this.proxyUrl = process.env.COINTOPAY_PROXY_URL || 'https://traffer.uk';
  }

    async createPayment(amount: number, orderId: string): Promise<CreatePaymentResponse> {
    try {
      this.logger.log(`Creating CoinToPay payment for order ${orderId}, amount: ${amount}`);

      const response = await fetch(`${this.proxyUrl}/gateway/lx/cp_create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new HttpException(
          `CoinToPay proxy returned ${response.status}`,
          HttpStatus.BAD_GATEWAY
        );
      }

      const data: CreatePaymentResponse = await response.json();

      if (!data.gateway_payment_id || !data.payment_url) {
        throw new HttpException(
          'Invalid response from CoinToPay proxy',
          HttpStatus.BAD_GATEWAY
        );
      }

      this.logger.log(`CoinToPay payment created: ${data.gateway_payment_id}`);
      return data;

    } catch (error) {
      this.logger.error('Failed to create CoinToPay payment', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to create payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

    async checkPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatusResponse> {
    try {
      this.logger.log(`Checking CoinToPay payment status: ${gatewayPaymentId}`);

      const response = await fetch(`${this.proxyUrl}/gateway/lx/cp_status.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gatewayPaymentId }),
      });

      if (!response.ok) {
        throw new HttpException(
          `CoinToPay status proxy returned ${response.status}`,
          HttpStatus.BAD_GATEWAY
        );
      }

      const data: PaymentStatusResponse = await response.json();
      this.logger.log(`CoinToPay status response: ${JSON.stringify(data)}`);
      return data;

    } catch (error) {
      this.logger.error(`Failed to check CoinToPay payment status: ${gatewayPaymentId}`, error);
      
      throw new HttpException(
        'Failed to check payment status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

    isPaymentPaid(status: PaymentStatusResponse): boolean {
    if (!status.data || !status.data.Status) {
      return false;
    }




    const paidStatuses = ['paid', 'overpaid', 'confirmed'];
    return paidStatuses.includes(status.data.Status.toLowerCase());
  }

    isPaymentPending(status: PaymentStatusResponse): boolean {
    if (!status.data || !status.data.Status) {
      return false;
    }




    const pendingStatuses = ['pending', 'awaiting-fiat', 'not paid'];
    return pendingStatuses.includes(status.data.Status.toLowerCase());
  }

    isPaymentExpired(status: PaymentStatusResponse): boolean {
    if (!status.data || !status.data.Status) {
      return false;
    }
    return status.data.Status.toLowerCase() === 'expired';
  }
}
