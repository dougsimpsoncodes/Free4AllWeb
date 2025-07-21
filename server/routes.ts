import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, csrfProtection } from "./googleAuth";
import { mlbApiService } from "./services/mlbApiService";
import { gameProcessor } from "./services/gameProcessor";
import { db } from "./db";
import { games, teams, promotions, restaurants, triggeredDeals } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { dealDiscoveryService } from "./services/dealImageScrapingService";
import { enhancedDealDiscoveryService } from "./services/enhancedDealDiscovery";
import { realTimeDealMonitor } from "./services/realTimeDealMonitor";
import { dealPatternMatcher } from "./services/dealPatternMatcher";
import { dealMigrationService } from "./services/dealMigrationService";
import path from "path";
import fs from "fs";
import { multiSportsApiService } from "./services/multiSportsApiService";
import { promotionService } from "./services/promotionService";
import { seedSportsData } from "./seedData";
import { gameScrapingService } from "./services/gameScrapingService";
import { emailService } from "./services/emailService";
import { smsService } from "./services/smsService";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerGameSchedulingRoutes } from "./routes/gameScheduling";
import { insertAlertPreferenceSchema, insertPromotionSchema, insertTeamSchema, insertRestaurantSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Register notification routes
  registerNotificationRoutes(app);
  
  // Register game scheduling routes
  registerGameSchedulingRoutes(app);
  
  // Register deal verification routes
  const dealVerificationRoutes = await import("./routes/dealVerification");
  app.use('/api/deal-verification', dealVerificationRoutes.default);
  
  // Email showcase route for testing all email types
  app.post('/api/email/showcase', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email address required' });
      }

      console.log(`Sending email showcase to ${email}...`);
      const emailsSent = [];

      // 1. Pre-game Alert
      try {
        await emailService.sendPreGameAlert(email, {
          homeTeam: 'LA Dodgers',
          awayTeam: 'San Francisco Giants',
          gameTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          venue: 'Dodger Stadium',
          potentialDeals: [
            {
              restaurant: 'Panda Express',
              offer: '$6 Panda Plate Deal',
              trigger: 'Dodgers win any game'
            },
            {
              restaurant: 'McDonald\'s',
              offer: 'Free Big Mac',
              trigger: 'Dodgers win home game with 6+ runs'
            }
          ]
        });
        emailsSent.push('Pre-game Alert');
        console.log('✅ Sent: Pre-game Alert');
      } catch (error) {
        console.warn('Failed to send pre-game alert:', (error as Error).message);
      }

      // Wait 10 seconds between emails to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 2. Post-game Victory Alert with Triggered Deals
      try {
        await emailService.sendPostGameAlert(email, {
          homeTeam: 'LA Dodgers',
          awayTeam: 'San Francisco Giants',
          finalScore: 'Dodgers 8, Giants 3',
          gameDate: new Date(),
          triggeredDeals: [
            {
              restaurant: 'Panda Express',
              offer: '$6 Panda Plate Deal',
              promoCode: 'DODGERSWIN',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
              instructions: 'Show this email at any Panda Express location'
            },
            {
              restaurant: 'McDonald\'s',
              offer: 'Free Big Mac',
              promoCode: 'DODGERS8RUNS',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              instructions: 'Use mobile app or mention promo code at counter'
            }
          ]
        });
        emailsSent.push('Post-game Victory Alert');
        console.log('✅ Sent: Post-game Victory Alert');
      } catch (error) {
        console.warn('Failed to send post-game alert:', (error as Error).message);
      }

      res.json({ 
        success: true, 
        message: `Email showcase sent to ${email}`,
        emailsSent,
        note: 'Check your email for the complete notification experience!'
      });

    } catch (error) {
      console.error('Error sending email showcase:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // SMS testing endpoints
  app.post('/api/sms/test', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
      }

      console.log(`Testing SMS to ${phoneNumber}...`);
      const result = await smsService.testSMS(phoneNumber);

      res.json({
        success: result.success,
        message: result.success ? 'Test SMS sent successfully!' : 'SMS failed to send',
        provider: result.provider,
        messageId: result.messageId,
        error: result.error,
        quotaRemaining: result.quotaRemaining
      });

    } catch (error) {
      console.error('Error testing SMS:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sms/pregame-test', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
      }

      const result = await smsService.sendPreGameSMSAlert(phoneNumber, {
        homeTeam: 'LA Dodgers',
        awayTeam: 'San Francisco Giants',
        gameTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        venue: 'Dodger Stadium',
        potentialDeals: [
          {
            restaurant: 'Panda Express',
            offer: '$6 Panda Plate Deal',
            trigger: 'Dodgers win any game'
          },
          {
            restaurant: 'McDonald\'s',
            offer: 'Free Big Mac',
            trigger: 'Dodgers win home game with 6+ runs'
          }
        ]
      });

      res.json({
        success: result.success,
        message: result.success ? 'Pre-game SMS sent successfully!' : 'SMS failed to send',
        provider: result.provider,
        messageId: result.messageId,
        error: result.error,
        quotaRemaining: result.quotaRemaining
      });

    } catch (error) {
      console.error('Error sending pre-game SMS:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sms/postgame-test', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
      }

      const result = await smsService.sendPostGameSMSAlert(phoneNumber, {
        homeTeam: 'LA Dodgers',
        awayTeam: 'San Francisco Giants',
        finalScore: 'Dodgers 8, Giants 3',
        triggeredDeals: [
          {
            restaurant: 'Panda Express',
            offer: '$6 Panda Plate Deal',
            promoCode: 'DODGERSWIN',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            instructions: 'Show this text at any Panda Express location'
          },
          {
            restaurant: 'McDonald\'s',
            offer: 'Free Big Mac',
            promoCode: 'DODGERSBIGMAC',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            instructions: 'Valid at participating McDonald\'s locations'
          }
        ]
      });

      res.json({
        success: result.success,
        message: result.success ? 'Post-game SMS sent successfully!' : 'SMS failed to send',
        provider: result.provider,
        messageId: result.messageId,
        error: result.error,
        quotaRemaining: result.quotaRemaining
      });

    } catch (error) {
      console.error('Error sending post-game SMS:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // SMS provider status endpoint
  app.get('/api/sms/providers', async (req, res) => {
    try {
      const providers = await smsService.getProviderStatus();
      res.json({
        success: true,
        providers
      });
    } catch (error) {
      console.error('Error getting SMS provider status:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Direct Twilio test endpoint
  app.post('/api/sms/twilio-direct', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
      }

      // Test environment variables directly
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN; 
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      console.log('Environment variables check:', {
        hasAccountSid: !!accountSid,
        accountSidLength: accountSid?.length || 0,
        hasAuthToken: !!authToken,
        authTokenLength: authToken?.length || 0,
        hasFromNumber: !!fromNumber,
        fromNumberLength: fromNumber?.length || 0
      });

      if (!accountSid || !authToken || !fromNumber) {
        return res.status(400).json({ 
          error: 'Twilio credentials missing from environment',
          missing: {
            accountSid: !accountSid,
            authToken: !authToken,
            fromNumber: !fromNumber
          }
        });
      }

      // Direct Twilio API call
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      const message = '🧪 Free4All Direct Twilio Test\n\nThis message confirms your Twilio integration is working!\n\n🍔 Free4All';

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: cleanPhone,
            Body: message
          })
        }
      );

      const result = await response.json() as any;
      
      if (response.ok && result.sid) {
        console.log(`✅ Direct Twilio SMS sent to ${cleanPhone}`);
        res.json({
          success: true,
          message: 'Direct Twilio test successful!',
          provider: 'Twilio',
          messageId: result.sid
        });
      } else {
        console.warn(`❌ Direct Twilio SMS failed: ${result.message}`);
        res.json({
          success: false,
          message: 'Direct Twilio test failed',
          provider: 'Twilio',
          error: result.message || 'Unknown Twilio error',
          details: result
        });
      }

    } catch (error) {
      console.error('Error in direct Twilio test:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Serve logos directly
  app.get('/logos/:filename', (req, res) => {
    const filename = req.params.filename;
    const logoPath = path.join(process.cwd(), 'public', 'logos', filename);
    
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.status(404).send('Logo not found');
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Check if user is new (no alert preferences set up)
      const alertPreferences = await storage.getUserAlertPreferences(userId);
      const isNewUser = alertPreferences.length === 0;
      
      res.json({
        ...user,
        isNewUser
      });
    } catch (error) {
      console.error("Error fetching user:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { city, zipCode, phoneNumber } = req.body;
      
      // Update user profile with additional fields
      const updatedUser = await storage.upsertUser({
        id: userId,
        city,
        zipCode,
        phoneNumber,
        // Keep existing user data
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        profileImageUrl: req.user.profileImageUrl,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", (error as Error).message);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Public routes - Teams and restaurants
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getActiveTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get('/api/restaurants', async (req, res) => {
    try {
      const restaurants = await storage.getActiveRestaurants();
      res.json(restaurants);
    } catch (error) {
      console.error("Error fetching restaurants:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  app.get('/api/promotions', async (req, res) => {
    try {
      const teamId = req.query.teamId as string;
      let promotions;
      
      if (teamId) {
        promotions = await storage.getPromotionsByTeam(parseInt(teamId));
      } else {
        promotions = await storage.getActivePromotions();
      }
      
      res.json(promotions);
    } catch (error) {
      console.error("Error fetching promotions:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch promotions" });
    }
  });

  app.get('/api/active-deals', async (req, res) => {
    try {
      const teamId = req.query.teamId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
      let deals;

      if (teamId) {
        deals = await promotionService.getActiveDealsForTeam(parseInt(teamId));
        res.json(deals);
      } else {
        // PERFORMANCE: Get paginated deals with related data in ONE query instead of N+1
        const result = await storage.getActiveTriggeredDealsWithDetailsPaginated(page, limit);
        res.json({
          deals: result.deals,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
            hasNext: page * limit < result.total,
            hasPrev: page > 1
          }
        });
      }
    } catch (error) {
      console.error("Error fetching active deals:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch active deals" });
    }
  });

  app.get('/api/recent-games/:teamId', async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const limit = parseInt(req.query.limit as string) || 5;
      const games = await storage.getRecentGames(teamId, limit);
      res.json(games);
    } catch (error) {
      console.error("Error fetching recent games:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch recent games" });
    }
  });

  // Protected routes - Alert preferences
  app.get('/api/alert-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const preferences = await storage.getUserAlertPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching alert preferences:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch alert preferences" });
    }
  });

  app.post('/api/alert-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertAlertPreferenceSchema.parse({
        ...req.body,
        userId,
      });

      const preference = await storage.createAlertPreference(validatedData);
      
      // Send welcome email on first preference
      const existingPreferences = await storage.getUserAlertPreferences(userId);
      if (existingPreferences.length === 1) {
        const user = await storage.getUser(userId);
        if (user) {
          await emailService.sendWelcomeEmail(user);
        }
      }

      res.json(preference);
    } catch (error) {
      console.error("Error creating alert preference:", (error as Error).message);
      res.status(400).json({ message: "Failed to create alert preference" });
    }
  });

  app.put('/api/alert-preferences/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const preferenceId = parseInt(req.params.id);
      
      // Verify ownership
      const existingPreference = await storage.getUserAlertPreferences(userId);
      const ownedPreference = existingPreference.find(p => p.id === preferenceId);
      
      if (!ownedPreference) {
        return res.status(404).json({ message: "Alert preference not found" });
      }

      const updatedPreference = await storage.updateAlertPreference(preferenceId, req.body);
      res.json(updatedPreference);
    } catch (error) {
      console.error("Error updating alert preference:", (error as Error).message);
      res.status(400).json({ message: "Failed to update alert preference" });
    }
  });

  app.delete('/api/alert-preferences/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const preferenceId = parseInt(req.params.id);
      
      // Verify ownership
      const existingPreferences = await storage.getUserAlertPreferences(userId);
      const ownedPreference = existingPreferences.find(p => p.id === preferenceId);
      
      if (!ownedPreference) {
        return res.status(404).json({ message: "Alert preference not found" });
      }

      await storage.deleteAlertPreference(preferenceId);
      res.json({ message: "Alert preference deleted" });
    } catch (error) {
      console.error("Error deleting alert preference:", (error as Error).message);
      res.status(400).json({ message: "Failed to delete alert preference" });
    }
  });

  // Admin routes (protected)
  app.post('/api/admin/teams', csrfProtection, isAdmin, async (req: any, res) => {
    try {
      // Admin role check handled by isAdmin middleware
      const validatedData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(validatedData);
      res.json(team);
    } catch (error) {
      console.error("Error creating team:", (error as Error).message);
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  app.post('/api/admin/restaurants', csrfProtection, isAdmin, async (req: any, res) => {
    try {
      // Admin role check handled by isAdmin middleware
      const validatedData = insertRestaurantSchema.parse(req.body);
      const restaurant = await storage.createRestaurant(validatedData);
      res.json(restaurant);
    } catch (error) {
      console.error("Error creating restaurant:", (error as Error).message);
      res.status(400).json({ message: "Failed to create restaurant" });
    }
  });

  app.post('/api/admin/promotions', csrfProtection, isAdmin, async (req: any, res) => {
    try {
      // Admin role check handled by isAdmin middleware
      const validatedData = insertPromotionSchema.parse(req.body);
      const promotion = await storage.createPromotion(validatedData);
      res.json(promotion);
    } catch (error) {
      console.error("Error creating promotion:", (error as Error).message);
      res.status(400).json({ message: "Failed to create promotion" });
    }
  });

  app.post('/api/admin/sync-games/:teamId', isAdmin, async (req: any, res) => {
    try {
      // Admin role check handled by isAdmin middleware
      const teamId = parseInt(req.params.teamId);
      await promotionService.syncRecentGames(teamId);
      res.json({ message: "Games synced successfully" });
    } catch (error) {
      console.error("Error syncing games:", (error as Error).message);
      res.status(500).json({ message: "Failed to sync games" });
    }
  });

  app.get('/api/admin/analytics', isAdmin, async (req: any, res) => {
    try {
      // Admin role check handled by isAdmin middleware
      const activeDeals = await storage.getActiveTriggeredDeals();
      const totalUsers = await storage.getUsersByTeamPreference(1); // Dodgers for now
      
      res.json({
        activeDeals: activeDeals.length,
        totalSubscribers: totalUsers.length,
        // Add more analytics as needed
      });
    } catch (error) {
      console.error("Error fetching analytics:", (error as Error).message);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Webhook endpoint for testing alerts
  app.post('/api/test-alert', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user) {
        await emailService.sendWelcomeEmail(user);
        res.json({ message: "Test email sent" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error sending test alert:", (error as Error).message);
      res.status(500).json({ message: "Failed to send test alert" });
    }
  });

  // Sports data routes
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getActiveTeams();
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.get('/api/teams/:sport', async (req, res) => {
    try {
      const { sport } = req.params;
      const teams = await storage.getTeams();
      const filteredTeams = teams.filter(team => team.sport?.toLowerCase() === sport.toLowerCase());
      res.json(filteredTeams);
    } catch (error) {
      console.error('Error fetching teams by sport:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.get('/api/promotions/active', async (req, res) => {
    try {
      const promotions = await storage.getActivePromotions();
      res.json(promotions);
    } catch (error) {
      console.error('Error fetching active promotions:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch promotions' });
    }
  });

  app.get('/api/deals/triggered', async (req, res) => {
    try {
      const triggeredDeals = await storage.getActiveTriggeredDeals();
      res.json(triggeredDeals);
    } catch (error) {
      console.error('Error fetching triggered deals:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch triggered deals' });
    }
  });

  // Alert preferences routes
  app.get('/api/alert-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserAlertPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching alert preferences:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch alert preferences' });
    }
  });

  app.post('/api/alert-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { teamId, emailEnabled, smsEnabled } = req.body;
      
      const preference = await storage.createAlertPreference({
        userId,
        teamId,
        emailAlerts: emailEnabled ?? true,
        smsAlerts: smsEnabled ?? false
      });
      
      res.json(preference);
    } catch (error) {
      console.error('Error creating alert preference:', (error as Error).message);
      res.status(500).json({ message: 'Failed to create alert preference' });
    }
  });

  // Development routes (no auth required for testing)
  app.get('/api/mlb/games/status', async (req, res) => {
    try {
      const status = {
        isRunning: true,
        isProcessing: false,
        lastCheck: new Date().toISOString()
      };
      res.json(status);
    } catch (error) {
      console.error('Error fetching game processor status:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch status' });
    }
  });

  app.get('/api/mlb/games/today', async (req, res) => {
    try {
      const recentGames = await storage.getRecentGames(1, 10); // Dodgers recent games
      res.json(recentGames);
    } catch (error) {
      console.error('Error fetching today\'s games:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch games' });
    }
  });

  app.post('/api/mlb/games/process', async (req, res) => {
    try {
      await gameProcessor.triggerManualProcess();
      res.json({ message: 'Game processing completed successfully' });
    } catch (error) {
      console.error('Error processing games:', (error as Error).message);
      res.status(500).json({ message: 'Failed to process games' });
    }
  });

  app.get('/api/admin/promotions', async (req, res) => {
    try {
      const promotions = await storage.getActivePromotions();
      const formattedPromotions = promotions.map(p => ({
        team: p.teamId || 'Unknown',
        restaurant: p.restaurantId || 'Unknown', 
        title: p.title,
        trigger_condition: p.triggerCondition
      }));
      res.json(formattedPromotions);
    } catch (error) {
      console.error('Error fetching promotions:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch promotions' });
    }
  });

  // Admin routes for data management
  app.post('/api/admin/seed-data', async (req, res) => {
    try {
      await seedSportsData();
      res.json({ message: 'Sports data seeded successfully' });
    } catch (error) {
      console.error('Error seeding data:', (error as Error).message);
      res.status(500).json({ message: 'Failed to seed data' });
    }
  });

  app.post('/api/admin/seed-demo-games', isAdmin, async (req, res) => {
    try {
      const { seedDemoGameData } = await import('./seedGameData');
      const result = await seedDemoGameData();
      res.json({ message: 'Demo game data seeded successfully', ...result });
    } catch (error) {
      console.error('Error seeding demo game data:', (error as Error).message);
      res.status(500).json({ message: 'Failed to seed demo game data' });
    }
  });

  app.post('/api/admin/sync-games/:teamId', async (req, res) => {
    try {
      const { teamId } = req.params;
      await promotionService.syncRecentGames(parseInt(teamId));
      res.json({ message: 'Games synced successfully' });
    } catch (error) {
      console.error('Error syncing games:', (error as Error).message);
      res.status(500).json({ message: 'Failed to sync games' });
    }
  });

  // Real-time sports data integration
  app.get('/api/games/recent/:teamId', async (req, res) => {
    try {
      const { teamId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const games = await storage.getRecentGames(parseInt(teamId), limit);
      res.json(games);
    } catch (error) {
      console.error('Error fetching recent games:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch recent games' });
    }
  });

  // Scraping and testing routes
  app.post('/api/admin/scrape-all-teams', async (req, res) => {
    try {
      console.log('🚀 Starting comprehensive team scraping...');
      const report = await gameScrapingService.generateScrapingReport();
      res.json(report);
    } catch (error) {
      console.error('Error during team scraping:', (error as Error).message);
      res.status(500).json({ message: 'Failed to scrape team data', error: (error as Error).message });
    }
  });

  app.post('/api/admin/scrape-team/:teamId', async (req, res) => {
    try {
      const { teamId } = req.params;
      const team = await storage.getTeam(parseInt(teamId));
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }
      
      const result = await gameScrapingService.scrapeTeamGames(team);
      res.json(result);
    } catch (error) {
      console.error('Error scraping team:', (error as Error).message);
      res.status(500).json({ message: 'Failed to scrape team data', error: (error as Error).message });
    }
  });

  app.get('/api/admin/test-promotions/:teamId', async (req, res) => {
    try {
      const { teamId } = req.params;
      const analysis = await gameScrapingService.testPromotionTriggers(parseInt(teamId));
      res.json(analysis);
    } catch (error) {
      console.error('Error testing promotions:', (error as Error).message);
      res.status(500).json({ message: 'Failed to test promotions', error: (error as Error).message });
    }
  });

  // External sports API testing
  app.get('/api/admin/test-sports-api/:sport/:teamId', async (req, res) => {
    try {
      const { sport, teamId } = req.params;
      const days = parseInt(req.query.days as string) || 7;
      
      console.log(`🔍 Testing ${sport} API for team ${teamId}...`);
      const games = await multiSportsApiService.getGamesForTeam(sport, teamId, days);
      
      res.json({
        sport,
        teamId,
        daysSearched: days,
        gamesFound: games.length,
        games: games.slice(0, 5), // Return first 5 games for preview
        apiStatus: games.length > 0 ? 'working' : 'no_data'
      });
    } catch (error) {
      console.error('Error testing sports API:', (error as Error).message);
      res.status(500).json({ 
        message: 'Sports API test failed', 
        error: (error as Error).message,
        apiStatus: 'error'
      });
    }
  });

  // Development auth bypass for admin endpoints
  const authMiddleware = process.env.NODE_ENV === 'development' ? (req: any, res: any, next: any) => {
    // Mock authenticated user for development
    req.user = { claims: { sub: 'dev-user-123' } };
    next();
  } : isAuthenticated;

  // NEW: Enhanced Discovery Engine with Integrated Social Media Search
  app.post("/api/admin/discovery/run", isAdmin, async (req, res) => {
    try {
      console.log('🚀 Starting enhanced discovery engine with social media integration...');
      
      // Run both standard discovery and social media discovery simultaneously
      const { dealDiscoveryEngine } = await import("./services/dealDiscoveryEngine");
      const { socialMediaDiscovery } = await import('./services/socialMediaDiscovery');
      
      // Execute both discovery methods in parallel for maximum coverage
      const [standardResults, socialResults] = await Promise.all([
        dealDiscoveryEngine.runDiscovery().catch(err => {
          console.error('Standard discovery error:', (err as Error).message);
          return [];
        }),
        socialMediaDiscovery.discoverDealsLikeHuman().catch(err => {
          console.error('Social media discovery error:', (err as Error).message);
          return [];
        })
      ]);
      
      const totalResults = standardResults.length;
      
      res.json({
        success: true,
        message: `Discovery completed: ${totalResults} sites found via API search + social media integration`,
        sitesCount: totalResults,
        sites: standardResults.slice(0, 10), // Return first 10 for preview
        includesSocialMedia: true
      });
    } catch (error) {
      console.error("Discovery engine error:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.get("/api/admin/discovery/sites", isAdmin, async (req, res) => {
    try {
      const precision = req.query.precision === 'true';
      const limit = parseInt(req.query.limit as string) || 50;
      
      let sites;
      if (precision) {
        // Use precision filter for authentic deals only
        const { precisionFilter } = await import('./services/precisionFilter');
        sites = await precisionFilter.getAuthenticDeals(limit);
      } else {
        // Get all discovered sites
        sites = await storage.getDiscoveredSites();
        // Sort by confidence score (highest first)
        sites = sites.sort((a: any, b: any) => {
          const confidenceA = parseFloat((a.confidence || '0').toString()) || 0;
          const confidenceB = parseFloat((b.confidence || '0').toString()) || 0;
          return confidenceB - confidenceA;
        });
      }
      
      res.json({
        success: true,
        sites: sites,
        count: sites.length
      });
    } catch (error) {
      console.error("Error fetching discovered sites:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.get("/api/admin/discovery/pending", isAdmin, async (req, res) => {
    try {
      const precision = req.query.precision === 'true';
      const limit = parseInt(req.query.limit as string) || 50;
      
      let pendingSites;
      if (precision) {
        // Use precision filter for authentic deals only
        const { precisionFilter } = await import('./services/precisionFilter');
        const authenticSites = await precisionFilter.getAuthenticDeals(limit);
        pendingSites = authenticSites.filter(site => site.status !== 'approved');
      } else {
        // Get all pending sites
        pendingSites = await storage.getPendingDiscoveredSites();
        // Sort by confidence score (highest first)
        pendingSites = pendingSites.sort((a, b) => {
          const confidenceA = parseFloat(a.confidence) || 0;
          const confidenceB = parseFloat(b.confidence) || 0;
          return confidenceB - confidenceA;
        });
      }
      
      res.json({
        success: true,
        sites: pendingSites,
        count: pendingSites.length
      });
    } catch (error) {
      console.error("Error fetching pending sites:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.put("/api/admin/discovery/sites/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedSite = await storage.updateDiscoveredSite(parseInt(id), updates);
      
      res.json({
        success: true,
        site: updatedSite
      });
    } catch (error) {
      console.error("Error updating discovered site:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.get("/api/admin/discovery/sources", isAdmin, async (req, res) => {
    try {
      const sources = await storage.getDiscoverySources();
      res.json({
        success: true,
        sources,
        count: sources.length
      });
    } catch (error) {
      console.error("Error fetching discovery sources:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.get("/api/admin/discovery/terms", isAdmin, async (req, res) => {
    try {
      const terms = await storage.getSearchTerms();
      res.json({
        success: true,
        terms,
        count: terms.length
      });
    } catch (error) {
      console.error("Error fetching search terms:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Enhanced deal discovery endpoints (existing pattern-based)
  app.get('/api/admin/discover-deals', isAdmin, async (req, res) => {
    try {
      console.log('🔍 Starting enhanced deal discovery...');
      const discoveredDeals = await enhancedDealDiscoveryService.discoverAllDeals();
      await enhancedDealDiscoveryService.saveDiscoveredDeals(discoveredDeals);
      
      res.json({ 
        success: true, 
        deals: discoveredDeals,
        count: discoveredDeals.length 
      });
    } catch (error) {
      console.error('Enhanced deal discovery failed:', (error as Error).message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to discover deals',
        details: (error as Error).message
      });
    }
  });

  app.get('/api/admin/deals', isAdmin, async (req, res) => {
    try {
      const deals = await enhancedDealDiscoveryService.getDiscoveredDeals();
      res.json({ 
        success: true, 
        deals,
        count: deals.length 
      });
    } catch (error) {
      console.error('Failed to load discovered deals:', (error as Error).message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to load discovered deals',
        details: (error as Error).message
      });
    }
  });

  app.post('/api/admin/deals/:dealId/approve', isAdmin, async (req, res) => {
    try {
      const { dealId } = req.params;
      const { imageAssetPath } = req.body;
      
      await enhancedDealDiscoveryService.approveDeal(dealId, imageAssetPath);
      res.json({ success: true, message: 'Deal approved successfully' });
    } catch (error) {
      console.error('Failed to approve deal:', (error as Error).message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to approve deal',
        details: (error as Error).message
      });
    }
  });

  app.post('/api/admin/deals/:dealId/reject', isAdmin, async (req, res) => {
    try {
      const { dealId } = req.params;
      await enhancedDealDiscoveryService.rejectDeal(dealId);
      res.json({ success: true, message: 'Deal rejected successfully' });
    } catch (error) {
      console.error('Failed to reject deal:', (error as Error).message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to reject deal',
        details: (error as Error).message
      });
    }
  });

  // Deal migration endpoints
  app.get('/api/admin/migration/report', isAdmin, async (req, res) => {
    try {
      const report = await dealMigrationService.getMigrationReport();
      res.json(report);
    } catch (error) {
      console.error('Error generating migration report:', (error as Error).message);
      res.status(500).json({ error: 'Failed to generate migration report' });
    }
  });

  app.post('/api/admin/migration/mark-test-deals', isAdmin, async (req, res) => {
    try {
      const count = await dealMigrationService.markExistingDealsAsTest();
      res.json({ success: true, markedCount: count });
    } catch (error) {
      console.error('Error marking test deals:', (error as Error).message);
      res.status(500).json({ error: 'Failed to mark test deals' });
    }
  });

  app.get('/api/admin/migration/test-deals', isAdmin, async (req, res) => {
    try {
      const deals = await dealMigrationService.getTestDeals();
      res.json(deals);
    } catch (error) {
      console.error('Error fetching test deals:', (error as Error).message);
      res.status(500).json({ error: 'Failed to fetch test deals' });
    }
  });

  app.get('/api/admin/migration/discovered-deals', isAdmin, async (req, res) => {
    try {
      const deals = await dealMigrationService.getDiscoveredDeals();
      res.json(deals);
    } catch (error) {
      console.error('Error fetching discovered deals:', (error as Error).message);
      res.status(500).json({ error: 'Failed to fetch discovered deals' });
    }
  });

  app.post('/api/admin/migration/backup-test-deals', isAdmin, async (req, res) => {
    try {
      const backup = await dealMigrationService.backupTestDeals();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="test-deals-backup.json"');
      res.send(backup);
    } catch (error) {
      console.error('Error creating backup:', (error as Error).message);
      res.status(500).json({ error: 'Failed to create backup' });
    }
  });

  app.delete('/api/admin/migration/test-deals', isAdmin, async (req, res) => {
    try {
      const { dealIds } = req.body;
      if (!Array.isArray(dealIds)) {
        return res.status(400).json({ error: 'dealIds must be an array' });
      }
      
      const deletedCount = await dealMigrationService.removeTestDeals(dealIds);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('Error removing test deals:', (error as Error).message);
      res.status(500).json({ error: (error as Error).message || 'Failed to remove test deals' });
    }
  });

  // Real-time deal monitoring endpoints
  app.get('/api/admin/deal-monitor/status', isAdmin, async (req, res) => {
    try {
      const status = realTimeDealMonitor.getStatus();
      const performance = realTimeDealMonitor.getPerformanceMetrics();
      const patternStats = dealPatternMatcher.getPatternStats();
      
      res.json({
        success: true,
        monitor: status,
        performance,
        patterns: patternStats
      });
    } catch (error) {
      console.error('Error getting monitor status:', (error as Error).message);
      res.status(500).json({ error: 'Failed to get monitor status' });
    }
  });

  app.post('/api/admin/deal-monitor/start', isAdmin, async (req, res) => {
    try {
      realTimeDealMonitor.start();
      res.json({ success: true, message: 'Deal monitor started' });
    } catch (error) {
      console.error('Error starting monitor:', (error as Error).message);
      res.status(500).json({ error: 'Failed to start monitor' });
    }
  });

  app.post('/api/admin/deal-monitor/stop', isAdmin, async (req, res) => {
    try {
      realTimeDealMonitor.stop();
      res.json({ success: true, message: 'Deal monitor stopped' });
    } catch (error) {
      console.error('Error stopping monitor:', (error as Error).message);
      res.status(500).json({ error: 'Failed to stop monitor' });
    }
  });

  app.post('/api/admin/deal-monitor/trigger', isAdmin, async (req, res) => {
    try {
      const result = await realTimeDealMonitor.triggerDiscovery();
      res.json({ success: true, result });
    } catch (error) {
      console.error('Error triggering discovery:', (error as Error).message);
      res.status(500).json({ error: 'Failed to trigger discovery' });
    }
  });

  app.post('/api/admin/deal-monitor/interval', isAdmin, async (req, res) => {
    try {
      const { minutes } = req.body;
      if (!minutes || minutes < 5) {
        return res.status(400).json({ error: 'Interval must be at least 5 minutes' });
      }
      
      realTimeDealMonitor.setInterval(minutes);
      res.json({ success: true, message: `Interval set to ${minutes} minutes` });
    } catch (error) {
      console.error('Error setting interval:', (error as Error).message);
      res.status(500).json({ error: 'Failed to set interval' });
    }
  });

  // MLB API endpoints for real-time game data
  app.get('/api/mlb/games/today', async (req, res) => {
    try {
      const games = await mlbApiService.getTodaysGames();
      res.json(games);
    } catch (error) {
      console.error("Error fetching today's games:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch today's games" });
    }
  });

  app.post('/api/mlb/games/process', isAuthenticated, async (req, res) => {
    try {
      const result = await gameProcessor.triggerManualProcess();
      res.json(result);
    } catch (error) {
      console.error("Error processing games:", (error as Error).message);
      res.status(500).json({ error: "Failed to process games" });
    }
  });

  app.get('/api/mlb/games/status', isAuthenticated, async (req, res) => {
    try {
      const status = gameProcessor.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting game processor status:", (error as Error).message);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.get('/api/mlb/teams', async (req, res) => {
    try {
      const teams = await mlbApiService.getAllMLBTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching MLB teams:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch MLB teams" });
    }
  });

  // ====== DEAL PAGE ENDPOINTS ======
  
  // Deal Page Routes
  app.post("/api/admin/deal-pages", isAdmin, async (req, res) => {
    try {
      const dealPage = await storage.createDealPage(req.body);
      res.json(dealPage);
    } catch (error) {
      console.error("Error creating deal page:", (error as Error).message);
      res.status(500).json({ error: "Failed to create deal page" });
    }
  });

  app.get("/api/deal-pages", async (req, res) => {
    try {
      const dealPages = await storage.getActiveDealPages();
      res.json(dealPages);
    } catch (error) {
      console.error("Error fetching deal pages:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch deal pages" });
    }
  });

  app.get("/api/deal-pages/:slug", async (req, res) => {
    try {
      const dealPage = await storage.getDealPage(req.params.slug);
      if (!dealPage) {
        return res.status(404).json({ error: "Deal page not found" });
      }
      res.json(dealPage);
    } catch (error) {
      console.error("Error fetching deal page:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch deal page" });
    }
  });

  app.get("/api/admin/deal-pages", isAdmin, async (req, res) => {
    try {
      const dealPages = await storage.getAllDealPages();
      res.json(dealPages);
    } catch (error) {
      console.error("Error fetching all deal pages:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch deal pages" });
    }
  });

  app.put("/api/admin/deal-pages/:id", isAdmin, async (req, res) => {
    try {
      const dealPage = await storage.updateDealPage(parseInt(req.params.id), req.body);
      res.json(dealPage);
    } catch (error) {
      console.error("Error updating deal page:", (error as Error).message);
      res.status(500).json({ error: "Failed to update deal page" });
    }
  });

  app.delete("/api/admin/deal-pages/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteDealPage(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting deal page:", (error as Error).message);
      res.status(500).json({ error: "Failed to delete deal page" });
    }
  });

  // Enhanced discovery approval with deal page creation
  app.post("/api/admin/discovery/approve-and-create-deal", isAdmin, async (req, res) => {
    try {
      const { siteId, dealPageData } = req.body;
      
      // Update the discovered site status
      await storage.updateDiscoveredSite(siteId, { status: 'approved' });
      
      // Create the deal page
      const dealPage = await storage.createDealPage({
        ...dealPageData,
        discoveredSiteId: siteId,
      });
      
      res.json({ 
        success: true, 
        dealPage,
        message: `Deal page created: /deal/${dealPage.slug}` 
      });
    } catch (error) {
      console.error("Error approving and creating deal:", (error as Error).message);
      res.status(500).json({ error: "Failed to approve and create deal page" });
    }
  });

  // Get single discovered site
  app.get("/api/admin/discovery/sites/:siteId", isAdmin, async (req, res) => {
    try {
      const siteId = parseInt(req.params.siteId);
      const site = await storage.getDiscoveredSite(siteId);
      
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      res.json({ success: true, site });
    } catch (error) {
      console.error("Error fetching discovered site:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch site" });
    }
  });

  // Deal extraction endpoints
  app.post("/api/admin/discovery/extract-deal/:siteId", isAdmin, async (req, res) => {
    try {
      const siteId = parseInt(req.params.siteId);
      
      // Try simple extraction first (more reliable)
      const { simpleExtractionEngine } = await import('./services/simpleExtraction');
      const extractedDeal = await simpleExtractionEngine.enhanceDiscoveredSite(siteId);
      
      if (!extractedDeal) {
        return res.status(400).json({ error: "Could not extract deal from this site" });
      }
      
      res.json({ 
        success: true, 
        extractedDeal,
        message: "Deal extracted successfully" 
      });
    } catch (error) {
      console.error("Error extracting deal:", (error as Error).message);
      res.status(500).json({ error: "Failed to extract deal" });
    }
  });

  app.post("/api/admin/discovery/batch-extract", isAdmin, async (req, res) => {
    try {
      const { limit = 5 } = req.body;
      const { dealExtractionEngine } = await import('./services/dealExtractionEngine');
      
      const enhancedCount = await dealExtractionEngine.batchEnhanceDiscoveredSites(limit);
      
      res.json({ 
        success: true, 
        enhancedCount,
        message: `Enhanced ${enhancedCount} discovered deals` 
      });
    } catch (error) {
      console.error("Error in batch extraction:", (error as Error).message);
      res.status(500).json({ error: "Failed to batch extract deals" });
    }
  });

  // Test endpoint for direct URL extraction
  app.post("/api/admin/discovery/test-extract", isAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Try simple extraction first (more reliable)
      const { simpleExtractionEngine } = await import('./services/simpleExtraction');
      const extractedDeal = await simpleExtractionEngine.extractDealFromUrl(url);
      
      if (!extractedDeal) {
        return res.status(400).json({ error: "Could not extract deal from this URL" });
      }
      
      res.json({ 
        success: true, 
        extractedDeal,
        message: "Deal extracted successfully" 
      });
    } catch (error) {
      console.error("Error testing extraction:", (error as Error).message);
      res.status(500).json({ error: "Failed to extract deal" });
    }
  });

  // Admin MLB analytics endpoints
  app.get('/api/admin/mlb/recent-games/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get recent games from database
      const recentGames = await db.select({
        id: games.id,
        opponent: games.opponent,
        gameDate: games.gameDate,
        isHome: games.isHome,
        teamScore: games.teamScore,
        opponentScore: games.opponentScore,
        isComplete: games.isComplete,
        gameStats: games.gameStats,
        externalId: games.externalId
      }).from(games)
        .where(eq(games.teamId, parseInt(teamId)))
        .orderBy(desc(games.gameDate))
        .limit(limit);

      res.json(recentGames);
    } catch (error) {
      console.error("Error fetching recent games:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch recent games" });
    }
  });

  app.get('/api/admin/mlb/upcoming-games/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = req.params;
      const team = await db.select().from(teams).where(eq(teams.id, parseInt(teamId))).limit(1);
      
      if (!team.length) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Get upcoming games from MLB API
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const upcomingGames = [];
      for (let d = new Date(today); d <= nextWeek; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayGames = await mlbApiService.getGamesForDate(dateStr);
        
        const teamGames = dayGames.filter(game => 
          game.teams.home.team.id.toString() === team[0].externalId ||
          game.teams.away.team.id.toString() === team[0].externalId
        );
        
        upcomingGames.push(...teamGames.map(game => ({
          ...game,
          isHome: game.teams.home.team.id.toString() === team[0].externalId
        })));
      }

      res.json(upcomingGames);
    } catch (error) {
      console.error("Error fetching upcoming games:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch upcoming games" });
    }
  });

  app.get('/api/admin/mlb/triggered-deals', isAdmin, async (req, res) => {
    try {
      const triggeredDealsData = await db.select({
        id: triggeredDeals.id,
        triggeredAt: triggeredDeals.triggeredAt,
        expiresAt: triggeredDeals.expiresAt,
        isActive: triggeredDeals.isActive,
        promotionTitle: promotions.title,
        promotionDescription: promotions.description,
        restaurantName: restaurants.name,
        teamName: teams.name,
        gameOpponent: games.opponent,
        gameDate: games.gameDate,
        teamScore: games.teamScore,
        opponentScore: games.opponentScore
      }).from(triggeredDeals)
        .innerJoin(promotions, eq(triggeredDeals.promotionId, promotions.id))
        .innerJoin(restaurants, eq(promotions.restaurantId, restaurants.id))
        .innerJoin(teams, eq(promotions.teamId, teams.id))
        .innerJoin(games, eq(triggeredDeals.gameId, games.id))
        .orderBy(desc(triggeredDeals.triggeredAt))
        .limit(50);

      res.json(triggeredDealsData);
    } catch (error) {
      console.error("Error fetching triggered deals:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch triggered deals" });
    }
  });

  app.get('/api/admin/mlb/analytics/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      
      // Get team analytics
      const teamGames = await db.select().from(games)
        .where(and(
          eq(games.teamId, parseInt(teamId)),
          eq(games.isComplete, true)
        ))
        .orderBy(desc(games.gameDate))
        .limit(days);

      const analytics = {
        totalGames: teamGames.length,
        wins: teamGames.filter(g => g.teamScore! > g.opponentScore!).length,
        losses: teamGames.filter(g => g.teamScore! < g.opponentScore!).length,
        homeGames: teamGames.filter(g => g.isHome).length,
        awayGames: teamGames.filter(g => !g.isHome).length,
        homeWins: teamGames.filter(g => g.isHome && g.teamScore! > g.opponentScore!).length,
        awayWins: teamGames.filter(g => !g.isHome && g.teamScore! > g.opponentScore!).length,
        averageRunsScored: teamGames.length > 0 ? teamGames.reduce((sum, g) => sum + (g.teamScore || 0), 0) / teamGames.length : 0,
        averageRunsAllowed: teamGames.length > 0 ? teamGames.reduce((sum, g) => sum + (g.opponentScore || 0), 0) / teamGames.length : 0,
        gamesScored6Plus: teamGames.filter(g => (g.teamScore || 0) >= 6).length,
        recentForm: teamGames.slice(0, 10).map(g => g.teamScore! > g.opponentScore! ? 'W' : 'L').join('')
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching team analytics:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch team analytics" });
    }
  });

  // Start the game processor on server startup
  // gameProcessor.start(); // Temporarily disabled for testing

  const httpServer = createServer(app);
  return httpServer;
}
