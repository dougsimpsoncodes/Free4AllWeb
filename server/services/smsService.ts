import fetch from 'node-fetch';

export interface SMSProvider {
  name: string;
  sendSMS(to: string, message: string): Promise<SMSSendResult>;
  checkCredentials(): Promise<boolean>;
}

export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  quotaRemaining?: number;
}

export class TextBeltProvider implements SMSProvider {
  name = 'TextBelt';
  private apiKey: string;

  constructor(apiKey: string = 'textbelt') {
    this.apiKey = apiKey; // 'textbelt' gives 1 free SMS per day
  }

  async checkCredentials(): Promise<boolean> {
    // TextBelt free tier doesn't require credential verification
    return true;
  }

  async sendSMS(to: string, message: string): Promise<SMSSendResult> {
    try {
      // Clean phone number - remove any non-digits except +
      const cleanPhone = to.replace(/[^\d+]/g, '');
      
      const response = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          phone: cleanPhone,
          message: message,
          key: this.apiKey
        })
      });

      const result = await response.json() as any;
      
      if (result.success) {
        console.log(`✅ SMS sent via TextBelt to ${cleanPhone}`);
        return {
          success: true,
          messageId: result.textId?.toString(),
          provider: 'TextBelt',
          quotaRemaining: result.quotaRemaining
        };
      } else {
        console.warn(`❌ TextBelt SMS failed: ${result.error}`);
        return {
          success: false,
          error: result.error || 'Unknown TextBelt error',
          provider: 'TextBelt'
        };
      }
    } catch (error) {
      console.error('TextBelt SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: 'TextBelt'
      };
    }
  }
}

export class TwilioProvider implements SMSProvider {
  name = 'Twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid?: string, authToken?: string, fromNumber?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = fromNumber || process.env.TWILIO_PHONE_NUMBER || '';
    
    // Debug credentials (don't log actual values in production)
    console.log('Twilio credentials check:', {
      hasAccountSid: !!this.accountSid,
      accountSidLength: this.accountSid.length,
      hasAuthToken: !!this.authToken,
      authTokenLength: this.authToken.length,
      hasFromNumber: !!this.fromNumber,
      fromNumberLength: this.fromNumber.length
    });
  }

  async checkCredentials(): Promise<boolean> {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  async sendSMS(to: string, message: string): Promise<SMSSendResult> {
    try {
      if (!await this.checkCredentials()) {
        return {
          success: false,
          error: 'Twilio credentials not configured',
          provider: 'Twilio'
        };
      }

      const cleanPhone = to.replace(/[^\d+]/g, '');
      
      // Debug the actual request (without exposing credentials)
      console.log('Twilio API request debug:', {
        url: `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid.substring(0, 8)}***/Messages.json`,
        hasAuth: !!(this.accountSid && this.authToken),
        from: this.fromNumber,
        to: cleanPhone
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: this.fromNumber,
            To: cleanPhone,
            Body: message
          })
        }
      );

      const result = await response.json() as any;
      
      if (response.ok && result.sid) {
        console.log(`✅ SMS sent via Twilio to ${cleanPhone}`);
        return {
          success: true,
          messageId: result.sid,
          provider: 'Twilio'
        };
      } else {
        console.warn(`❌ Twilio SMS failed: ${result.message}`);
        return {
          success: false,
          error: result.message || 'Unknown Twilio error',
          provider: 'Twilio'
        };
      }
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: 'Twilio'
      };
    }
  }
}

export class SMSService {
  private providers: SMSProvider[] = [];
  private primaryProvider: SMSProvider;

  constructor() {
    // Initialize providers in order of preference
    const textBeltProvider = new TextBeltProvider();
    const twilioProvider = new TwilioProvider();
    
    this.providers = [textBeltProvider, twilioProvider];
    this.primaryProvider = textBeltProvider; // Start with free TextBelt
    
    console.log('SMS Service initialized with providers:', this.providers.map(p => p.name));
  }

  async sendSMS(to: string, message: string): Promise<SMSSendResult> {
    // Try primary provider first
    const result = await this.primaryProvider.sendSMS(to, message);
    
    if (result.success) {
      return result;
    }

    // If primary fails, try fallback providers
    console.log(`Primary SMS provider (${this.primaryProvider.name}) failed, trying fallbacks...`);
    
    for (const provider of this.providers) {
      if (provider === this.primaryProvider) continue;
      
      if (await provider.checkCredentials()) {
        console.log(`Trying fallback provider: ${provider.name}`);
        const fallbackResult = await provider.sendSMS(to, message);
        
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }
    }

    return {
      success: false,
      error: 'All SMS providers failed',
      provider: 'Multiple'
    };
  }

  async sendPreGameSMSAlert(phoneNumber: string, gameData: {
    homeTeam: string;
    awayTeam: string;
    gameTime: Date;
    venue: string;
    potentialDeals: Array<{
      restaurant: string;
      offer: string;
      trigger: string;
    }>;
  }): Promise<SMSSendResult> {
    const gameTimeStr = gameData.gameTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles'
    });

    const dealsList = gameData.potentialDeals
      .map(deal => `• ${deal.restaurant}: ${deal.offer}`)
      .join('\n');

    const message = `🏟️ ${gameData.homeTeam} vs ${gameData.awayTeam} starts at ${gameTimeStr}!

Potential deals if they win:
${dealsList}

🍔 Free4All - Never miss a deal!`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendPostGameSMSAlert(phoneNumber: string, gameData: {
    homeTeam: string;
    awayTeam: string;
    finalScore: string;
    triggeredDeals: Array<{
      restaurant: string;
      offer: string;
      promoCode?: string;
      expiresAt: Date;
      instructions: string;
    }>;
  }): Promise<SMSSendResult> {
    if (gameData.triggeredDeals.length === 0) {
      return {
        success: false,
        error: 'No deals triggered',
        provider: 'N/A'
      };
    }

    const expiry = gameData.triggeredDeals[0].expiresAt.toLocaleDateString('en-US');
    
    const dealsList = gameData.triggeredDeals
      .map(deal => {
        const code = deal.promoCode ? ` (Code: ${deal.promoCode})` : '';
        return `• ${deal.restaurant}: ${deal.offer}${code}`;
      })
      .join('\n');

    const message = `🎉 ${gameData.homeTeam} Won! Your deals are ready:

${dealsList}

⏰ Expires: ${expiry}
📧 Check email for full details!

🍔 Free4All`;

    return await this.sendSMS(phoneNumber, message);
  }

  // Get provider status for admin dashboard
  async getProviderStatus(): Promise<Array<{name: string, available: boolean, credentialsValid: boolean}>> {
    const status = [];
    
    for (const provider of this.providers) {
      const credentialsValid = await provider.checkCredentials();
      status.push({
        name: provider.name,
        available: true,
        credentialsValid
      });
    }
    
    return status;
  }

  // Test SMS functionality
  async testSMS(phoneNumber: string): Promise<SMSSendResult> {
    const testMessage = `🧪 Free4All SMS Test

This is a test message from your sports deal notification system. SMS notifications are working!

🍔 Free4All - Never miss a deal!`;

    return await this.sendSMS(phoneNumber, testMessage);
  }
}

// Export singleton instance
export const smsService = new SMSService();