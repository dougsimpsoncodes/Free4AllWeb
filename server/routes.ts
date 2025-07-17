import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./googleAuth";
import { mlbApiService } from "./services/mlbApiService";
import { gameProcessor } from "./services/gameProcessor";
import { db } from "./db";
import { games, teams, promotions, restaurants, triggeredDeals } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { dealDiscoveryService } from "./services/dealImageScrapingService";
import path from "path";
import fs from "fs";
import { multiSportsApiService } from "./services/multiSportsApiService";
import { promotionService } from "./services/promotionService";
import { seedSportsData } from "./seedData";
import { gameScrapingService } from "./services/gameScrapingService";
import { promotionService } from "./services/promotionService";
import { emailService } from "./services/emailService";
import { insertAlertPreferenceSchema, insertPromotionSchema, insertTeamSchema, insertRestaurantSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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
      console.error("Error fetching user:", error);
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
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Public routes - Teams and restaurants
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getActiveTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get('/api/restaurants', async (req, res) => {
    try {
      const restaurants = await storage.getActiveRestaurants();
      res.json(restaurants);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
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
      console.error("Error fetching promotions:", error);
      res.status(500).json({ message: "Failed to fetch promotions" });
    }
  });

  app.get('/api/active-deals', async (req, res) => {
    try {
      const teamId = req.query.teamId as string;
      let deals;

      if (teamId) {
        deals = await promotionService.getActiveDealsForTeam(parseInt(teamId));
      } else {
        // Get all active deals with related data
        const triggeredDeals = await storage.getActiveTriggeredDeals();
        deals = [];

        for (const deal of triggeredDeals) {
          const promotion = await storage.getPromotion(deal.promotionId!);
          if (promotion) {
            const restaurant = await storage.getRestaurant(promotion.restaurantId!);
            const team = await storage.getTeam(promotion.teamId!);
            const game = await storage.getGame(deal.gameId!);
            
            deals.push({
              deal,
              promotion,
              restaurant,
              team,
              game,
            });
          }
        }
      }

      res.json(deals);
    } catch (error) {
      console.error("Error fetching active deals:", error);
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
      console.error("Error fetching recent games:", error);
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
      console.error("Error fetching alert preferences:", error);
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
      console.error("Error creating alert preference:", error);
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
      console.error("Error updating alert preference:", error);
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
      console.error("Error deleting alert preference:", error);
      res.status(400).json({ message: "Failed to delete alert preference" });
    }
  });

  // Admin routes (protected)
  app.post('/api/admin/teams', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      const validatedData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(validatedData);
      res.json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  app.post('/api/admin/restaurants', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      const validatedData = insertRestaurantSchema.parse(req.body);
      const restaurant = await storage.createRestaurant(validatedData);
      res.json(restaurant);
    } catch (error) {
      console.error("Error creating restaurant:", error);
      res.status(400).json({ message: "Failed to create restaurant" });
    }
  });

  app.post('/api/admin/promotions', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      const validatedData = insertPromotionSchema.parse(req.body);
      const promotion = await storage.createPromotion(validatedData);
      res.json(promotion);
    } catch (error) {
      console.error("Error creating promotion:", error);
      res.status(400).json({ message: "Failed to create promotion" });
    }
  });

  app.post('/api/admin/sync-games/:teamId', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      const teamId = parseInt(req.params.teamId);
      await promotionService.syncRecentGames(teamId);
      res.json({ message: "Games synced successfully" });
    } catch (error) {
      console.error("Error syncing games:", error);
      res.status(500).json({ message: "Failed to sync games" });
    }
  });

  app.get('/api/admin/analytics', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      const activeDeals = await storage.getActiveTriggeredDeals();
      const totalUsers = await storage.getUsersByTeamPreference(1); // Dodgers for now
      
      res.json({
        activeDeals: activeDeals.length,
        totalSubscribers: totalUsers.length,
        // Add more analytics as needed
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
      console.error("Error sending test alert:", error);
      res.status(500).json({ message: "Failed to send test alert" });
    }
  });

  // Sports data routes
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getActiveTeams();
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
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
      console.error('Error fetching teams by sport:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.get('/api/promotions/active', async (req, res) => {
    try {
      const promotions = await storage.getActivePromotions();
      res.json(promotions);
    } catch (error) {
      console.error('Error fetching active promotions:', error);
      res.status(500).json({ message: 'Failed to fetch promotions' });
    }
  });

  app.get('/api/deals/triggered', async (req, res) => {
    try {
      const triggeredDeals = await storage.getActiveTriggeredDeals();
      res.json(triggeredDeals);
    } catch (error) {
      console.error('Error fetching triggered deals:', error);
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
      console.error('Error fetching alert preferences:', error);
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
        emailEnabled: emailEnabled ?? true,
        smsEnabled: smsEnabled ?? false
      });
      
      res.json(preference);
    } catch (error) {
      console.error('Error creating alert preference:', error);
      res.status(500).json({ message: 'Failed to create alert preference' });
    }
  });

  // Admin routes for data management
  app.post('/api/admin/seed-data', async (req, res) => {
    try {
      await seedSportsData();
      res.json({ message: 'Sports data seeded successfully' });
    } catch (error) {
      console.error('Error seeding data:', error);
      res.status(500).json({ message: 'Failed to seed data' });
    }
  });

  app.post('/api/admin/seed-demo-games', isAuthenticated, async (req, res) => {
    try {
      const { seedDemoGameData } = await import('./seedGameData');
      const result = await seedDemoGameData();
      res.json({ message: 'Demo game data seeded successfully', ...result });
    } catch (error) {
      console.error('Error seeding demo game data:', error);
      res.status(500).json({ message: 'Failed to seed demo game data' });
    }
  });

  app.post('/api/admin/sync-games/:teamId', async (req, res) => {
    try {
      const { teamId } = req.params;
      await promotionService.syncRecentGames(parseInt(teamId));
      res.json({ message: 'Games synced successfully' });
    } catch (error) {
      console.error('Error syncing games:', error);
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
      console.error('Error fetching recent games:', error);
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
      console.error('Error during team scraping:', error);
      res.status(500).json({ message: 'Failed to scrape team data', error: error.message });
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
      console.error('Error scraping team:', error);
      res.status(500).json({ message: 'Failed to scrape team data', error: error.message });
    }
  });

  app.get('/api/admin/test-promotions/:teamId', async (req, res) => {
    try {
      const { teamId } = req.params;
      const analysis = await gameScrapingService.testPromotionTriggers(parseInt(teamId));
      res.json(analysis);
    } catch (error) {
      console.error('Error testing promotions:', error);
      res.status(500).json({ message: 'Failed to test promotions', error: error.message });
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
      console.error('Error testing sports API:', error);
      res.status(500).json({ 
        message: 'Sports API test failed', 
        error: error.message,
        apiStatus: 'error'
      });
    }
  });

  // Deal discovery endpoints
  app.get('/api/admin/discover-deals', isAuthenticated, async (req, res) => {
    try {
      console.log('🔍 Starting deal discovery...');
      const discoveredDeals = await dealDiscoveryService.discoverAllDeals();
      await dealDiscoveryService.saveDiscoveredDeals(discoveredDeals);
      
      res.json({ 
        success: true, 
        deals: discoveredDeals,
        count: discoveredDeals.length 
      });
    } catch (error) {
      console.error('Deal discovery failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to discover deals' 
      });
    }
  });

  app.get('/api/admin/deals', isAuthenticated, async (req, res) => {
    try {
      const deals = await dealDiscoveryService.getDiscoveredDeals();
      res.json({ 
        success: true, 
        deals,
        count: deals.length 
      });
    } catch (error) {
      console.error('Failed to load discovered deals:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to load discovered deals' 
      });
    }
  });

  app.post('/api/admin/deals/:dealId/approve', isAuthenticated, async (req, res) => {
    try {
      const { dealId } = req.params;
      const { imageAssetPath } = req.body;
      
      await dealDiscoveryService.approveDeal(dealId, imageAssetPath);
      res.json({ success: true, message: 'Deal approved successfully' });
    } catch (error) {
      console.error('Failed to approve deal:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to approve deal' 
      });
    }
  });

  app.post('/api/admin/deals/:dealId/reject', isAuthenticated, async (req, res) => {
    try {
      const { dealId } = req.params;
      await dealDiscoveryService.rejectDeal(dealId);
      res.json({ success: true, message: 'Deal rejected successfully' });
    } catch (error) {
      console.error('Failed to reject deal:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to reject deal' 
      });
    }
  });

  // MLB API endpoints for real-time game data
  app.get('/api/mlb/games/today', async (req, res) => {
    try {
      const games = await mlbApiService.getTodaysGames();
      res.json(games);
    } catch (error) {
      console.error("Error fetching today's games:", error);
      res.status(500).json({ error: "Failed to fetch today's games" });
    }
  });

  app.post('/api/mlb/games/process', isAuthenticated, async (req, res) => {
    try {
      const result = await gameProcessor.triggerManualProcess();
      res.json(result);
    } catch (error) {
      console.error("Error processing games:", error);
      res.status(500).json({ error: "Failed to process games" });
    }
  });

  app.get('/api/mlb/games/status', isAuthenticated, async (req, res) => {
    try {
      const status = gameProcessor.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting game processor status:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.get('/api/mlb/teams', async (req, res) => {
    try {
      const teams = await mlbApiService.getAllMLBTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching MLB teams:", error);
      res.status(500).json({ error: "Failed to fetch MLB teams" });
    }
  });

  // Admin MLB analytics endpoints
  app.get('/api/admin/mlb/recent-games/:teamId', isAuthenticated, async (req, res) => {
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
      console.error("Error fetching recent games:", error);
      res.status(500).json({ error: "Failed to fetch recent games" });
    }
  });

  app.get('/api/admin/mlb/upcoming-games/:teamId', isAuthenticated, async (req, res) => {
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
      console.error("Error fetching upcoming games:", error);
      res.status(500).json({ error: "Failed to fetch upcoming games" });
    }
  });

  app.get('/api/admin/mlb/triggered-deals', isAuthenticated, async (req, res) => {
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
      console.error("Error fetching triggered deals:", error);
      res.status(500).json({ error: "Failed to fetch triggered deals" });
    }
  });

  app.get('/api/admin/mlb/analytics/:teamId', isAuthenticated, async (req, res) => {
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
      console.error("Error fetching team analytics:", error);
      res.status(500).json({ error: "Failed to fetch team analytics" });
    }
  });

  // Start the game processor on server startup
  gameProcessor.start();

  const httpServer = createServer(app);
  return httpServer;
}
