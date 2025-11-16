import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PlisioInvoiceData {
  txn_id: string;
  invoice_url: string;
  amount: string;
  pending_amount: string;
  wallet_hash: string;
  psys_cid: string;
  currency: string;
  status: string;
  source_currency: string;
  source_rate: string;
  expire_utc: number;
  expected_confirmations: string;
  qr_code: string;
  verify_hash: string;
  invoice_commission: string;
  invoice_sum: string;
  invoice_total_sum: string;
  tx_urls?: string[];
}

interface PlisioErrorData {
  name: string;
  message: string;
  code: number;
  status: number;
}

interface PlisioInvoiceResponse {
  status: string;
  data?: PlisioInvoiceData | PlisioErrorData;
}

export interface CreateInvoiceDto {
  sourceAmount: number; // EUR amount
  orderNumber: string; // Order ID without LS
  currency: string; // Cryptocurrency code
  email: string;
  orderName: string; // Internal order ID (with LS)
}

@Injectable()
export class PlisioService {
  private readonly logger = new Logger(PlisioService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.plisio.net/api/v1';
  private readonly callbackUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PLISIO_API_KEY') || '';
    this.callbackUrl = 'https://api.lux-store.eu/plisio/callback';
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<PlisioInvoiceResponse> {
    try {
      this.logger.debug(`API Key present: ${!!this.apiKey}, length: ${this.apiKey?.length || 0}`);
      
      const params = new URLSearchParams({
        source_currency: 'EUR',
        source_amount: dto.sourceAmount.toString(),
        order_number: dto.orderNumber,
        currency: dto.currency,
        email: dto.email,
        order_name: dto.orderName,
        callback_url: this.callbackUrl,
        api_key: this.apiKey,
      });

      const url = `${this.baseUrl}/invoices/new?${params.toString()}`;

      this.logger.log(`Creating Plisio invoice for order ${dto.orderName}`);
      this.logger.debug(`Request params: ${JSON.stringify({
        source_currency: 'EUR',
        source_amount: dto.sourceAmount,
        order_number: dto.orderNumber,
        currency: dto.currency,
        email: dto.email,
        order_name: dto.orderName,
        callback_url: this.callbackUrl,
      })}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: PlisioInvoiceResponse = await response.json();

      // Log full response for debugging
      this.logger.debug(`Plisio API response: ${JSON.stringify(data)}`);

      if (data.status === 'error') {
        const errorData = data.data as PlisioErrorData;
        this.logger.error(
          `Plisio API error: ${errorData?.name} - ${errorData?.message}`,
        );
        throw new Error(errorData?.message || 'Plisio API error');
      }

      if (data.data) {
        const invoiceData = data.data as PlisioInvoiceData;
        this.logger.log(
          `Successfully created invoice ${invoiceData.txn_id} for order ${dto.orderName}`,
        );
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to create Plisio invoice: ${error.message}`);
      throw error;
    }
  }

  verifyCallback(data: any, receivedHash: string): boolean {
    // Verify hash with SECRET_KEY
    // Implementation depends on Plisio's hash algorithm
    // For now, we'll just return true and log
    this.logger.log(`Verifying callback hash: ${receivedHash}`);
    return true; // TODO: Implement proper verification
  }

  async getInvoice(txnId: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
      });

      const url = `${this.baseUrl}/invoices/${txnId}?${params.toString()}`;

