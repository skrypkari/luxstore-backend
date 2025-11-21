import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Order, OrderItem } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPaymentConfirmedEmail(
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    try {
      const emailHtml = await this.generatePaymentConfirmedTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: Payment Confirmed`,
        html: emailHtml,
      });

      this.logger.log(`✅ Payment confirmed email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send payment confirmed email: ${error.message}`);
      throw error;
    }
  }

  async sendUnderReviewEmail(
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    try {
      const emailHtml = await this.generateUnderReviewTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: Under Review`,
        html: emailHtml,
      });

      this.logger.log(`✅ Under Review email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send Under Review email: ${error.message}`);
      throw error;
    }
  }

  async sendBeingPreparedEmail(
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    try {
      const emailHtml = await this.generateBeingPreparedTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: Being Prepared`,
        html: emailHtml,
      });

      this.logger.log(`✅ Being Prepared email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send Being Prepared email: ${error.message}`);
      throw error;
    }
  }

  async sendScheduledForDispatchEmail(
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    try {
      const emailHtml = await this.generateScheduledForDispatchTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: Scheduled for Dispatch`,
        html: emailHtml,
      });

      this.logger.log(`✅ Scheduled for Dispatch email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send Scheduled for Dispatch email: ${error.message}`);
      throw error;
    }
  }

  async sendOnItsWayEmail(
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    try {
      const emailHtml = await this.generateOnItsWayTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: On Its Way to You`,
        html: emailHtml,
      });

      this.logger.log(`✅ On Its Way email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send On Its Way email: ${error.message}`);
      throw error;
    }
  }

  async sendDeliveredEmail(order: Order & { items: OrderItem[] }): Promise<void> {
    try {
      const emailHtml = await this.generateDeliveredTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: Delivered`,
        html: emailHtml,
      });

      this.logger.log(`✅ Delivered email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send Delivered email: ${error.message}`);
      throw error;
    }
  }

  async sendOrderClosedEmail(order: Order & { items: OrderItem[] }): Promise<void> {
    try {
      const emailHtml = await this.generateOrderClosedTemplate(order);

      const fromEmail = process.env.SMTP_USER || 'noreply@lux-store.eu';

      await this.transporter.sendMail({
        from: `"LUX STORE - Concierge Service" <${fromEmail}>`,
        to: order.customer_email,
        subject: `LUX STORE - ORDER: ${order.id} - STATUS: Order Closed`,
        html: emailHtml,
      });

      this.logger.log(`✅ Order Closed email sent to ${order.customer_email} for order ${order.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send Order Closed email: ${error.message}`);
      throw error;
    }
  }

  private async generatePaymentConfirmedTemplate(order: Order & { items: OrderItem[] }): Promise<string> {
    const productIds = order.items.map(item => item.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });

    const skuMap = new Map(products.map(p => [p.id, p.sku]));

    const itemsHtml = order.items
      .map(
        (item) => {
          const sku = item.sku || skuMap.get(item.product_id) || 'N/A';
          return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e5e5;">
            <div style="font-family: 'Georgia', serif; font-size: 15px; color: #1a1a1a; margin-bottom: 8px; font-weight: 500;">
              ${item.product_name}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 13px; color: #666; margin-bottom: 4px;">
              SKU: ${sku}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; font-weight: 500;">
              €${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VAT incl. (20%)
            </div>
          </td>
        </tr>
      `;
        }
      )
      .join('');

    const address2Line = order.shipping_address_2 ? `${order.shipping_address_2}<br>` : '';
    const stateLine = order.shipping_state ? `${order.shipping_state}, ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed - LUX STORE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica', 'Arial', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 40px 0; text-align: center; border-bottom: 2px solid #1a1a1a;">
              <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 32px; font-weight: 400; color: #1a1a1a; letter-spacing: 3px;">
                LUX STORE
              </h1>
              <p style="margin: 12px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 11px; color: #666; letter-spacing: 1.5px; text-transform: uppercase;">
                Concierge Service
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 50px 0 30px 0;">
              <p style="margin: 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Dear Valued Client,
              </p>
            </td>
          </tr>

          <!-- Main Message -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                We truly appreciate your trust in LUX STORE and are delighted to confirm that your order has been successfully placed and paid.
                It is our pleasure to accompany you on this experience and ensure everything is handled with the highest level of care.
              </p>
            </td>
          </tr>

          <!-- Order Summary Box -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa; border: 1px solid #e5e5e5;">
                <tr>
                  <td style="padding: 35px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 25px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            Order Number
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Georgia', serif; font-size: 20px; color: #1a1a1a; font-weight: 500;">
                            ${order.id}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 25px 0 0 0;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            New Order Status
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 16px; color: #1a1a1a; font-weight: 600;">
                            Payment Confirmed
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Concierge Message -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                Our concierge team will now proceed to prepare your order with the utmost attention to detail.
              </p>
            </td>
          </tr>

          <!-- Order Details Title -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <h2 style="margin: 0; font-family: 'Georgia', serif; font-size: 22px; color: #1a1a1a; font-weight: 400; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; letter-spacing: 1px;">
                Order Details
              </h2>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Delivery Address -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Address
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.7;">
                      ${order.customer_first_name} ${order.customer_last_name}<br>
                      ${order.shipping_address_1}<br>
                      ${address2Line}
                      ${order.shipping_city}, ${stateLine}${order.shipping_postal_code}<br>
                      ${order.shipping_country}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Method -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Method
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #1a1a1a; font-weight: 600;">
                      DHL Express
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 0 40px 0; border-top: 1px solid #e5e5e5;">
            </td>
          </tr>

          <!-- Updates Notice -->
          <tr>
            <td style="padding: 0 0 35px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                You will receive individual email updates as your order is prepared and when it is dispatched.
              </p>
            </td>
          </tr>

          <!-- Tracking Section -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                You can track the details of your order in real time using the link provided, along with your order number and the email address used at checkout:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="https://lux-store.eu/track" style="display: inline-block; padding: 18px 55px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-family: 'Helvetica', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">
                      TRACK YOUR ORDER
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Message -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                If you have any additional questions or require personal assistance, our concierge team remains at your full disposal.
              </p>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding: 0 0 60px 0;">
              <p style="margin: 0 0 8px 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Thank you once again for choosing LUX STORE.
              </p>
              <p style="margin: 20px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #666; line-height: 1.7;">
                Warm regards,<br>
                <strong style="color: #1a1a1a; font-weight: 600;">LUX STORE - Concierge Service</strong><br>
                LUX TRADE L.P.<br>
                <a href="https://www.lux-store.eu" style="color: #1a1a1a; text-decoration: none; font-weight: 500;">www.lux-store.eu</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0 0 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                This email and any attachments are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete it from your system. Any unauthorised use, disclosure, copying, or distribution is strictly prohibited.
              </p>
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                LUX STORE is operated by LUX TRADE L.P., a company registered in the United Kingdom. We are committed to handling your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                To learn more about how we collect, use and protect your personal information, please see our <a href="https://lux-store.eu/privacy" style="color: #666; text-decoration: underline;">Privacy Policy</a> and <a href="https://lux-store.eu/terms" style="color: #666; text-decoration: underline;">Terms & Conditions</a>.
              </p>
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                2025 © LUX TRADE L.P. – All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private async generateUnderReviewTemplate(order: Order & { items: OrderItem[] }): Promise<string> {
    const productIds = order.items.map(item => item.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });

    const skuMap = new Map(products.map(p => [p.id, p.sku]));

    const itemsHtml = order.items
      .map(
        (item) => {
          const sku = item.sku || skuMap.get(item.product_id) || 'N/A';
          return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e5e5;">
            <div style="font-family: 'Georgia', serif; font-size: 15px; color: #1a1a1a; margin-bottom: 8px; font-weight: 500;">
              ${item.product_name}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 13px; color: #666; margin-bottom: 4px;">
              SKU: ${sku}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; font-weight: 500;">
              €${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VAT incl. (20%)
            </div>
          </td>
        </tr>
      `;
        }
      )
      .join('');

    const address2Line = order.shipping_address_2 ? `${order.shipping_address_2}<br>` : '';
    const stateLine = order.shipping_state ? `${order.shipping_state}, ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Under Review - LUX STORE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica', 'Arial', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 40px 0; text-align: center; border-bottom: 2px solid #1a1a1a;">
              <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 32px; font-weight: 400; color: #1a1a1a; letter-spacing: 3px;">
                LUX STORE
              </h1>
              <p style="margin: 12px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 11px; color: #666; letter-spacing: 1.5px; text-transform: uppercase;">
                Concierge Service
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 50px 0 30px 0;">
              <p style="margin: 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Dear Valued Client,
              </p>
            </td>
          </tr>

          <!-- Main Message -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                Your order is being reviewed by our concierge team. We are validating item availability, quality, and packaging requirements to ensure a flawless experience.
              </p>
            </td>
          </tr>

          <!-- Order Summary Box -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa; border: 1px solid #e5e5e5;">
                <tr>
                  <td style="padding: 35px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 25px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            Order Number
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Georgia', serif; font-size: 20px; color: #1a1a1a; font-weight: 500;">
                            ${order.id}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 25px 0 0 0;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            New Order Status
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 16px; color: #1a1a1a; font-weight: 600;">
                            Under Review
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Details Title -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <h2 style="margin: 0; font-family: 'Georgia', serif; font-size: 22px; color: #1a1a1a; font-weight: 400; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; letter-spacing: 1px;">
                Order Details
              </h2>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Delivery Address -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Address
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.7;">
                      ${order.customer_first_name} ${order.customer_last_name}<br>
                      ${order.shipping_address_1}<br>
                      ${address2Line}
                      ${order.shipping_city}, ${stateLine}${order.shipping_postal_code}<br>
                      ${order.shipping_country}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Method -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Method
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #1a1a1a; font-weight: 600;">
                      DHL Express
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 0 40px 0; border-top: 1px solid #e5e5e5;">
            </td>
          </tr>

          <!-- Tracking Section -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                You can track the details of your order in real time using the link provided, along with your order number and the email address used at checkout:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="https://lux-store.eu/track" style="display: inline-block; padding: 18px 55px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-family: 'Helvetica', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">
                      TRACK YOUR ORDER
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Message -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                If you have any additional questions or require personal assistance, our concierge team remains at your full disposal.
              </p>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding: 0 0 60px 0;">
              <p style="margin: 0 0 8px 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Thank you once again for choosing LUX STORE.
              </p>
              <p style="margin: 20px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #666; line-height: 1.7;">
                Warm regards,<br>
                <strong style="color: #1a1a1a; font-weight: 600;">LUX STORE - Concierge Service</strong><br>
                LUX TRADE L.P.<br>
                <a href="https://www.lux-store.eu" style="color: #1a1a1a; text-decoration: none; font-weight: 500;">www.lux-store.eu</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0 0 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                This email and any attachments are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete it from your system. Any unauthorised use, disclosure, copying, or distribution is strictly prohibited.
              </p>
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                LUX STORE is operated by LUX TRADE L.P., a company registered in the United Kingdom. We are committed to handling your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                To learn more about how we collect, use and protect your personal information, please see our <a href="https://lux-store.eu/privacy" style="color: #666; text-decoration: underline;">Privacy Policy</a> and <a href="https://lux-store.eu/terms" style="color: #666; text-decoration: underline;">Terms & Conditions</a>.
              </p>
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                2025 © LUX TRADE L.P. – All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private async generateStatusUpdateTemplate(
    order: Order & { items: OrderItem[] },
    statusTitle: string,
    statusMessage: string,
  ): Promise<string> {
    const productIds = order.items.map(item => item.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });

    const skuMap = new Map(products.map(p => [p.id, p.sku]));

    const itemsHtml = order.items
      .map(
        (item) => {
          const sku = item.sku || skuMap.get(item.product_id) || 'N/A';
          return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e5e5;">
            <div style="font-family: 'Georgia', serif; font-size: 15px; color: #1a1a1a; margin-bottom: 8px; font-weight: 500;">
              ${item.product_name}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 13px; color: #666; margin-bottom: 4px;">
              SKU: ${sku}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; font-weight: 500;">
              €${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VAT incl. (20%)
            </div>
          </td>
        </tr>
      `;
        }
      )
      .join('');

    const address2Line = order.shipping_address_2 ? `${order.shipping_address_2}<br>` : '';
    const stateLine = order.shipping_state ? `${order.shipping_state}, ` : '';

    const trackingSection = order.tracking_number ? `
          <tr>
            <td style="padding: 0 0 40px 0; background-color: #fafafa; border: 1px solid #e5e5e5;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 30px;">
                    <p style="margin: 0 0 10px 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Tracking Number
                    </p>
                    <p style="margin: 0 0 15px 0; font-family: 'Georgia', serif; font-size: 24px; color: #1a1a1a; font-weight: 500; letter-spacing: 1px;">
                      ${order.tracking_number}
                    </p>
                    ${order.tracking_url ? `
                    <a href="${order.tracking_url}" style="display: inline-block; padding: 12px 30px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-family: 'Helvetica', sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">
                      TRACK SHIPMENT
                    </a>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 40px 0; border-top: 1px solid #e5e5e5;">
            </td>
          </tr>
    ` : `
          <!-- Divider -->
          <tr>
            <td style="padding: 0 0 40px 0; border-top: 1px solid #e5e5e5;">
            </td>
          </tr>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusTitle} - LUX STORE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica', 'Arial', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 40px 0; text-align: center; border-bottom: 2px solid #1a1a1a;">
              <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 32px; font-weight: 400; color: #1a1a1a; letter-spacing: 3px;">
                LUX STORE
              </h1>
              <p style="margin: 12px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 11px; color: #666; letter-spacing: 1.5px; text-transform: uppercase;">
                Concierge Service
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 50px 0 30px 0;">
              <p style="margin: 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Dear Valued Client,
              </p>
            </td>
          </tr>

          <!-- Main Message -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                ${statusMessage}
              </p>
            </td>
          </tr>

          <!-- Order Summary Box -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa; border: 1px solid #e5e5e5;">
                <tr>
                  <td style="padding: 35px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 25px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            Order Number
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Georgia', serif; font-size: 20px; color: #1a1a1a; font-weight: 500;">
                            ${order.id}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 25px 0 0 0;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            New Order Status
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 16px; color: #1a1a1a; font-weight: 600;">
                            ${statusTitle}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Details Title -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <h2 style="margin: 0; font-family: 'Georgia', serif; font-size: 22px; color: #1a1a1a; font-weight: 400; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; letter-spacing: 1px;">
                Order Details
              </h2>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Delivery Address -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Address
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.7;">
                      ${order.customer_first_name} ${order.customer_last_name}<br>
                      ${order.shipping_address_1}<br>
                      ${address2Line}
                      ${order.shipping_city}, ${stateLine}${order.shipping_postal_code}<br>
                      ${order.shipping_country}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Method -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Method
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #1a1a1a; font-weight: 600;">
                      DHL Express
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${trackingSection}

          <!-- Tracking Link -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                You can track the details of your order in real time using the link provided, along with your order number and the email address used at checkout:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="https://lux-store.eu/track" style="display: inline-block; padding: 18px 55px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-family: 'Helvetica', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">
                      TRACK YOUR ORDER
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Message -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                If you have any additional questions or require personal assistance, our concierge team remains at your full disposal.
              </p>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding: 0 0 60px 0;">
              <p style="margin: 0 0 8px 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Thank you once again for choosing LUX STORE.
              </p>
              <p style="margin: 20px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #666; line-height: 1.7;">
                Warm regards,<br>
                <strong style="color: #1a1a1a; font-weight: 600;">LUX STORE - Concierge Service</strong><br>
                LUX TRADE L.P.<br>
                <a href="https://www.lux-store.eu" style="color: #1a1a1a; text-decoration: none; font-weight: 500;">www.lux-store.eu</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0 0 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                This email and any attachments are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete it from your system. Any unauthorised use, disclosure, copying, or distribution is strictly prohibited.
              </p>
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                LUX STORE is operated by LUX TRADE L.P., a company registered in the United Kingdom. We are committed to handling your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                To learn more about how we collect, use and protect your personal information, please see our <a href="https://lux-store.eu/privacy" style="color: #666; text-decoration: underline;">Privacy Policy</a> and <a href="https://lux-store.eu/terms" style="color: #666; text-decoration: underline;">Terms & Conditions</a>.
              </p>
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                2025 © LUX TRADE L.P. – All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private async generateBeingPreparedTemplate(order: Order & { items: OrderItem[] }): Promise<string> {
    return this.generateStatusUpdateTemplate(
      order,
      'Being Prepared',
      'Your order is now being carefully prepared by our concierge team. Each item is inspected, assembled, and packaged with precision to meet the standards of a premium Maison.'
    );
  }

  private async generateScheduledForDispatchTemplate(order: Order & { items: OrderItem[] }): Promise<string> {
    return this.generateStatusUpdateTemplate(
      order,
      'Scheduled for Dispatch',
      'Your order is ready and scheduled for dispatch. Our logistics partners will ensure secure handling and a smooth delivery to your chosen destination.'
    );
  }

  private async generateOnItsWayTemplate(order: Order & { items: OrderItem[] }): Promise<string> {
    return this.generateStatusUpdateTemplate(
      order,
      'On Its Way to You',
      'Your order has been dispatched and is now on its way to you. You may track its journey at any time using the tracking details provided.'
    );
  }

  private async generateDeliveredTemplate(order: Order & { items: OrderItem[] }): Promise<string> {

    const productIds = order.items.map(item => item.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });


    const skuMap = new Map(products.map(p => [p.id, p.sku]));

    const itemsHtml = order.items
      .map(
        (item) => {
          const sku = item.sku || skuMap.get(item.product_id) || 'N/A';
          return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e5e5;">
            <div style="font-family: 'Georgia', serif; font-size: 15px; color: #1a1a1a; margin-bottom: 8px; font-weight: 500;">
              ${item.product_name}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 13px; color: #666; margin-bottom: 4px;">
              SKU: ${sku}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; font-weight: 500;">
              €${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VAT incl. (20%)
            </div>
          </td>
        </tr>
      `;
        }
      )
      .join('');

    const address2Line = order.shipping_address_2 ? `${order.shipping_address_2}<br>` : '';
    const stateLine = order.shipping_state ? `${order.shipping_state}, ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivered - LUX STORE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica', 'Arial', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 40px 0; text-align: center; border-bottom: 2px solid #1a1a1a;">
              <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 32px; font-weight: 400; color: #1a1a1a; letter-spacing: 3px;">
                LUX STORE
              </h1>
              <p style="margin: 12px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 11px; color: #666; letter-spacing: 1.5px; text-transform: uppercase;">
                Concierge Service
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 50px 0 30px 0;">
              <p style="margin: 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Dear Valued Client,
              </p>
            </td>
          </tr>

          <!-- Main Message -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                We are delighted to inform you that your order has been successfully delivered.
                Thank you for choosing LUX STORE — it is our privilege to assist you in acquiring exceptional pieces from the world's most distinguished luxury houses.
              </p>
            </td>
          </tr>

          <!-- Order Summary Box -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa; border: 1px solid #e5e5e5;">
                <tr>
                  <td style="padding: 35px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 25px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            Order Number
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Georgia', serif; font-size: 20px; color: #1a1a1a; font-weight: 500;">
                            ${order.id}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 25px 0 0 0;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            New Order Status
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 16px; color: #1a1a1a; font-weight: 600;">
                            Delivered
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Details Title -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <h2 style="margin: 0; font-family: 'Georgia', serif; font-size: 22px; color: #1a1a1a; font-weight: 400; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; letter-spacing: 1px;">
                Order Details
              </h2>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Delivery Address -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Address
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.7;">
                      ${order.customer_first_name} ${order.customer_last_name}<br>
                      ${order.shipping_address_1}<br>
                      ${address2Line}
                      ${order.shipping_city}, ${stateLine}${order.shipping_postal_code}<br>
                      ${order.shipping_country}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Appreciation Message -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                We truly appreciate your trust and the opportunity to accompany you on your journey into refined elegance. Should you require any further assistance — whether regarding your recent purchase or a future request — our Concierge Service remains at your full disposal.
              </p>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding: 0 0 60px 0;">
              <p style="margin: 20px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #666; line-height: 1.7;">
                Warm regards,<br>
                <strong style="color: #1a1a1a; font-weight: 600;">LUX STORE - Concierge Service</strong><br>
                LUX TRADE L.P.<br>
                <a href="https://www.lux-store.eu" style="color: #1a1a1a; text-decoration: none; font-weight: 500;">www.lux-store.eu</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0 0 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                This email and any attachments are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete it from your system. Any unauthorised use, disclosure, copying, or distribution is strictly prohibited.
              </p>
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                LUX STORE is operated by LUX TRADE L.P., a company registered in the United Kingdom. We are committed to handling your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                To learn more about how we collect, use and protect your personal information, please see our <a href="https://lux-store.eu/privacy" style="color: #666; text-decoration: underline;">Privacy Policy</a> and <a href="https://lux-store.eu/terms" style="color: #666; text-decoration: underline;">Terms & Conditions</a>.
              </p>
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                2025 © LUX TRADE L.P. – All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private async generateOrderClosedTemplate(order: Order & { items: OrderItem[] }): Promise<string> {

    const productIds = order.items.map(item => item.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });


    const skuMap = new Map(products.map(p => [p.id, p.sku]));

    const itemsHtml = order.items
      .map(
        (item) => {
          const sku = item.sku || skuMap.get(item.product_id) || 'N/A';
          return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e5e5;">
            <div style="font-family: 'Georgia', serif; font-size: 15px; color: #1a1a1a; margin-bottom: 8px; font-weight: 500;">
              ${item.product_name}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 13px; color: #666; margin-bottom: 4px;">
              SKU: ${sku}
            </div>
            <div style="font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; font-weight: 500;">
              €${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VAT incl. (20%)
            </div>
          </td>
        </tr>
      `;
        }
      )
      .join('');

    const address2Line = order.shipping_address_2 ? `${order.shipping_address_2}<br>` : '';
    const stateLine = order.shipping_state ? `${order.shipping_state}, ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Closed - LUX STORE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica', 'Arial', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 40px 0; text-align: center; border-bottom: 2px solid #1a1a1a;">
              <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 32px; font-weight: 400; color: #1a1a1a; letter-spacing: 3px;">
                LUX STORE
              </h1>
              <p style="margin: 12px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 11px; color: #666; letter-spacing: 1.5px; text-transform: uppercase;">
                Concierge Service
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 50px 0 30px 0;">
              <p style="margin: 0; font-family: 'Georgia', serif; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                Dear Valued Client,
              </p>
            </td>
          </tr>

          <!-- Main Message -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                Your order has been closed.
                If this was done in error or if you wish to place a new request, our concierge team is always here to assist you.
              </p>
            </td>
          </tr>

          <!-- Order Summary Box -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa; border: 1px solid #e5e5e5;">
                <tr>
                  <td style="padding: 35px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 25px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            Order Number
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Georgia', serif; font-size: 20px; color: #1a1a1a; font-weight: 500;">
                            ${order.id}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 25px 0 0 0;">
                          <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                            New Order Status
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 16px; color: #1a1a1a; font-weight: 600;">
                            Closed
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Details Title -->
          <tr>
            <td style="padding: 0 0 25px 0;">
              <h2 style="margin: 0; font-family: 'Georgia', serif; font-size: 22px; color: #1a1a1a; font-weight: 400; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; letter-spacing: 1px;">
                Order Details
              </h2>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Delivery Address -->
          <tr>
            <td style="padding: 0 0 50px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px;">
                      Delivery Address
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.7;">
                      ${order.customer_first_name} ${order.customer_last_name}<br>
                      ${order.shipping_address_1}<br>
                      ${address2Line}
                      ${order.shipping_city}, ${stateLine}${order.shipping_postal_code}<br>
                      ${order.shipping_country}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Message -->
          <tr>
            <td style="padding: 0 0 45px 0;">
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
                If you have any additional questions or require personal assistance, our concierge team remains at your full disposal.
                Thank you once again for choosing LUX STORE.
              </p>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding: 0 0 60px 0;">
              <p style="margin: 20px 0 0 0; font-family: 'Helvetica', sans-serif; font-size: 14px; color: #666; line-height: 1.7;">
                Warm regards,<br>
                <strong style="color: #1a1a1a; font-weight: 600;">LUX STORE - Concierge Service</strong><br>
                LUX TRADE L.P.<br>
                <a href="https://www.lux-store.eu" style="color: #1a1a1a; text-decoration: none; font-weight: 500;">www.lux-store.eu</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0 0 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                This email and any attachments are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete it from your system. Any unauthorised use, disclosure, copying, or distribution is strictly prohibited.
              </p>
              <p style="margin: 0 0 20px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                LUX STORE is operated by LUX TRADE L.P., a company registered in the United Kingdom. We are committed to handling your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <p style="margin: 0 0 25px 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; line-height: 1.6;">
                To learn more about how we collect, use and protect your personal information, please see our <a href="https://lux-store.eu/privacy" style="color: #666; text-decoration: underline;">Privacy Policy</a> and <a href="https://lux-store.eu/terms" style="color: #666; text-decoration: underline;">Terms & Conditions</a>.
              </p>
              <p style="margin: 0; font-family: 'Helvetica', sans-serif; font-size: 10px; color: #999; text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                2025 © LUX TRADE L.P. – All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
