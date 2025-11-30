import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly measurementId = 'G-8MXXWK4VF8';
  private readonly apiSecret = 'qTHC-vJ-Rpq6_D_k7G7EUw';
  private readonly endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
  private readonly tiktokPixelId = 'D4JVP43C77UBCCH9EEA0';
  private readonly tiktokEndpoint = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

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

  async trackTikTokPurchase(
    orderId: string,
    value: number,
    currency: string,
    items: Array<{ id: string; name: string; quantity: number; price: number; brand?: string; category?: string }>,
    email?: string,
    phone?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const eventTime = Math.floor(Date.now() / 1000);

      const payload = {
        event_source: 'web',
        event_source_id: this.tiktokPixelId,
        data: [
          {
            event: 'Purchase',
            event_time: eventTime,
            event_id: orderId,
            user: {
              email: email ? this.hashEmail(email) : null,
              phone: phone ? this.hashPhone(phone) : null,
              ip: ipAddress || null,
              user_agent: userAgent || null,
            },
            properties: {
              contents: items.map(item => ({
                price: item.price,
                quantity: item.quantity,
                content_id: item.id,
                content_category: item.category || null,
                content_name: item.name,
                brand: item.brand || null,
              })),
              currency: currency,
              value: value,
              content_type: 'product',
            },
            page: {
              url: `https://lux-store.eu/checkout/success`,
            },
          },
        ],
      };

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`📊 TikTok Event: CompletePayment`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📤 REQUEST:`);
      this.logger.log(`   Order ID: ${orderId}`);
      this.logger.log(`   Value: ${value} ${currency}`);
      this.logger.log(`   Items: ${items.length}`);
      this.logger.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await fetch(this.tiktokEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': process.env.TIKTOK_ACCESS_TOKEN || '',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => null);

      this.logger.log(`\n📥 RESPONSE:`);
      this.logger.log(`   Status: ${response.status} ${response.statusText}`);
      this.logger.log(`   Body: ${JSON.stringify(responseData, null, 2)}`);
      this.logger.log(`${'='.repeat(80)}\n`);

      if (!response.ok) {
        throw new Error(`TikTok API returned status ${response.status}: ${JSON.stringify(responseData)}`);
      }

      this.logger.log(`✅ TikTok event sent successfully: CompletePayment for order ${orderId}`);
    } catch (error) {
      this.logger.error(`\n❌ TikTok ERROR:`);
      this.logger.error(`   Order: ${orderId}`);
      this.logger.error(`   Message: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      this.logger.error(`${'='.repeat(80)}\n`);
    }
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  }

  private hashPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    return createHash('sha256').update(cleaned).digest('hex');
  }

  async trackTikTokOrderPlaced(
    orderId: string,
    value: number,
    currency: string,
    items: Array<{ id: string; name: string; quantity: number; price: number; brand?: string; category?: string }>,
    email?: string,
    phone?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const eventTime = Math.floor(Date.now() / 1000);

      const payload = {
        event_source: 'web',
        event_source_id: this.tiktokPixelId,
        data: [
          {
            event: 'PlaceAnOrder',
            event_time: eventTime,
            event_id: orderId,
            user: {
              email: email ? this.hashEmail(email) : null,
              phone: phone ? this.hashPhone(phone) : null,
              ip: ipAddress || null,
              user_agent: userAgent || null,
            },
            properties: {
              contents: items.map(item => ({
                price: item.price,
                quantity: item.quantity,
                content_id: item.id,
                content_category: item.category || null,
                content_name: item.name,
                brand: item.brand || null,
              })),
              currency: currency,
              value: value,
              content_type: 'product',
            },
            page: {
              url: `https://lux-store.eu/checkout`,
            },
          },
        ],
      };

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`📊 TikTok Event: PlaceAnOrder`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📤 REQUEST:`);
      this.logger.log(`   Order ID: ${orderId}`);
      this.logger.log(`   Value: ${value} ${currency}`);
      this.logger.log(`   Items: ${items.length}`);
      this.logger.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await fetch(this.tiktokEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': process.env.TIKTOK_ACCESS_TOKEN || '',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => null);

      this.logger.log(`\n📥 RESPONSE:`);
      this.logger.log(`   Status: ${response.status} ${response.statusText}`);
      this.logger.log(`   Body: ${JSON.stringify(responseData, null, 2)}`);
      this.logger.log(`${'='.repeat(80)}\n`);

      if (!response.ok) {
        throw new Error(`TikTok API returned status ${response.status}: ${JSON.stringify(responseData)}`);
      }

      this.logger.log(`✅ TikTok event sent successfully: PlaceAnOrder for order ${orderId}`);
    } catch (error) {
      this.logger.error(`\n❌ TikTok ERROR:`);
      this.logger.error(`   Order: ${orderId}`);
      this.logger.error(`   Message: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      this.logger.error(`${'='.repeat(80)}\n`);
    }
  }
}
