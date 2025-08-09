import type { Express } from "express";
import { gameSchedulingService } from "../services/gameSchedulingService";
import { emailService } from "../services/emailService";
import { storage } from "../storage";
import { isAdmin } from "../googleAuth";

export function registerGameSchedulingRoutes(app: Express) {
  // Test pre-game alert
  app.post("/api/admin/game-scheduling/test-pregame", isAdmin, async (req, res) => {
    try {
      const testGameData = {
        gameId: "test-game-001",
        teamName: "LA Dodgers",
        opponent: "San Francisco Giants",
        gameTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        venue: "Dodger Stadium",
        isHome: true,
        potentialDeals: [
          {
            restaurant: "Panda Express",
            offer: "$6 Panda Plate Deal",
            triggerCondition: "Dodgers win any game",
            value: "$6"
          },
          {
            restaurant: "McDonald's",
            offer: "Free Big Mac",
            triggerCondition: "Dodgers win home game with 6+ runs",
            value: "Free"
          }
        ]
      };

      // Send test pre-game alert to your email
      await emailService.sendPreGameAlert("dougiefreshcodes@gmail.com", testGameData);

      res.json({ 
        success: true, 
        message: "Test pre-game alert sent successfully",
        gameData: testGameData
      });
    } catch (error) {
      console.error("Error sending test pre-game alert:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Test post-game alert
  app.post("/api/admin/game-scheduling/test-postgame", isAdmin, async (req, res) => {
    try {
      const testGameData = {
        gameId: "test-game-002",
        teamName: "LA Dodgers",
        finalScore: { home: 8, away: 3 },
        isWin: true,
        triggeredDeals: [
          {
            restaurant: "Panda Express",
            offer: "$6 Panda Plate Deal",
            value: "$6",
            promoCode: "DODGERSWIN",
            instructions: "Show this email at any participating Panda Express location",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          {
            restaurant: "McDonald's",
            offer: "Free Big Mac",
            value: "Free",
            promoCode: "DODGERSBIGMAC",
            instructions: "Valid at participating McDonald's locations only",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        ]
      };

      // Send test post-game alert to your email
      await emailService.sendPostGameAlert("dougiefreshcodes@gmail.com", testGameData);

      res.json({ 
        success: true, 
        message: "Test post-game alert sent successfully",
        gameData: testGameData
      });
    } catch (error) {
      console.error("Error sending test post-game alert:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get upcoming scheduled games
  app.get("/api/admin/game-scheduling/upcoming", isAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const upcomingGames = await storage.getUpcomingGames(days);
      
      res.json({
        success: true,
        games: upcomingGames,
        count: upcomingGames.length
      });
    } catch (error) {
      console.error("Error fetching upcoming games:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Manually schedule alerts for a specific game
  app.post("/api/admin/game-scheduling/schedule/:gameId", isAdmin, async (req, res) => {
    try {
      const { gameId } = req.params;
      const gameData = req.body;

      await gameSchedulingService.scheduleGameAlerts({
        gameId,
        teamId: gameData.teamId,
        gameDate: new Date(gameData.gameDate),
        startTime: new Date(gameData.startTime),
        opponent: gameData.opponent,
        isHome: gameData.isHome,
        venue: gameData.venue,
        status: 'scheduled'
      });

      res.json({ 
        success: true, 
        message: `Alerts scheduled for game ${gameId}`,
        gameId 
      });
    } catch (error) {
      console.error("Error scheduling game alerts:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get game scheduling statistics
  app.get("/api/admin/game-scheduling/stats", isAdmin, async (req, res) => {
    try {
      // Get alert history for scheduling statistics
      const alertHistory = await storage.getAlertHistory();
      
      const preGameAlerts = alertHistory.filter(alert => alert.alertType === 'pre_game');
      const postGameAlerts = alertHistory.filter(alert => alert.alertType === 'post_game');
      
      const stats = {
        totalAlerts: alertHistory.length,
        preGameAlerts: preGameAlerts.length,
        postGameAlerts: postGameAlerts.length,
        successRate: alertHistory.length > 0 
          ? ((alertHistory.filter(a => a.status === 'sent').length / alertHistory.length) * 100).toFixed(1)
          : '0'
      };

      res.json({ success: true, stats });
    } catch (error) {
      console.error("Error fetching scheduling stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Initialize/reinitialize scheduled games
  app.post("/api/admin/game-scheduling/initialize", isAdmin, async (req, res) => {
    try {
      await gameSchedulingService.initializeScheduledGames();
      
      res.json({ 
        success: true, 
        message: "Game scheduling service reinitialized successfully" 
      });
    } catch (error) {
      console.error("Error reinitializing game scheduling:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}