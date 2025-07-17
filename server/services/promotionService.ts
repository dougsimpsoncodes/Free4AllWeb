import { storage } from '../storage';
import { emailService } from './emailService';
import { sportsApiService } from './sportsApiService';
import type { Game, Promotion } from '@shared/schema';

interface PromotionTrigger {
  type: 'win_home' | 'runs_scored' | 'strikeouts' | 'stolen_base_home' | 'stolen_base_ws';
  threshold?: number;
  seasonal?: boolean;
}

class PromotionService {
  async processGameForPromotions(gameId: number): Promise<void> {
    try {
      const game = await storage.getGame(gameId);
      if (!game || !game.isComplete) {
        console.log(`Game ${gameId} not found or not complete`);
        return;
      }

      const promotions = await storage.getPromotionsByTeam(game.teamId);
      if (promotions.length === 0) {
        console.log(`No promotions found for team ${game.teamId}`);
        return;
      }

      const triggeredDeals = [];

      for (const promotion of promotions) {
        if (await this.isPromotionTriggered(promotion, game)) {
          // Create triggered deal
          const triggeredDeal = await storage.createTriggeredDeal({
            promotionId: promotion.id,
            gameId: game.id,
            expiresAt: this.calculateExpirationDate(promotion),
          });

          triggeredDeals.push(triggeredDeal);
          console.log(`Promotion ${promotion.id} triggered for game ${gameId}`);
        }
      }

      if (triggeredDeals.length > 0) {
        // Send alerts to users who have preferences for this team
        await this.sendAlertsForTriggeredDeals(game.teamId, triggeredDeals);
      }
    } catch (error) {
      console.error('Error processing game for promotions:', error);
    }
  }

  private async isPromotionTriggered(promotion: Promotion, game: Game): Promise<boolean> {
    const trigger = this.parseTriggerCondition(promotion.triggerCondition);
    const gameStats = game.gameStats as any || {};

    switch (trigger.type) {
      case 'win_home':
        return game.isHome && 
               game.teamScore !== null && 
               game.opponentScore !== null && 
               game.teamScore > game.opponentScore;

      case 'runs_scored':
        return game.teamScore !== null && 
               game.teamScore >= (trigger.threshold || 6);

      case 'strikeouts':
        return gameStats.strikeOuts >= (trigger.threshold || 7);

      case 'stolen_base_home':
        return game.isHome && gameStats.stolenBases > 0;

      case 'stolen_base_ws':
        // Only during World Series (seasonal promotion)
        return trigger.seasonal && gameStats.stolenBases > 0;

      default:
        return false;
    }
  }

  private parseTriggerCondition(condition: string): PromotionTrigger {
    const lowerCondition = condition.toLowerCase();

    if (lowerCondition.includes('win') && lowerCondition.includes('home')) {
      return { type: 'win_home' };
    }

    if (lowerCondition.includes('score') && lowerCondition.includes('6')) {
      return { type: 'runs_scored', threshold: 6 };
    }

    if (lowerCondition.includes('strikeout') && lowerCondition.includes('7')) {
      return { type: 'strikeouts', threshold: 7 };
    }

    if (lowerCondition.includes('steal') && lowerCondition.includes('home')) {
      return { type: 'stolen_base_home' };
    }

    if (lowerCondition.includes('steal') && lowerCondition.includes('world series')) {
      return { type: 'stolen_base_ws', seasonal: true };
    }

    // Default fallback
    return { type: 'win_home' };
  }

  private calculateExpirationDate(promotion: Promotion): Date | null {
    if (promotion.validUntil) {
      return new Date(promotion.validUntil);
    }

    // Default: expires 24 hours after triggering
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 1);
    return expiration;
  }

  private async sendAlertsForTriggeredDeals(teamId: number, triggeredDeals: any[]): Promise<void> {
    try {
      // Get all users who have alert preferences for this team
      const userIds = await storage.getUsersByTeamPreference(teamId);
      
      console.log(`Sending alerts to ${userIds.length} users for team ${teamId}`);

      // Send emails to each user
      const emailPromises = userIds.map(async (userId) => {
        try {
          await emailService.sendDealAlert(userId, triggeredDeals);
        } catch (error) {
          console.error(`Failed to send alert to user ${userId}:`, error);
        }
      });

      await Promise.allSettled(emailPromises);
    } catch (error) {
      console.error('Error sending alerts for triggered deals:', error);
    }
  }

  async syncRecentGames(teamId: number): Promise<void> {
    try {
      // Get team details to find external ID
      const team = await storage.getTeam(teamId);
      if (!team || !team.externalId) {
        console.log(`Team ${teamId} not found or no external ID`);
        return;
      }

      // Fetch recent games from MLB API
      const recentGames = await sportsApiService.getRecentGames(parseInt(team.externalId));

      for (const gameData of recentGames) {
        // Check if game is already in our database
        const existingGames = await storage.getRecentGames(teamId, 1);
        const gameExists = existingGames.some(g => g.externalId === gameData.gamePk.toString());

        if (!gameExists && gameData.status.statusCode === 'F') {
          // Game is final and not in our database
          const isHome = sportsApiService.isHomeGame(gameData, parseInt(team.externalId));
          const teamScore = isHome ? gameData.teams.home.score : gameData.teams.away.score;
          const opponentScore = isHome ? gameData.teams.away.score : gameData.teams.home.score;
          const opponent = isHome ? gameData.teams.away.team.name : gameData.teams.home.team.name;

          // Get detailed game stats
          const boxScore = await sportsApiService.getGameBoxScore(gameData.gamePk);
          const gameStats = sportsApiService.parseGameStats(boxScore, isHome);

          // Create game record
          const newGame = await storage.createGame({
            teamId,
            opponent,
            gameDate: new Date(gameData.gameDate),
            isHome,
            teamScore,
            opponentScore,
            isComplete: true,
            gameStats,
            externalId: gameData.gamePk.toString(),
          });

          // Process promotions for this game
          await this.processGameForPromotions(newGame.id);
        }
      }
    } catch (error) {
      console.error('Error syncing recent games:', error);
    }
  }

  async getActiveDealsForTeam(teamId: number): Promise<any[]> {
    try {
      const activeDeals = await storage.getActiveTriggeredDeals();
      const teamDeals = [];

      for (const deal of activeDeals) {
        const promotion = await storage.getPromotion(deal.promotionId!);
        if (promotion && promotion.teamId === teamId) {
          const restaurant = await storage.getRestaurant(promotion.restaurantId!);
          const game = await storage.getGame(deal.gameId!);
          
          teamDeals.push({
            deal,
            promotion,
            restaurant,
            game,
          });
        }
      }

      return teamDeals;
    } catch (error) {
      console.error('Error getting active deals for team:', error);
      return [];
    }
  }
}

export const promotionService = new PromotionService();
