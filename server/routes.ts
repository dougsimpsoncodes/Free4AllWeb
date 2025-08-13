import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, csrfProtection } from "./clerkAuth";
import { mlbApiService } from "./services/mlbApiService";
import { gameProcessor } from "./services/gameProcessor";
import { db } from "./supabaseDb";
import { games, teams, promotions, restaurants, triggeredDeals } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { realTimeDealMonitor } from "./services/realTimeDealMonitor";
import { dealPatternMatcher } from "./services/dealPatternMatcher";
import { dealMigrationService } from "./services/dealMigrationService";
import path from "path";
import fs from "fs";
import { multiSportsApiService } from "./services/multiSportsApiService";
import { promotionService } from "./services/promotionService";
import { seedSportsData } from "./seedData";
import { gameScrapingService } from "./services/gameScrapingService";
import { notificationService } from "./services/notificationService";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerGameSchedulingRoutes } from "./routes/gameScheduling";
import { Server as SocketIOServer } from "socket.io";
import { insertAlertPreferenceSchema, insertPromotionSchema, insertTeamSchema, insertRestaurantSchema } from "@shared/schema";
import { config } from "./config";
import multer from 'multer';

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Register notification routes
  registerNotificationRoutes(app);
  
  // Register game scheduling routes
  registerGameSchedulingRoutes(app);
  
  // Agent routes removed - fake system eliminated
  
  // Register deal verification routes
  const dealVerificationRoutes = await import("./routes/dealVerification");
  app.use('/api/deal-verification', isAuthenticated, dealVerificationRoutes.default);
  
  // Serve logos directly - SECURITY: Path traversal protection
  app.get('/logos/:filename', (req, res) => {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    
    // Validate filename format (alphanumeric, dots, dashes, underscores only)
    if (!/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filename)) {
      return res.status(400).send('Invalid filename format');
    }
    
    const logoPath = path.join(process.cwd(), 'public', 'logos', filename);
    
    // Ensure the resolved path is still within the logos directory
    const logosDir = path.join(process.cwd(), 'public', 'logos');
    if (!logoPath.startsWith(logosDir)) {
      return res.status(403).send('Access denied');
    }
    
    if (fs.existsSync(logoPath)) {
      res.sendFile(path.resolve(logoPath));
    } else {
      res.status(404).send('Logo not found');
    }
  });

  // Serve uploaded deal images - SECURITY: Path traversal protection
  app.get('/uploads/deals/:filename', (req, res) => {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    
    // Validate filename format (alphanumeric, dots, dashes, underscores only)
    if (!/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|gif|webp)$/i.test(filename)) {
      return res.status(400).send('Invalid filename format');
    }
    
    const imagePath = path.join(process.cwd(), 'uploads', 'deals', filename);
    
    // Ensure the resolved path is still within the uploads/deals directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'deals');
    if (!imagePath.startsWith(uploadsDir)) {
      return res.status(403).send('Access denied');
    }
    
    if (fs.existsSync(imagePath)) {
      res.sendFile(path.resolve(imagePath));
    } else {
      res.status(404).send('Image not found');
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
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);

      let promotions;
      
      if (teamId) {
        promotions = await storage.getPromotionsByTeam(teamId);
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
      const { teamId, page, limit } = z.object({
        teamId: z.string().regex(/^\d+$/).transform(Number).optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
      }).parse(req.query);

      let deals;

      if (teamId) {
        deals = await promotionService.getActiveDealsForTeam(teamId);
        res.json(deals);
      } else {
        const result = await storage.getActiveTriggeredDealsWithDetailsPaginated(page || 1, limit || 20);
        res.json({
          deals: result.deals,
          pagination: {
            page: page || 1,
            limit: limit || 20,
            total: result.total,
            totalPages: Math.ceil(result.total / (limit || 20)),
            hasNext: (page || 1) * (limit || 20) < result.total,
            hasPrev: (page || 1) > 1
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
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const { limit } = z.object({ limit: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);

      const games = await storage.getRecentGames(teamId, limit || 5);
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
          await notificationService.sendWelcomeEmail(user);
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
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);

      // Verify ownership
      const existingPreference = await storage.getUserAlertPreferences(userId);
      const ownedPreference = existingPreference.find(p => p.id === id);
      
      if (!ownedPreference) {
        return res.status(404).json({ message: "Alert preference not found" });
      }

      const updatedPreference = await storage.updateAlertPreference(id, req.body);
      res.json(updatedPreference);
    } catch (error) {
      console.error("Error updating alert preference:", (error as Error).message);
      res.status(400).json({ message: "Failed to update alert preference" });
    }
  });

  app.delete('/api/alert-preferences/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      
      // Verify ownership
      const existingPreferences = await storage.getUserAlertPreferences(userId);
      const ownedPreference = existingPreferences.find(p => p.id === id);
      
      if (!ownedPreference) {
        return res.status(404).json({ message: "Alert preference not found" });
      }

      await storage.deleteAlertPreference(id);
      res.json({ message: "Alert preference deleted" });
    } catch (error) {
      console.error("Error deleting alert preference:", (error as Error).message);
      res.status(400).json({ message: "Failed to delete alert preference" });
    }
  });

  // Admin routes (protected)
  app.post('/api/admin/teams', csrfProtection, isAdmin, async (req: any, res) => {
    try {
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
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      console.log(`ROUTE: Sync games called for team ${teamId}`);
      await promotionService.syncRecentGames(teamId);
      console.log(`ROUTE: Sync games completed for team ${teamId}`);
      res.json({ message: "Games synced successfully" });
    } catch (error) {
      console.error("Error syncing games:", (error as Error).message);
      res.status(500).json({ message: "Failed to sync games" });
    }
  });

  app.get('/api/admin/analytics', isAdmin, async (req: any, res) => {
    try {
      const activeDeals = await storage.getActiveTriggeredDeals();
      const totalUsers = await storage.getUsersByTeamPreference(config.DODGERS_TEAM_ID);
      
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

  // Sports data routes
  app.get('/api/teams/:sport', async (req, res) => {
    try {
      const { sport } = z.object({ sport: z.string() }).parse(req.params);
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

  // Development routes (no auth required for testing)
  app.get('/api/mlb/games/status', isAdmin, async (req, res) => {
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

  app.get('/api/mlb/games/today', isAdmin, async (req, res) => {
    try {
      const recentGames = await storage.getRecentGames(config.DODGERS_TEAM_ID, 10);
      res.json(recentGames);
    } catch (error) {
      console.error('Error fetching today\'s games:', (error as Error).message);
      res.status(500).json({ message: 'Failed to fetch games' });
    }
  });

  app.post('/api/mlb/games/process', isAdmin, async (req, res) => {
    try {
      await gameProcessor.triggerManualProcess();
      res.json({ message: 'Game processing completed successfully' });
    } catch (error) {
      console.error('Error processing games:', (error as Error).message);
      res.status(500).json({ message: 'Failed to process games' });
    }
  });

  app.get('/api/admin/promotions', isAdmin, async (req, res) => {
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

  // Apple Push Notifications Management
  app.post('/api/device-token/register', async (req, res) => {
    try {
      const { deviceToken, platform, deviceInfo } = z.object({
        deviceToken: z.string().min(1, 'Device token is required'),
        platform: z.enum(['ios', 'android', 'web']),
        deviceInfo: z.object({
          model: z.string().optional(),
          osVersion: z.string().optional(),
          appVersion: z.string().optional()
        }).optional()
      }).parse(req.body);

      // For now, use a default user for testing. In production, this would be tied to actual user accounts
      const userId = 'anonymous_device';

      // Ensure anonymous user exists in database
      try {
        await storage.upsertUser({
          id: userId,
          email: 'anonymous@free4allweb.com',
          firstName: 'Anonymous',
          lastName: 'Device',
          profileImageUrl: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } catch (error) {
        // User might already exist, continue
        console.log('User creation error (might already exist):', error);
      }

      await storage.saveDeviceToken(userId, deviceToken, platform, deviceInfo);

      console.log(`Device token registered for user ${userId}: ${platform} device ${deviceToken.substring(0, 8)}***`);
      
      res.json({ 
        success: true, 
        message: 'Device token registered successfully',
        platform,
        deviceInfo
      });
    } catch (error) {
      console.error('Error registering device token:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request data', 
          details: error.errors 
        });
      }
      res.status(500).json({ error: 'Failed to register device token' });
    }
  });

  app.delete('/api/device-token/deregister', isAuthenticated, async (req, res) => {
    try {
      const { deviceToken } = z.object({
        deviceToken: z.string().min(1, 'Device token is required')
      }).parse(req.body);

      await storage.deactivateDeviceToken(deviceToken);

      console.log(`Device token deregistered: ${deviceToken.substring(0, 8)}***`);
      
      res.json({ 
        success: true, 
        message: 'Device token deregistered successfully' 
      });
    } catch (error) {
      console.error('Error deregistering device token:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request data', 
          details: error.errors 
        });
      }
      res.status(500).json({ error: 'Failed to deregister device token' });
    }
  });

  app.get('/api/device-tokens/my-devices', isAuthenticated, async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in auth context' });
      }

      const iosTokens = await storage.getUserDeviceTokens(userId, 'ios');
      const androidTokens = await storage.getUserDeviceTokens(userId, 'android');
      const webTokens = await storage.getUserDeviceTokens(userId, 'web');

      res.json({
        devices: {
          ios: iosTokens.length,
          android: androidTokens.length,
          web: webTokens.length,
          total: iosTokens.length + androidTokens.length + webTokens.length
        },
        // Don't expose actual tokens for security
        hasDevices: (iosTokens.length + androidTokens.length + webTokens.length) > 0
      });
    } catch (error) {
      console.error('Error fetching user devices:', error);
      res.status(500).json({ error: 'Failed to fetch device information' });
    }
  });

  app.post('/api/notifications/test', isAuthenticated, async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in auth context' });
      }

      const { notificationService } = await import('./services/notificationService');
      const result = await notificationService.testNotification(userId);

      res.json({
        success: true,
        message: 'Test notification sent',
        results: result
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  app.get('/api/notifications/status', isAuthenticated, async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in auth context' });
      }

      const { notificationService } = await import('./services/notificationService');
      const preferences = await storage.getUserNotificationPreferences(userId);
      const status = notificationService.getNotificationStatus();

      res.json({
        userPreferences: preferences,
        serviceStatus: status,
        canReceivePushNotifications: preferences.pushNotifications && status.apns.configured
      });
    } catch (error) {
      console.error('Error fetching notification status:', error);
      res.status(500).json({ error: 'Failed to fetch notification status' });
    }
  });

  // TESTING ENDPOINTS - Remove in production
  app.get('/api/test/apns-status', async (req, res) => {
    try {
      const { notificationService } = await import('./services/notificationService');
      const status = notificationService.getNotificationStatus();
      
      res.json({
        message: 'APNs Testing Endpoint',
        status,
        timestamp: new Date().toISOString(),
        ready: status.apns.configured
      });
    } catch (error) {
      console.error('Error in test endpoint:', error);
      res.status(500).json({ error: 'Test endpoint failed' });
    }
  });

  app.post('/api/test/device-token', async (req, res) => {
    try {
      const { deviceToken, platform = 'ios', userId = 'test_user_123' } = req.body;
      
      if (!deviceToken) {
        return res.status(400).json({ error: 'deviceToken is required' });
      }

      // For testing - create a test user if doesn't exist
      try {
        await storage.saveDeviceToken(userId, deviceToken, platform, {
          model: 'Test Device',
          osVersion: '18.0',
          appVersion: '1.0.0-test'
        });
      } catch (error) {
        console.error('Error saving test device token:', error);
      }

      console.log(`🧪 TEST: Device token registered - ${platform} device ${deviceToken.substring(0, 8)}***`);
      
      res.json({ 
        success: true, 
        message: 'Test device token registered',
        deviceToken: deviceToken.substring(0, 8) + '***',
        platform,
        userId
      });
    } catch (error) {
      console.error('Error in test device token endpoint:', error);
      res.status(500).json({ error: 'Failed to register test device token' });
    }
  });

  app.post('/api/test/send-notification', async (req, res) => {
    try {
      const { userId = 'anonymous_device', type = 'deal' } = req.body;
      const { apnsService } = await import('./services/apnsService');

      if (type === 'deal') {
        const result = await apnsService.sendDealAlert(userId, {
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
        });

        res.json({
          success: true,
          message: 'Test deal notification sent',
          result,
          type: 'deal_alert'
        });
      } else {
        const result = await apnsService.sendPreGameAlert(userId, {
          gameId: 999,
          homeTeam: 'LA Dodgers',
          awayTeam: 'San Francisco Giants',
          gameTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          venue: 'Dodger Stadium',
          potentialDeals: [{
            restaurant: 'Panda Express',
            offer: '$6 Panda Plate',
            trigger: 'Dodgers Win'
          }]
        });

        res.json({
          success: true,
          message: 'Test pre-game notification sent',
          result,
          type: 'pre_game_alert'
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  // Admin routes for data management
  app.post('/api/admin/seed-data', isAdmin, async (req, res) => {
    try {
      await seedSportsData();
      res.json({ message: 'Sports data seeded successfully' });
    } catch (error) {
      console.error('Error seeding data:', (error as Error).message);
      res.status(500).json({ message: 'Failed to seed data' });
    }
  });

  // Demo game data seeding removed - was test/mock data

  // Scraping and testing routes
  app.post('/api/admin/scrape-all-teams', isAdmin, async (req, res) => {
    try {
      console.log('🚀 Starting comprehensive team scraping...');
      const report = await gameScrapingService.generateScrapingReport();
      res.json(report);
    } catch (error) {
      console.error('Error during team scraping:', (error as Error).message);
      res.status(500).json({ message: 'Failed to scrape team data', error: (error as Error).message });
    }
  });

  app.post('/api/admin/scrape-team/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const team = await storage.getTeam(teamId);
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

  app.get('/api/admin/test-promotions/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const analysis = await gameScrapingService.testPromotionTriggers(teamId);
      res.json(analysis);
    } catch (error) {
      console.error('Error testing promotions:', (error as Error).message);
      res.status(500).json({ message: 'Failed to test promotions', error: (error as Error).message });
    }
  });

  // External sports API testing
  app.get('/api/admin/test-sports-api/:sport/:teamId', isAdmin, async (req, res) => {
    try {
      const { sport, teamId } = z.object({ sport: z.string(), teamId: z.string() }).parse(req.params);
      const { days } = z.object({ days: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);
      
      console.log(`🔍 Testing ${sport} API for team ${teamId}...`);
      const games = await multiSportsApiService.getGamesForTeam(sport, teamId, days || 7);
      
      res.json({
        sport,
        teamId,
        daysSearched: days || 7,
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
      const { limit } = z.object({ limit: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);
      const sites = await storage.getDiscoveredSites();
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
      const { limit } = z.object({ limit: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);
      const pendingSites = await storage.getPendingDiscoveredSites(limit || 50);
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

  // Simple approve/reject endpoints with structured deal data
  app.post("/api/admin/deals/:id/approve", isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const { dealDetails, sourceUrl } = req.body;
      
      console.log("=== DEAL APPROVAL ===");
      console.log("Deal ID:", id);
      console.log("Source URL:", sourceUrl);
      console.log("Deal Details:", JSON.stringify(dealDetails, null, 2));
      console.log("User:", req.user?.email);
      
      // Update discovered site as approved
      const updatedSite = await storage.updateDiscoveredSite(id, { 
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: req.user?.id || 'admin'
      });
      
      // Store structured deal data with idempotent creation
      if (dealDetails) {
        console.log("Structured Trigger Conditions:");
        console.log("- Type:", dealDetails.triggerType);
        console.log("- Conditions:", dealDetails.triggerConditions);
        console.log("- Logic:", dealDetails.triggerLogic);
        
        try {
          const promotion = await storage.createPromotionFromDiscoveredSite(
            id,
            dealDetails,
            req.user?.id || 'admin'
          );
          
          console.log(`Created promotion ${promotion.id} with state: ${promotion.state}`);
          console.log(`Validation status: ${promotion.validationStatus}`);
          console.log(`Source fingerprint: ${promotion.sourceFingerprint}`);
          
        } catch (error) {
          console.error("Error creating promotion:", (error as Error).message);
          // Don't fail the approval if promotion creation fails - log and continue
        }
      }
      
      console.log("=== APPROVAL COMPLETE ===");
      
      res.json({
        success: true,
        message: 'Deal approved successfully',
        site: updatedSite
      });
    } catch (error) {
      console.error("Error approving deal:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/admin/deals/:id/reject", isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      
      const updatedSite = await storage.updateDiscoveredSite(id, { 
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: 'admin'
      });
      
      res.json({
        success: true,
        message: 'Deal rejected successfully',
        site: updatedSite
      });
    } catch (error) {
      console.error("Error rejecting deal:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.put("/api/admin/discovery/sites/:id", isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const updates = req.body;
      
      const updatedSite = await storage.updateDiscoveredSite(id, updates);
      
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
      const { enhancedDealDiscoveryService } = await import('./services/enhancedDealDiscovery');
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
      const { enhancedDealDiscoveryService } = await import('./services/enhancedDealDiscovery');
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
      const { dealId } = z.object({ dealId: z.string() }).parse(req.params);
      const { imageAssetPath } = req.body;
      
      const { enhancedDealDiscoveryService } = await import('./services/enhancedDealDiscovery');
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
      const { dealId } = z.object({ dealId: z.string() }).parse(req.params);
      const { enhancedDealDiscoveryService } = await import('./services/enhancedDealDiscovery');
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
      const { dealIds } = z.object({ dealIds: z.array(z.string()) }).parse(req.body);
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

  // APNs monitoring endpoint for production
  app.get('/api/admin/apns/status', isAdmin, async (req, res) => {
    try {
      const { apnsService } = await import('./services/apnsService');
      const status = apnsService.getStatus();
      
      res.json({
        success: true,
        apns: {
          configured: status.configured,
          provider: status.provider,
          environment: process.env.APNS_ENVIRONMENT || 'sandbox',
          bundleId: process.env.APNS_BUNDLE_ID || 'not-configured',
          keyIdMasked: process.env.APNS_KEY_ID ? `${process.env.APNS_KEY_ID.substring(0, 4)}***` : 'not-configured',
          teamIdMasked: process.env.APNS_TEAM_ID ? `${process.env.APNS_TEAM_ID.substring(0, 4)}***` : 'not-configured'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting APNs status:', (error as Error).message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get APNs status',
        apns: { configured: false }
      });
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
      const { minutes } = z.object({ minutes: z.number().min(5) }).parse(req.body);
      realTimeDealMonitor.setInterval(minutes);
      res.json({ success: true, message: `Interval set to ${minutes} minutes` });
    } catch (error) {
      console.error('Error setting interval:', (error as Error).message);
      res.status(500).json({ error: 'Failed to set interval' });
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
      const { slug } = z.object({ slug: z.string() }).parse(req.params);
      const dealPage = await storage.getDealPage(slug);
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
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const dealPage = await storage.updateDealPage(id, req.body);
      res.json(dealPage);
    } catch (error) {
      console.error("Error updating deal page:", (error as Error).message);
      res.status(500).json({ error: "Failed to update deal page" });
    }
  });

  app.delete("/api/admin/deal-pages/:id", isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      await storage.deleteDealPage(id);
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
      const { siteId } = z.object({ siteId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
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

  // Configure multer for image uploads
  const uploadsDir = path.join(process.cwd(), 'uploads', 'deals');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const multerStorage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      // SECURITY: Generate cryptographically secure filename
      const crypto = require('crypto');
      const randomBytes = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      
      // Sanitize and validate extension
      const originalExt = path.extname(file.originalname).toLowerCase();
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (!allowedExts.includes(originalExt)) {
        return cb(new Error('Invalid file extension'), '');
      }
      
      cb(null, `deal-${timestamp}-${randomBytes}${originalExt}`);
    }
  });

  const upload = multer({
    storage: multerStorage,
    limits: { 
      fileSize: 1 * 1024 * 1024, // SECURITY: Reduced to 1MB limit
      files: 1 // Only allow 1 file per upload
    },
    fileFilter: (req, file, cb) => {
      // SECURITY: Strict file validation
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp'
      ];
      
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      if (!allowedMimeTypes.includes(file.mimetype) || !allowedExts.includes(fileExt)) {
        return cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
      }
      
      // Additional filename security check
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        return cb(new Error('Invalid filename'));
      }
      
      cb(null, true);
    }
  });

  // Image upload endpoint for deals
  app.post("/api/admin/upload-image", isAdmin, upload.single('image'), (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided'
        });
      }
      
      // Return the URL path for the uploaded image
      const imageUrl = `/uploads/deals/${req.file.filename}`;
      
      console.log(`Image uploaded: ${req.file.filename} -> ${imageUrl}`);
      
      res.json({
        success: true,
        url: imageUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error("Error processing image upload:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: "Failed to process image upload"
      });
    }
  });

  // Helper function to detect Date objects deep in payload
  function findDatesDeep(obj: any, path: string[] = [], hits: string[] = []): string[] {
    if (obj instanceof Date) hits.push(path.join("."));
    else if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) findDatesDeep(obj[k], [...path, k], hits);
    }
    return hits;
  }

  // Manual deal creation endpoint
  app.post("/api/admin/deals/manual", isAdmin, async (req, res) => {
    try {
      const { dealDetails } = req.body;
      
      console.log("=== MANUAL DEAL CREATION ===");
      console.log("Deal Details:", JSON.stringify(dealDetails, null, 2));
      console.log("Created by:", req.user?.email);
      
      // Find restaurant and team IDs from names
      const restaurants = await storage.getActiveRestaurants();
      const teams = await storage.getActiveTeams();
      
      // Simple exact match for restaurant names (UI sends exact database names)
      const restaurant = restaurants.find(r => r.name === dealDetails.restaurant);
      const team = teams.find(t => t.name === dealDetails.team);
      
      if (!restaurant) {
        return res.status(400).json({ success: false, error: `Restaurant not found: ${dealDetails.restaurant}` });
      }
      
      if (!team) {
        return res.status(400).json({ success: false, error: `Team not found: ${dealDetails.team}` });
      }
      
      const payload = {
        teamId: team.id,
        restaurantId: restaurant.id,
        title: dealDetails.offerTitle,
        triggerCondition: `${dealDetails.triggerType}: ${dealDetails.triggerConditions.map(c => 
          `${c.stat} ${c.operator} ${c.value} (${c.gameLocation} games)`
        ).join(` ${dealDetails.triggerLogic} `)}`,
        source: "manual",
        validUntil: dealDetails.expirationDate || undefined,
        promoCode: dealDetails.promoCode || undefined,
        description: dealDetails.description || undefined,
        redemptionInstructions: dealDetails.redemptionInstructions || undefined,
        discoveryData: {
          imageUrl: dealDetails.imageUrl || null,
          sourceUrl: dealDetails.sourceUrl || null,
          createdBy: req.user?.email || 'admin',
          type: 'manual'
        },
        approvalStatus: 'approved',
        approvedBy: req.user?.email || 'admin',
        approvedAt: new Date()
      };

      // Detect any Date objects in payload
      const dateFields = findDatesDeep(payload);
      if (dateFields.length) {
        console.warn("JS Date detected in payload fields:", dateFields);
      }

      // Try the absolute simplest approach - no dates at all
      const promotionData: any = {
        teamId: team.id,
        restaurantId: restaurant.id,
        title: dealDetails.offerTitle,
        triggerCondition: `${dealDetails.triggerType}: ${dealDetails.triggerConditions.map(c => 
          `${c.stat} ${c.operator} ${c.value} (${c.gameLocation} games)`
        ).join(` ${dealDetails.triggerLogic} `)}`
      };
      
      // Only add optional fields if they have values (no dates)
      if (dealDetails.description) promotionData.description = dealDetails.description;
      if (dealDetails.promoCode) promotionData.promoCode = dealDetails.promoCode;
      if (dealDetails.redemptionInstructions) promotionData.redemptionInstructions = dealDetails.redemptionInstructions;
      promotionData.source = 'manual';
      promotionData.approvalStatus = 'approved';
      promotionData.approvedBy = req.user?.email || 'admin';
      
      console.log("Promotion data being sent:", JSON.stringify(promotionData, null, 2));
      
      const promotion = await storage.createPromotion(promotionData);
      
      console.log("Created promotion:", promotion.id);
      console.log("=== MANUAL DEAL CREATION COMPLETE ===");
      
      res.json({
        success: true,
        message: 'Manual deal created successfully',
        promotion,
        details: {
          restaurant: restaurant.name,
          team: team.name,
          trigger: promotion.triggerCondition
        }
      });
    } catch (error) {
      console.error("Error creating manual deal:", (error as Error).message);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Deal extraction endpoints
  app.post("/api/admin/discovery/extract-deal/:siteId", isAdmin, async (req, res) => {
    try {
      const { siteId } = z.object({ siteId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      
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
      const { limit } = z.object({ limit: z.number().optional() }).parse(req.body);
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
      const { url } = z.object({ url: z.string().url() }).parse(req.body);
      
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

  // Clustering and Evidence Storage endpoints
  app.post('/api/admin/discovery/cluster', isAdmin, async (req, res) => {
    try {
      const { teamName, sport } = z.object({
        teamName: z.string(),
        sport: z.string()
      }).parse(req.body);

      const { ClusteringEngine } = await import('./services/clusteringEngine.js');
      const clustering = new ClusteringEngine();
      
      const clusters = await clustering.clusterDiscoveries(teamName, sport);
      
      res.json({ 
        success: true, 
        clusters,
        count: clusters.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error clustering discoveries:", (error as Error).message);
      res.status(500).json({ error: "Failed to cluster discoveries" });
    }
  });

  app.post('/api/admin/discovery/detect-duplicates', isAdmin, async (req, res) => {
    try {
      const { siteIds } = z.object({
        siteIds: z.array(z.number())
      }).parse(req.body);

      const { ClusteringEngine } = await import('./services/clusteringEngine.js');
      const clustering = new ClusteringEngine();
      
      const result = await clustering.detectDuplicates(siteIds);
      
      res.json({ 
        success: true, 
        ...result,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error detecting duplicates:", (error as Error).message);
      res.status(500).json({ error: "Failed to detect duplicates" });
    }
  });

  app.post('/api/admin/discovery/:id/capture-evidence', isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);

      const { EvidenceStorage } = await import('./services/evidenceStorage.js');
      const evidenceStorage = new EvidenceStorage();
      
      const evidence = await evidenceStorage.captureEvidence(id);
      
      res.json({ 
        success: true, 
        evidence,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error capturing evidence:", (error as Error).message);
      res.status(500).json({ error: "Failed to capture evidence" });
    }
  });

  app.post('/api/admin/discovery/batch-evidence', isAdmin, async (req, res) => {
    try {
      const { siteIds } = z.object({
        siteIds: z.array(z.number())
      }).parse(req.body);

      const { EvidenceStorage } = await import('./services/evidenceStorage.js');
      const evidenceStorage = new EvidenceStorage();
      
      const results = await evidenceStorage.batchCaptureEvidence(siteIds);
      
      // Cleanup browser resources
      await evidenceStorage.cleanup();
      
      res.json({ 
        success: true, 
        results,
        count: results.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error batch capturing evidence:", (error as Error).message);
      res.status(500).json({ error: "Failed to batch capture evidence" });
    }
  });

  app.get('/api/admin/discovery/:id/evidence', isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);

      const { EvidenceStorage } = await import('./services/evidenceStorage.js');
      const evidenceStorage = new EvidenceStorage();
      
      const evidence = await evidenceStorage.getEvidence(id);
      
      if (!evidence) {
        return res.status(404).json({ error: "Evidence not found" });
      }
      
      res.json({ 
        success: true, 
        evidence,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error retrieving evidence:", (error as Error).message);
      res.status(500).json({ error: "Failed to retrieve evidence" });
    }
  });

  // Admin MLB analytics endpoints
  app.get('/api/admin/mlb/recent-games/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const { limit } = z.object({ limit: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);
      
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
        .where(eq(games.teamId, teamId))
        .orderBy(desc(games.gameDate))
        .limit(limit || 10);

      res.json(recentGames);
    } catch (error) {
      console.error("Error fetching recent games:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch recent games" });
    }
  });

  app.get('/api/admin/mlb/upcoming-games/:teamId', isAdmin, async (req, res) => {
    try {
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      
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
      const { teamId } = z.object({ teamId: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      const { days } = z.object({ days: z.string().regex(/^\d+$/).transform(Number).optional() }).parse(req.query);
      
      // Get team analytics
      const teamGames = await db.select().from(games)
        .where(and(
          eq(games.teamId, teamId),
          eq(games.isComplete, true)
        ))
        .orderBy(desc(games.gameDate))
        .limit(days || 30);

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
  
  // WebSocket support for real-time features (agent monitoring removed)
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "development" ? "http://localhost:5173" : false,
      methods: ["GET", "POST"]
    }
  });
  
  return httpServer;
}