import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, csrfProtection } from "./googleAuth";
import { mlbApiService } from "./services/mlbApiService";
import { gameProcessor } from "./services/gameProcessor";
import { db } from "./db";
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
import { agentsRouter, setupWebSocketEvents } from "./src/routes/agents";
import { Server as SocketIOServer } from "socket.io";
import { insertAlertPreferenceSchema, insertPromotionSchema, insertTeamSchema, insertRestaurantSchema } from "@shared/schema";
import { config } from "./config";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Register notification routes
  registerNotificationRoutes(app);
  
  // Register game scheduling routes
  registerGameSchedulingRoutes(app);
  
  // Register agent orchestration routes
  app.use('/api/agents', agentsRouter);
  
  // Register deal verification routes
  const dealVerificationRoutes = await import("./routes/dealVerification");
  app.use('/api/deal-verification', isAuthenticated, dealVerificationRoutes.default);
  
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
      await promotionService.syncRecentGames(teamId);
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
      const { limit } = z.object({ limit: z.number().optional() }).parse(req.query);
      const sites = await storage.getDiscoveredSites(limit || 50);
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
      const { limit } = z.object({ limit: z.number().optional() }).parse(req.query);
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

  // Simple approve/reject endpoints
  app.post("/api/admin/deals/:id/approve", isAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().regex(/^\d+$/).transform(Number) }).parse(req.params);
      
      const updatedSite = await storage.updateDiscoveredSite(id, { 
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: 'admin'
      });
      
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
  
  // Setup Socket.IO for real-time agent monitoring
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "development" ? "http://localhost:5173" : false,
      methods: ["GET", "POST"]
    }
  });
  
  // Setup WebSocket events for agent orchestrator
  setupWebSocketEvents(io);
  
  return httpServer;
}