      this.logger.log(`Fetching Plisio invoice ${txnId}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      this.logger.debug(`Raw invoice data: ${JSON.stringify(data)}`);

      // The invoice API returns a different structure than create invoice
      // Just return the raw data for the controller to process
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch Plisio invoice: ${error.message}`);
      throw error;
    }
  }

  getSupportedCryptocurrencies() {
    // Полный список поддерживаемых Plisio валют (2025)
    return [
      { id: 'ETH', code: 'ETH', name: 'Ethereum', blockchain: 'Ethereum', type: 'Native coin', stablecoin: false },
      { id: 'ETH_BASE', code: 'ETH_BASE', name: 'Ethereum Base', blockchain: 'Base Network Layer 2', type: 'Native coin', stablecoin: false },
      { id: 'BTC', code: 'BTC', name: 'Bitcoin', blockchain: 'Bitcoin', type: 'Native coin', stablecoin: false },
      { id: 'LTC', code: 'LTC', name: 'Litecoin', blockchain: 'Litecoin', type: 'Native coin', stablecoin: false },
      { id: 'DASH', code: 'DASH', name: 'Dash', blockchain: 'Dash', type: 'Native coin', stablecoin: false },
      { id: 'TZEC', code: 'ZEC', name: 'Zcash', blockchain: 'Zcash', type: 'Native coin', stablecoin: false },
      { id: 'DOGE', code: 'DOGE', name: 'Dogecoin', blockchain: 'Dogecoin', type: 'Native coin', stablecoin: false },
      { id: 'BCH', code: 'BCH', name: 'Bitcoin Cash', blockchain: 'Bitcoin Cash', type: 'Native coin', stablecoin: false },
      { id: 'XMR', code: 'XMR', name: 'Monero', blockchain: 'Monero', type: 'Native coin', stablecoin: false },
      { id: 'USDT', code: 'USDT', name: 'Tether ERC-20', blockchain: 'Ethereum', type: 'erc-20 token', stablecoin: true },
      { id: 'USDC', code: 'USDC', name: 'USD Coin', blockchain: 'Ethereum', type: 'erc-20 token', stablecoin: true },
      { id: 'USDC_BASE', code: 'USDC_BASE', name: 'USDC Base', blockchain: 'Base Network Layer 2', type: 'erc-20 token', stablecoin: true },
      { id: 'SHIB', code: 'SHIB', name: 'Shiba Inu', blockchain: 'Ethereum', type: 'erc-20 token', stablecoin: false },
      { id: 'APE', code: 'APE', name: 'ApeCoin', blockchain: 'Ethereum', type: 'erc-20 token', stablecoin: false },
      { id: 'BTT_TRX', code: 'BTT_TRX', name: 'BitTorrent TRC-20', blockchain: 'Tron', type: 'trc-20 token', stablecoin: false },
      { id: 'USDT_TRX', code: 'USDT_TRX', name: 'Tether TRC-20', blockchain: 'Tron', type: 'trc-20 token', stablecoin: true },
      { id: 'TRX', code: 'TRX', name: 'Tron', blockchain: 'Tron', type: 'Native coin', stablecoin: false },
      { id: 'BNB', code: 'BNB', name: 'BNB Chain', blockchain: 'BSC', type: 'Native coin', stablecoin: false },
      { id: 'BUSD', code: 'BUSD', name: 'Binance USD BEP-20', blockchain: 'BSC', type: 'bep-20 token', stablecoin: true },
      { id: 'USDT_BSC', code: 'USDT_BSC', name: 'Tether BEP-20', blockchain: 'BSC', type: 'bep-20 token', stablecoin: true },
      { id: 'USDС_BSC', code: 'USDС_BSC', name: 'USDC BEP-20', blockchain: 'BSC', type: 'bep-20 token', stablecoin: true },
      { id: 'LB', code: 'LB', name: 'LoveBit BEP-20', blockchain: 'BSC', type: 'bep-20 token', stablecoin: false },
      { id: 'ETC', code: 'ETC', name: 'Ethereum Classic', blockchain: 'Ethereum Classic', type: 'Native coin', stablecoin: false },
      { id: 'TON', code: 'TON', name: 'Toncoin', blockchain: 'TON: The Open Network', type: 'Native coin', stablecoin: false },
      { id: 'USDT_TON', code: 'USDT_TON', name: 'Tether TON', blockchain: 'TON: The Open Network', type: 'TON token', stablecoin: true },
      { id: 'SOL', code: 'SOL', name: 'Solana', blockchain: 'Solana', type: 'Native coin', stablecoin: false },
      { id: 'USDT_SOL', code: 'USDT_SOL', name: 'Tether spl', blockchain: 'Solana', type: 'spl token', stablecoin: true },
      { id: 'USDC_SOL', code: 'USDC_SOL', name: 'USDC spl', blockchain: 'Solana', type: 'spl token', stablecoin: true },
    ];
  }
}
