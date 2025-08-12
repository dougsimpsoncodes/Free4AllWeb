import apn from 'node-apn';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import type { DeviceToken, TriggeredDeal, Game } from '@shared/schema';

interface DealAlertPayload {
  teamName: string;
  triggeredDeals: Array<{
    id: number;
    restaurant: string;
    offer: string;
    promoCode?: string;
    expiresAt: string;
  }>;
  gameId: number;
  totalActiveDeals: number;
  expiresAt: string;
  featuredImage?: string;
}

interface PreGameAlertPayload {
  gameId: number;
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

interface APNsResult {
  successful: string[];
  failed: Array<{ deviceToken: string; error: string }>;
}

export class APNsService {
  private provider: apn.Provider | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    try {
      // Check if APNs credentials are configured
      const keyPath = process.env.APNS_PRIVATE_KEY_PATH;
      const keyId = process.env.APNS_KEY_ID;
      const teamId = process.env.APNS_TEAM_ID;
      const bundleId = process.env.APNS_BUNDLE_ID;
      const environment = process.env.APNS_ENVIRONMENT || 'sandbox';

      if (!keyPath || !keyId || !teamId || !bundleId) {
        console.warn('APNs credentials not fully configured. Push notifications will be disabled.');
        console.warn('Required env vars: APNS_PRIVATE_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID');
        return;
      }

      // Resolve key path relative to project root
      const resolvedKeyPath = path.resolve(process.cwd(), keyPath);
      
      // Security check: Ensure key file exists and is readable
      if (!fs.existsSync(resolvedKeyPath)) {
        console.error(`APNs private key file not found at: ${resolvedKeyPath}`);
        console.error('Ensure the .p8 file is placed in the credentials/ directory');
        return;
      }

      // Check file permissions for security
      const stats = fs.statSync(resolvedKeyPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      if (permissions !== '600') {
        console.warn(`⚠️  APNs key file has permissive permissions (${permissions}). Should be 600 for security.`);
        console.warn(`Run: chmod 600 ${resolvedKeyPath}`);
      }

      // Read the private key securely
      const privateKey = fs.readFileSync(resolvedKeyPath, 'utf8');
      
      const config = {
        production: environment === 'production',
        token: {
          key: privateKey,
          keyId: keyId,
          teamId: teamId
        }
      };

      this.provider = new apn.Provider(config);
      this.isConfigured = true;

      console.log(`✅ APNs Service initialized for ${config.production ? 'production' : 'sandbox'}`);
      console.log(`   Environment: ${environment}`);
      console.log(`   Bundle ID: ${bundleId}`);
      console.log(`   Team ID: ${teamId.substring(0, 4)}***`);
      console.log(`   Key ID: ${keyId.substring(0, 4)}***`);
      console.log(`   Key file: ${resolvedKeyPath.replace(process.cwd(), '.')}`);

    } catch (error) {
      console.error('Failed to initialize APNs provider:', error);
      this.isConfigured = false;
    }
  }

  async sendDealAlert(userId: string, dealData: DealAlertPayload): Promise<APNsResult> {
    if (!this.isConfigured || !this.provider) {
      console.log(`APNs disabled - would send deal alert to user ${userId}: ${dealData.triggeredDeals.length} deals`);
      return { successful: [], failed: [] };
    }

    try {
      const deviceTokens = await storage.getUserDeviceTokens(userId, 'ios');
      
      if (deviceTokens.length === 0) {
        console.log(`No iOS device tokens found for user ${userId}`);
        return { successful: [], failed: [] };
      }

      const notification = new apn.Notification();
      
      // Basic notification setup
      notification.topic = process.env.APNS_BUNDLE_ID!;
      notification.badge = dealData.totalActiveDeals;
      notification.sound = 'deal-alert.caf'; // Custom sound in app bundle
      notification.category = 'DEAL_ALERT'; // For interactive buttons
      
      // Rich notification content
      if (dealData.triggeredDeals.length === 1) {
        const deal = dealData.triggeredDeals[0];
        notification.title = `🎉 ${dealData.teamName} Wins!`;
        notification.subtitle = deal.restaurant;
        notification.body = deal.offer;
      } else {
        notification.title = `🎉 ${dealData.teamName} Wins!`;
        notification.subtitle = `${dealData.triggeredDeals.length} deals triggered`;
        notification.body = `${dealData.triggeredDeals[0].restaurant} + ${dealData.triggeredDeals.length - 1} more deals!`;
      }
      
      // Custom payload for app logic
      notification.payload = {
        type: 'deal_alert',
        dealIds: dealData.triggeredDeals.map(d => d.id),
        gameId: dealData.gameId,
        expiresAt: dealData.expiresAt,
        deepLink: `free4all://deals/${dealData.gameId}`
      };
      
      // Rich media attachment if available
      if (dealData.featuredImage) {
        notification.mutableContent = 1;
        notification.payload.attachments = [{
          identifier: 'deal-image',
          url: dealData.featuredImage,
          options: {
            'UNNotificationAttachmentOptionsTypeHintKey': 'public.jpeg'
          }
        }];
      }

      const results = await this.provider.send(notification, deviceTokens);
      
      return this.processAPNsResults(results, deviceTokens);

    } catch (error) {
      console.error('Error sending APNs deal alert:', error);
      return { successful: [], failed: [] };
    }
  }

