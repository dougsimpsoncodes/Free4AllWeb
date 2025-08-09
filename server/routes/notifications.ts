import type { Express } from "express";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { isAuthenticated } from "../googleAuth";

export function registerNotificationRoutes(app: Express) {
  // Use standard authentication middleware
  const authMiddleware = isAuthenticated;

  // Get user's alert history
  app.get('/api/alert-history', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const history = await storage.getAlertHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching alert history:", error);
      res.status(500).json({ message: "Failed to fetch alert history" });
    }
  });

  // Get notification statistics
  app.get('/api/notifications/stats', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const history = await storage.getAlertHistory(userId);
      
      const stats = {
        total: history.length,
        sent: history.filter(h => h.status === 'sent').length,
        failed: history.filter(h => h.status === 'failed').length,
        thisWeek: history.filter(h => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(h.sentAt) > weekAgo;
        }).length,
        lastAlert: history.length > 0 ? history[0].sentAt : null
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      res.status(500).json({ message: "Failed to fetch notification stats" });
    }
  });

  // Send test notification
  app.post('/api/notifications/test', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type } = req.body;
      
      // Get or create a mock user for development
      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.upsertUser({
          id: userId,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          profileImageUrl: null,
        });
      }

      switch (type) {
        case 'deal_alert':
          // Create a mock triggered deal for testing
          await emailService.sendTestDealAlert(user);
          break;
        case 'welcome':
          await emailService.sendWelcomeEmail(user);
          break;
        default:
          return res.status(400).json({ message: "Invalid test type" });
      }

      res.json({ 
        success: true, 
        message: `Test ${type} notification sent successfully` 
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send test notification",
        error: error.message 
      });
    }
  });

  // Update notification preferences
  app.put('/api/notifications/preferences', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { emailEnabled, smsEnabled, alertTiming } = req.body;
      
      // Update all user's alert preferences
      const preferences = await storage.getUserAlertPreferences(userId);
      
      const updatePromises = preferences.map(pref => 
        storage.updateAlertPreference(pref.id, {
          emailAlerts: emailEnabled,
          smsAlerts: smsEnabled,
          alertTiming: alertTiming
        })
      );
      
      await Promise.all(updatePromises);
      
      res.json({ 
        success: true, 
        message: "Notification preferences updated successfully" 
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update notification preferences" 
      });
    }
  });

  // Get unread notifications count
  app.get('/api/notifications/unread', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const unreadCount = await storage.getUnreadNotificationsCount(userId);
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ message: "Failed to fetch unread notifications" });
    }
  });
}