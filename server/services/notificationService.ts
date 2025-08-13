import { emailService } from "./emailService";
import { smsService } from "./smsService";
import { apnsService } from "./apnsService";
import { storage } from "../storage";

interface DealNotificationData {
  userId: string;
  teamName: string;
  gameId: number;
  triggeredDeals: Array<{
    id: number;
    restaurant: string;
    offer: string;
    promoCode?: string;
    expiresAt: string;
  }>;
  expiresAt: string;
  featuredImage?: string;
}

interface GameNotificationData {
  userId: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  venue: string;
  potentialDeals: Array<{
    restaurant: string;
    offer: string;
    trigger: string;
  }>;
}

class NotificationService {
  // Legacy methods for backward compatibility
  async sendPreGameNotifications(email: string, phoneNumber: string, data: any) {
    await emailService.sendPreGameAlert(email, data);
    // SMS disabled - using APNs instead
    console.log('SMS disabled - using APNs for push notifications');
  }

  async sendPostGameNotifications(email: string, phoneNumber: string, data: any) {
    await emailService.sendPostGameAlert(email, data);
    // SMS disabled - using APNs instead
    console.log('SMS disabled - using APNs for push notifications');
  }

  // New APNs-first notification methods
  async sendDealActivationNotifications(data: DealNotificationData): Promise<{
    apns: { successful: number; failed: number };
    email: { sent: boolean; error?: string };
  }> {
    const results = {
      apns: { successful: 0, failed: 0 },
      email: { sent: false, error: undefined as string | undefined }
    };

    try {
      // Get user preferences
      const preferences = await storage.getUserNotificationPreferences(data.userId);
      const user = await storage.getUser(data.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Primary: Apple Push Notifications (for iOS users)
      if (preferences.pushNotifications) {
        try {
          const apnsResult = await apnsService.sendDealAlert(data.userId, {
            teamName: data.teamName,
            triggeredDeals: data.triggeredDeals,
            gameId: data.gameId,
            totalActiveDeals: data.triggeredDeals.length,
            expiresAt: data.expiresAt,
            featuredImage: data.featuredImage
          });

          results.apns.successful = apnsResult.successful.length;
          results.apns.failed = apnsResult.failed.length;

          console.log(`✅ APNs deal notification: ${apnsResult.successful.length} successful, ${apnsResult.failed.length} failed`);
        } catch (error) {
          console.error('APNs notification failed:', error);
          results.apns.failed = 1;
        }
      }

      // Secondary: Email backup (always send for rich content)
      if (preferences.email && user.email) {
        try {
          // Convert to email service format
          const emailData = {
            homeTeam: data.teamName,
            awayTeam: 'Opponent', // This could be enhanced with actual opponent data
            finalScore: { home: 0, away: 0 }, // This could be enhanced with actual scores
            isWin: true,
            triggeredDeals: data.triggeredDeals.map(deal => ({
              restaurant: deal.restaurant,
              offer: deal.offer,
              promoCode: deal.promoCode,
              expiresAt: new Date(deal.expiresAt),
              instructions: 'Show this email in-store'
            }))
          };

          await emailService.sendPostGameAlert(user.email, emailData);
          results.email.sent = true;

          console.log(`✅ Email deal notification sent to ${user.email}`);
        } catch (error) {
          console.error('Email notification failed:', error);
          results.email.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      return results;

    } catch (error) {
      console.error('Error sending deal activation notifications:', error);
      throw error;
    }
  }

  async sendPreGameNotifications(data: GameNotificationData): Promise<{
    apns: { successful: number; failed: number };
    email: { sent: boolean; error?: string };
  }> {
    const results = {
      apns: { successful: 0, failed: 0 },
      email: { sent: false, error: undefined as string | undefined }
    };

    try {
      const preferences = await storage.getUserNotificationPreferences(data.userId);
      const user = await storage.getUser(data.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Check quiet hours
      if (this.isQuietHours(preferences.quietHours)) {
        console.log('Skipping pre-game notification due to quiet hours');
        return results;
      }

      // Primary: APNs
      if (preferences.pushNotifications) {
        try {
          const apnsResult = await apnsService.sendPreGameAlert(data.userId, {
            gameId: 0, // This should be provided in the data
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            gameTime: data.gameTime,
            venue: data.venue,
            potentialDeals: data.potentialDeals
          });

          results.apns.successful = apnsResult.successful.length;
          results.apns.failed = apnsResult.failed.length;
        } catch (error) {
          console.error('APNs pre-game notification failed:', error);
          results.apns.failed = 1;
        }
      }

      // Secondary: Email
      if (preferences.email && user.email) {
        try {
          await emailService.sendPreGameAlert(user.email, {
            teamName: data.homeTeam,
            opponent: data.awayTeam,
            gameTime: new Date(data.gameTime),
            venue: data.venue,
            potentialDeals: data.potentialDeals
          });
          results.email.sent = true;
        } catch (error) {
          console.error('Email pre-game notification failed:', error);
          results.email.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      return results;

    } catch (error) {
      console.error('Error sending pre-game notifications:', error);
      throw error;
    }
  }

  private isQuietHours(quietHours?: { enabled: boolean; start: string; end: string }): boolean {
    if (!quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes(); // e.g., 22:30 = 2230
    
    const startTime = parseInt(quietHours.start.replace(':', ''));
    const endTime = parseInt(quietHours.end.replace(':', ''));

    if (startTime > endTime) {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      // Same day quiet hours (e.g., 13:00 to 15:00)
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  async testNotification(userId: string): Promise<{
    apns: { successful: number; failed: number };
    email: { sent: boolean; error?: string };
  }> {
    const testData: DealNotificationData = {
      userId,
      teamName: 'LA Dodgers',
      gameId: 999,
      triggeredDeals: [{
        id: 999,
        restaurant: 'Panda Express',
        offer: '$6 Panda Plate Deal',
        promoCode: 'DODGERSWIN',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return await this.sendDealActivationNotifications(testData);
  }

  getNotificationStatus(): {
    apns: { configured: boolean; provider: string };
    email: { configured: boolean; provider: string };
    sms: { configured: boolean; provider: string; note: string };
  } {
    return {
      apns: apnsService.getStatus(),
      email: { configured: true, provider: 'MailerSend' },
      sms: { configured: false, provider: 'Disabled', note: 'Replaced by APNs for better UX' }
    };
  }
}

export const notificationService = new NotificationService();
