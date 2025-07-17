import nodemailer from 'nodemailer';
import { storage } from '../storage';
import type { TriggeredDeal, User, Promotion, Restaurant, Team } from '@shared/schema';

interface EmailConfig {
  from: string;
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const emailConfig: EmailConfig = {
      from: process.env.EMAIL_FROM || 'alerts@free4all.com',
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || '',
      },
    };

    // If custom SMTP settings are provided
    if (process.env.SMTP_HOST) {
      emailConfig.host = process.env.SMTP_HOST;
      emailConfig.port = parseInt(process.env.SMTP_PORT || '587');
      emailConfig.secure = process.env.SMTP_SECURE === 'true';
      delete emailConfig.service;
    }

    this.transporter = nodemailer.createTransport(emailConfig);
  }

  async sendDealAlert(userId: string, triggeredDeals: TriggeredDeal[]): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        throw new Error('User not found or no email address');
      }

      // Get deal details with related data
      const dealDetails = await Promise.all(
        triggeredDeals.map(async (deal) => {
          const promotion = await storage.getPromotion(deal.promotionId!);
          const restaurant = promotion ? await storage.getRestaurant(promotion.restaurantId!) : null;
          const team = promotion ? await storage.getTeam(promotion.teamId!) : null;
          return { deal, promotion, restaurant, team };
        })
      );

      const validDeals = dealDetails.filter(d => d.promotion && d.restaurant && d.team);

      if (validDeals.length === 0) {
        return;
      }

      const teamName = validDeals[0].team!.name;
      const subject = `🎉 Free Food Alert: ${teamName} Triggered ${validDeals.length} Deal${validDeals.length > 1 ? 's' : ''}!`;

      const html = this.generateDealAlertHTML(user, validDeals);
      const text = this.generateDealAlertText(user, validDeals);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'alerts@free4all.com',
        to: user.email,
        subject,
        html,
        text,
      });

      // Record alert history
      for (const { deal } of validDeals) {
        await storage.createAlertHistory({
          userId,
          triggeredDealId: deal.id,
          alertType: 'email',
          status: 'sent',
        });
      }

      console.log(`Deal alert sent to ${user.email} for ${validDeals.length} deals`);
    } catch (error) {
      console.error('Failed to send deal alert:', error);
      
      // Record failed alert
      for (const deal of triggeredDeals) {
        await storage.createAlertHistory({
          userId,
          triggeredDealId: deal.id,
          alertType: 'email',
          status: 'failed',
        });
      }
      
      throw error;
    }
  }

  private generateDealAlertHTML(user: User, dealDetails: any[]): string {
    const teamName = dealDetails[0].team.name;
    const dealsCount = dealDetails.length;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Free Food Alert - ${teamName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
          .header p { margin: 16px 0 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 32px 24px; }
          .deal-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #f9fafb; }
          .deal-title { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 8px; }
          .deal-offer { font-size: 18px; font-weight: 600; color: #059669; margin-bottom: 12px; }
          .deal-details { font-size: 14px; color: #6b7280; line-height: 1.5; }
          .deal-code { background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-weight: bold; margin-top: 12px; display: inline-block; }
          .cta-button { background: #1e40af; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 24px 0; }
          .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Free Food Alert!</h1>
            <p>Great news! The ${teamName} triggered ${dealsCount} deal${dealsCount > 1 ? 's' : ''} for you!</p>
          </div>
          
          <div class="content">
            <p>Hi ${user.firstName || 'there'},</p>
            <p>Your favorite team just earned you some free food! Here ${dealsCount > 1 ? 'are' : 'is'} your active deal${dealsCount > 1 ? 's' : ''}:</p>
            
            ${dealDetails.map(({ promotion, restaurant }) => `
              <div class="deal-card">
                <div class="deal-title">${restaurant.name}</div>
                <div class="deal-offer">${promotion.offerValue}</div>
                <div class="deal-details">
                  <strong>Trigger:</strong> ${promotion.triggerCondition}<br>
                  <strong>How to redeem:</strong> ${promotion.redemptionInstructions}
                </div>
                ${promotion.promoCode ? `<div class="deal-code">Code: ${promotion.promoCode}</div>` : ''}
              </div>
            `).join('')}
            
            <div style="text-align: center;">
              <a href="${process.env.APP_URL || 'https://free4all.com'}" class="cta-button">
                View All Active Deals
              </a>
            </div>
            
            <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
              Remember to claim your deals soon - some offers may have expiration dates!
            </p>
          </div>
          
          <div class="footer">
            <p>You're receiving this because you signed up for ${teamName} deal alerts.</p>
            <p>Free4All • Never miss a great deal!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDealAlertText(user: User, dealDetails: any[]): string {
    const teamName = dealDetails[0].team.name;
    const dealsCount = dealDetails.length;

    let text = `🎉 FREE FOOD ALERT!\n\n`;
    text += `Hi ${user.firstName || 'there'},\n\n`;
    text += `Great news! The ${teamName} triggered ${dealsCount} deal${dealsCount > 1 ? 's' : ''} for you!\n\n`;

    dealDetails.forEach(({ promotion, restaurant }) => {
      text += `${restaurant.name}\n`;
      text += `${promotion.offerValue}\n`;
      text += `Trigger: ${promotion.triggerCondition}\n`;
      text += `How to redeem: ${promotion.redemptionInstructions}\n`;
      if (promotion.promoCode) {
        text += `Code: ${promotion.promoCode}\n`;
      }
      text += `\n`;
    });

    text += `View all active deals: ${process.env.APP_URL || 'https://free4all.com'}\n\n`;
    text += `Remember to claim your deals soon - some offers may have expiration dates!\n\n`;
    text += `You're receiving this because you signed up for ${teamName} deal alerts.\n`;
    text += `Free4All • Never miss a great deal!`;

    return text;
  }

  async sendWelcomeEmail(user: User): Promise<void> {
    try {
      if (!user.email) return;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Free4All</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 32px 24px; text-align: center; }
            .content { padding: 32px 24px; }
            .cta-button { background: #1e40af; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 24px 0; }
            .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍕 Welcome to Free4All!</h1>
              <p>Never miss a free food deal again</p>
            </div>
            
            <div class="content">
              <p>Hi ${user.firstName || 'there'},</p>
              <p>Welcome to Free4All! You're now part of a community that never misses out on free food deals triggered by sports teams.</p>
              
              <p><strong>Here's how it works:</strong></p>
              <ul>
                <li>We monitor your favorite teams' game performance</li>
                <li>When they meet restaurant promotion triggers, you get notified instantly</li>
                <li>Claim your free food before it expires!</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${process.env.APP_URL || 'https://free4all.com'}" class="cta-button">
                  Set Up Your Alert Preferences
                </a>
              </div>
              
              <p>Start by choosing your favorite teams and the restaurants you want to hear about. We'll handle the rest!</p>
            </div>
            
            <div class="footer">
              <p>Free4All • Never miss a great deal!</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'alerts@free4all.com',
        to: user.email,
        subject: '🍕 Welcome to Free4All - Set Up Your Deal Alerts!',
        html,
      });

      console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
}

export const emailService = new EmailService();
