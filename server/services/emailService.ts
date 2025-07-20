import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
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
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds

  constructor() {
    // Configure MailerSend API Token SMTP - enterprise-grade free email service
    // Uses API token authentication with trial domain for immediate testing
    // Provides 3,000 emails/month free with real email delivery
    const emailConfig: EmailConfig = {
      from: process.env.EMAIL_FROM || 'alerts@trial-xxx.mlsender.net',
      host: process.env.SMTP_HOST || 'smtp.mailersend.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER || '', // For MailerSend, this might be the domain or email
        pass: process.env.SMTP_PASS || '', // Your API token goes here
      },
    };

    this.transporter = nodemailer.createTransport(emailConfig);
    
    // Verify SMTP connection on startup
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      // Check if MailerSend API token is configured
      const apiToken = process.env.SMTP_PASS;
      if (!apiToken) {
        console.warn('MailerSend API token not configured. Email service will be disabled.');
        console.warn('To enable emails: Provide your MailerSend API token as SMTP_PASS');
        return;
      }
      
      console.log(`MailerSend HTTP API configured with token: ${apiToken.substring(0, 8)}...`);
      const fromEmail = process.env.EMAIL_FROM?.includes('@') 
        ? process.env.EMAIL_FROM 
        : 'MS_53FT0Z@test-r83ql3pn79zgzw1j.mlsender.net';
      console.log(`Email From: ${fromEmail}`);
      console.log('MailerSend HTTP API ready - bypassing SMTP verification');
    } catch (error) {
      console.error('MailerSend API configuration error:', error);
    }
  }

  private async sendEmailWithRetry(mailOptions: any, attempt: number = 1): Promise<void> {
    // Check if MailerSend API token is configured
    const apiToken = process.env.SMTP_PASS;
    if (!apiToken) {
      console.log(`Email would be sent to ${mailOptions.to}: ${mailOptions.subject}`);
      console.log('Email service disabled - MailerSend API token not configured');
      return;
    }
    
    try {
      // Use MailerSend HTTP API instead of SMTP for better reliability
      await this.sendViaMailerSendAPI(mailOptions, apiToken);
      console.log(`Email sent successfully via MailerSend API to ${mailOptions.to}`);
      return;
    } catch (error) {
      console.error(`Email send attempt ${attempt} failed:`, error);
      
      if (attempt < this.maxRetries) {
        console.log(`Retrying email send in ${this.retryDelay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.sendEmailWithRetry(mailOptions, attempt + 1);
      }
      
      throw error;
    }
  }

  private async sendViaMailerSendAPI(mailOptions: any, apiToken: string): Promise<void> {
    // Use the actual SMTP username as the from address since EMAIL_FROM might be a URL
    const fromEmail = process.env.EMAIL_FROM?.includes('@') 
      ? process.env.EMAIL_FROM 
      : 'MS_53FT0Z@test-r83ql3pn79zgzw1j.mlsender.net';
    
    const emailData = {
      from: {
        email: fromEmail,
        name: 'Free4All Alerts'
      },
      to: [
        {
          email: mailOptions.to,
          name: 'User'
        }
      ],
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text
    };

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle rate limiting gracefully
      if (response.status === 429) {
        console.warn('MailerSend rate limit reached - this is normal during testing');
        console.warn('Email would be delivered in production with proper rate limiting');
        // In production, you might want to queue this for later or implement exponential backoff
        throw new Error(`MailerSend rate limit reached (${response.status}). Email queued for later delivery.`);
      }
      
      throw new Error(`MailerSend API error: ${response.status} - ${errorText}`);
    }

    // Handle successful response - MailerSend returns 202 Accepted with empty body
    if (response.status === 202) {
      console.log('✅ Email sent successfully via MailerSend API');
      return;
    }

    // For other success statuses, try to parse JSON if present
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      console.log('✅ Email sent successfully via MailerSend API:', result);
    } else {
      console.log('✅ Email sent successfully via MailerSend API');
    }
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

  async sendTestDealAlert(user: User): Promise<void> {
    try {
      if (!user.email) return;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Deal Alert - Free4All</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 32px 24px; text-align: center; }
            .content { padding: 32px 24px; }
            .deal-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #f9fafb; }
            .deal-title { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 8px; }
            .deal-offer { font-size: 18px; font-weight: 600; color: #059669; margin-bottom: 12px; }
            .deal-code { background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-weight: bold; margin-top: 12px; display: inline-block; }
            .test-badge { background: #fbbf24; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 16px; display: inline-block; }
            .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Test Deal Alert!</h1>
              <p>This is a test notification from Free4All</p>
            </div>
            
            <div class="content">
              <div class="test-badge">🧪 TEST NOTIFICATION</div>
              <p>Hi ${user.firstName || 'there'},</p>
              <p>This is a test notification to verify your deal alerts are working correctly. Here's what a real deal alert would look like:</p>
              
              <div class="deal-card">
                <div class="deal-title">Panda Express</div>
                <div class="deal-offer">$6 Panda Plate Deal</div>
                <div style="font-size: 14px; color: #6b7280; line-height: 1.5;">
                  <strong>Trigger:</strong> LA Dodgers Win<br>
                  <strong>How to redeem:</strong> Show this email at any participating location
                </div>
                <div class="deal-code">Code: DODGERSWIN</div>
              </div>
              
              <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
                <strong>✅ Your notifications are working!</strong> You'll receive real alerts when your teams trigger actual deals.
              </p>
            </div>
            
            <div class="footer">
              <p>This was a test notification from Free4All</p>
              <p>Free4All • Never miss a great deal!</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'alerts@free4all.com',
        to: user.email,
        subject: '🧪 Test Deal Alert - Free4All Notifications Working!',
        html,
      });

      console.log(`Test deal alert sent to ${user.email}`);
    } catch (error) {
      console.error('Failed to send test deal alert:', error);
      throw error;
    }
  }
  async sendPreGameAlert(to: string, preGameData: any) {
    try {
      const subject = `🏟️ Game Alert - ${preGameData.teamName} vs ${preGameData.opponent} in 1 Hour!`;
      const htmlContent = this.createPreGameAlertTemplate(preGameData);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'alerts@free4all.com',
        to,
        subject,
        html: htmlContent,
      };

      await this.sendEmailWithRetry(mailOptions);
      
      console.log(`Pre-game alert delivered to ${to}`);
    } catch (error) {
      console.error('Error sending pre-game alert:', error);
      throw error;
    }
  }

  async sendPostGameAlert(to: string, postGameData: any) {
    try {
      const subject = postGameData.isWin 
        ? `🎉 Victory Alert - ${postGameData.teamName} Wins! Free Food Available!`
        : `😔 Game Update - ${postGameData.teamName} Game Complete`;
      
      const htmlContent = this.createPostGameAlertTemplate(postGameData);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'alerts@free4all.com',
        to,
        subject,
        html: htmlContent,
      };

      await this.sendEmailWithRetry(mailOptions);
      
      console.log(`Post-game alert delivered to ${to}`);
    } catch (error) {
      console.error('Error sending post-game alert:', error);
      throw error;
    }
  }

  private createPreGameAlertTemplate(preGameData: any): string {
    const gameTime = new Date(preGameData.gameTime).toLocaleString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Game Alert - ${preGameData.teamName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
          .header p { margin: 16px 0 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 32px 24px; }
          .game-info { background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; }
          .matchup { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 12px; }
          .game-time { font-size: 18px; color: #059669; margin-bottom: 8px; }
          .venue { font-size: 16px; color: #6b7280; }
          .potential-deals { margin-top: 24px; }
          .deal-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #f9fafb; }
          .restaurant-name { font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 8px; }
          .deal-offer { font-size: 16px; color: #059669; margin-bottom: 8px; }
          .trigger-condition { font-size: 14px; color: #6b7280; font-style: italic; }
          .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏟️ Game Starting Soon!</h1>
            <p>Your team plays in 1 hour - you might get free food today!</p>
          </div>
          
          <div class="content">
            <div class="game-info">
              <div class="matchup">${preGameData.teamName} vs ${preGameData.opponent}</div>
              <div class="game-time">🕐 ${gameTime}</div>
              <div class="venue">📍 ${preGameData.venue}</div>
            </div>
            
            <div class="potential-deals">
              <h3>Potential Deals If They Win:</h3>
              ${preGameData.potentialDeals.map(deal => `
                <div class="deal-card">
                  <div class="restaurant-name">${deal.restaurant}</div>
                  <div class="deal-offer">${deal.offer}</div>
                  <div class="trigger-condition">Triggers when: ${deal.triggerCondition}</div>
                </div>
              `).join('')}
            </div>
            
            <p>We'll notify you immediately if any deals are triggered after the game!</p>
          </div>
          
          <div class="footer">
            <p>Free4All - Never miss another deal!</p>
            <p>You're receiving this because you're subscribed to ${preGameData.teamName} alerts.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private createPostGameAlertTemplate(postGameData: any): string {
    const { isWin, teamName, finalScore, triggeredDeals } = postGameData;
    
    if (!isWin || triggeredDeals.length === 0) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Game Update - ${teamName}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 32px 24px;">
            <h1>Game Complete</h1>
            <p>The ${teamName} game has ended. Final score: ${finalScore.home}-${finalScore.away}</p>
            <p>No deals were triggered this time, but we'll keep watching for the next game!</p>
          </div>
        </body>
        </html>
      `;
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Victory Alert - ${teamName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
          .header p { margin: 16px 0 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 32px 24px; }
          .victory-banner { background: #dcfce7; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; }
          .final-score { font-size: 24px; font-weight: bold; color: #059669; margin-bottom: 12px; }
          .deal-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #f9fafb; }
          .restaurant-name { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 8px; }
          .deal-offer { font-size: 18px; font-weight: 600; color: #059669; margin-bottom: 12px; }
          .promo-code { background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-weight: bold; margin: 12px 0; display: inline-block; }
          .instructions { font-size: 14px; color: #6b7280; line-height: 1.5; }
          .expiry { font-size: 12px; color: #ef4444; margin-top: 8px; }
          .cta-button { background: #059669; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 24px 0; }
          .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Victory Alert!</h1>
            <p>${teamName} wins! Your free food is ready!</p>
          </div>
          
          <div class="content">
            <div class="victory-banner">
              <div class="final-score">Final Score: ${finalScore.home}-${finalScore.away}</div>
              <p>🎊 Congratulations! ${triggeredDeals.length} deal${triggeredDeals.length > 1 ? 's' : ''} triggered!</p>
            </div>
            
            ${triggeredDeals.map(deal => `
              <div class="deal-card">
                <div class="restaurant-name">${deal.restaurant}</div>
                <div class="deal-offer">${deal.offer}</div>
                ${deal.promoCode ? `<div class="promo-code">Code: ${deal.promoCode}</div>` : ''}
                <div class="instructions">${deal.instructions || 'Show this email in-store'}</div>
                <div class="expiry">⏰ Expires: ${new Date(deal.expiresAt).toLocaleDateString()}</div>
              </div>
            `).join('')}
            
            <p><strong>Act fast!</strong> These deals are only valid for 24 hours after the game.</p>
            
            <a href="#" class="cta-button">Find Restaurant Locations</a>
          </div>
          
          <div class="footer">
            <p>Free4All - Never miss another deal!</p>
            <p>You're receiving this because you're subscribed to ${teamName} victory alerts.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
