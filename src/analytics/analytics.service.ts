import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly measurementId = 'G-8MXXWK4VF8';
  private readonly apiSecret = 'qTHC-vJ-Rpq6_D_k7G7EUw';
  private readonly endpoint = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

  private hashIpAddress(ipAddress: string): string {
    return createHash('sha256').update(ipAddress).digest('hex');
  }

  private async sendEvent(clientId: string, eventName: string, params: any) {
    try {
      const payload = {
        client_id: clientId,
        events: [
          {
            name: eventName,
            params: params,
          },
        ],
      };

      const payloadString = JSON.stringify(payload);
      const headers = {
        'Content-Type': 'application/json',
      };

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`📊 GA4 Event: ${eventName}`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📤 REQUEST:`);
      this.logger.log(`   Method: POST`);
      this.logger.log(`   URL: ${this.endpoint}`);
      this.logger.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);
      this.logger.log(`   Body: ${JSON.stringify(payload, null, 2)}`);
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: headers,
        body: payloadString,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseText = await response.text();

      this.logger.log(`\n📥 RESPONSE:`);
      this.logger.log(`   Status: ${response.status} ${response.statusText}`);
      this.logger.log(`   Headers: ${JSON.stringify(responseHeaders, null, 2)}`);
      this.logger.log(`   Body: ${responseText || '(empty)'}`);
      this.logger.log(`${'='.repeat(80)}\n`);

      if (!response.ok) {
        throw new Error(`GA4 API returned status ${response.status}: ${responseText}`);
      }

      this.logger.log(`✅ GA4 event sent successfully: ${eventName}`);
    } catch (error) {
      this.logger.error(`\n❌ ERROR:`);
      this.logger.error(`   Message: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      this.logger.error(`${'='.repeat(80)}\n`);
    }
  }

  async trackOrderPlaced(
    orderId: string, 
    value: number, 
    currency: string, 
    paymentMethod: string,
    items: Array<{ id: string; name: string; quantity: number; price: number }>,
    gaClientId?: string,
    ipAddress?: string
  ) {
    const clientId = gaClientId || (ipAddress ? this.hashIpAddress(ipAddress) : 'unknown');

    await this.sendEvent(clientId, 'begin_checkout', {
      transaction_id: orderId,
      debug_mode: true,
      value: value,
      currency: currency,
      payment_method: paymentMethod,
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  }

  async trackPaymentSuccess(
    orderId: string, 
    value: number, 
    currency: string, 
    paymentMethod: string,
    items: Array<{ id: string; name: string; quantity: number; price: number }>,
    gaClientId?: string,
    ipAddress?: string
  ) {
    const clientId = gaClientId || (ipAddress ? this.hashIpAddress(ipAddress) : 'unknown');

    await this.sendEvent(clientId, 'purchase', {
      transaction_id: orderId,
      debug_mode: true,
      value: value,
      currency: currency,
      payment_method: paymentMethod,
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  }
}