  async sendPreGameAlert(userId: string, preGameData: PreGameAlertPayload): Promise<APNsResult> {
    if (!this.isConfigured || !this.provider) {
      console.log(`APNs disabled - would send pre-game alert to user ${userId}: ${preGameData.homeTeam} vs ${preGameData.awayTeam}`);
      return { successful: [], failed: [] };
    }

    try {
      const deviceTokens = await storage.getUserDeviceTokens(userId, 'ios');
      
      if (deviceTokens.length === 0) {
        return { successful: [], failed: [] };
      }

      const notification = new apn.Notification();
      
      notification.topic = process.env.APNS_BUNDLE_ID!;
      notification.badge = 0; // Clear badge for pre-game
      notification.sound = 'pre-game.caf';
      notification.category = 'PRE_GAME_ALERT';
      
      const gameTime = new Date(preGameData.gameTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
      });

      notification.title = `🏟️ Game in 1 Hour`;
      notification.subtitle = `${preGameData.homeTeam} vs ${preGameData.awayTeam}`;
      notification.body = `${preGameData.potentialDeals.length} potential deals if they win! Game starts at ${gameTime}`;
      
      notification.payload = {
        type: 'pre_game_alert',
        gameId: preGameData.gameId,
        gameTime: preGameData.gameTime,
        potentialDeals: preGameData.potentialDeals.length,
        deepLink: `free4all://game/${preGameData.gameId}`
      };

      const results = await this.provider.send(notification, deviceTokens);
      
      return this.processAPNsResults(results, deviceTokens);

    } catch (error) {
      console.error('Error sending APNs pre-game alert:', error);
      return { successful: [], failed: [] };
    }
  }

  async sendSilentUpdate(userId: string, contentUpdate: any): Promise<APNsResult> {
    if (!this.isConfigured || !this.provider) {
      return { successful: [], failed: [] };
    }

    try {
      const deviceTokens = await storage.getUserDeviceTokens(userId, 'ios');
      
      if (deviceTokens.length === 0) {
        return { successful: [], failed: [] };
      }

      const notification = new apn.Notification();
      
      notification.topic = process.env.APNS_BUNDLE_ID!;
      notification.contentAvailable = 1; // Silent push
      notification.priority = 5; // Background priority
      
      notification.payload = {
        type: 'content_update',
        deals: contentUpdate.activeDeals,
        lastUpdated: new Date().toISOString()
      };

      // No alert, sound, or badge - pure background update
      const results = await this.provider.send(notification, deviceTokens);
      
      return this.processAPNsResults(results, deviceTokens);

    } catch (error) {
      console.error('Error sending APNs silent update:', error);
      return { successful: [], failed: [] };
    }
  }

  private processAPNsResults(results: apn.Responses, deviceTokens: string[]): APNsResult {
    const successful: string[] = [];
    const failed: Array<{ deviceToken: string; error: string }> = [];

    results.sent.forEach((result) => {
      successful.push(result.device);
    });

    results.failed.forEach((failure) => {
      failed.push({
        deviceToken: failure.device,
        error: failure.error?.message || 'Unknown APNs error'
      });

      // Mark invalid device tokens as inactive
      if (failure.error?.code === 8) { // InvalidToken
        this.markDeviceTokenInactive(failure.device);
      }
    });

    console.log(`APNs Results: ${successful.length} successful, ${failed.length} failed`);
    
    return { successful, failed };
  }

  private async markDeviceTokenInactive(deviceToken: string): Promise<void> {
    try {
      await storage.deactivateDeviceToken(deviceToken);
      console.log(`Marked invalid device token as inactive: ${deviceToken.substring(0, 8)}***`);
    } catch (error) {
      console.error('Error marking device token inactive:', error);
    }
  }

  async testAPNs(userId: string): Promise<APNsResult> {
    if (!this.isConfigured || !this.provider) {
      console.log('APNs not configured for testing');
      return { successful: [], failed: [] };
    }

    const testPayload: DealAlertPayload = {
      teamName: 'LA Dodgers',
      triggeredDeals: [{
        id: 999,
        restaurant: 'Panda Express',
        offer: '$6 Panda Plate Deal',
        promoCode: 'DODGERSWIN',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }],
      gameId: 999,
      totalActiveDeals: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return await this.sendDealAlert(userId, testPayload);
  }

  getStatus(): { configured: boolean; provider: string } {
    return {
      configured: this.isConfigured,
      provider: this.isConfigured ? 'Apple Push Notifications' : 'Not configured'
    };
  }
}

export const apnsService = new APNsService();