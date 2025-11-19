import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly measurementId = 'G-8MXXWK4VF8';
  private readonly apiSecret = 'qTHC-vJ-Rpq6_D_k7G7EUw';
  private readonly endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

  /**
   * Hash IP address for client_id
   */
  private hashIpAddress(ipAddress: string): string {
    return createHash('sha256').update(ipAddress).digest('hex');
  }

  /**
   * Send event to Google Analytics 4
   */
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

      this.logger.log(`Sending GA4 event: ${eventName}, client_id: ${clientId.substring(0, 10)}...`);
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`GA4 API returned status ${response.status}`);
      }

      this.logger.log(`GA4 event sent successfully: ${eventName}`);
    } catch (error) {
      this.logger.error(`Failed to send GA4 event ${eventName}:`, error.message);
    }
  }

  /**
   * Track order placed event
   */
  async trackOrderPlaced(orderId: string, value: number, currency: string, ipAddress?: string) {
    const clientId = ipAddress ? this.hashIpAddress(ipAddress) : 'unknown';
    
    await this.sendEvent(clientId, 'order_placed', {
      order_id: orderId,
      value: value,
      currency: currency,
    });
  }

  /**
   * Track payment success event
   */
  async trackPaymentSuccess(orderId: string, value: number, currency: string, ipAddress?: string) {
    const clientId = ipAddress ? this.hashIpAddress(ipAddress) : 'unknown';
    
    await this.sendEvent(clientId, 'payment_success', {
      order_id: orderId,
      value: value,
      currency: currency,
    });
  }
}
