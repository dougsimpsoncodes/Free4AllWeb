import { storage } from '../storage';
import { emailService } from './emailService';
import { sportsApiService } from './sportsApiService';
// Import moved to avoid circular dependency
import type { Game, Promotion } from '@shared/schema';

interface PromotionTrigger {
  type: 'win_home' | 'runs_scored' | 'strikeouts' | 'pitching_strikeouts' | 'stolen_base_home' | 'stolen_base_ws' | 'any_win' | 'home_win_and_runs' | 'loss' | 'home_loss';
  threshold?: number;
  runsThreshold?: number;
  seasonal?: boolean;
  requiredLocation?: 'home' | 'away' | 'any';
}

class PromotionService {
  async processGameForPromotions(gameId: number): Promise<void> {
    try {
      const game = await storage.getGame(gameId);
      if (!game || !game.isComplete) {
        console.log(`Game ${gameId} not found or not complete`);
        return;
      }

      const promotions = await storage.getPromotionsByTeam(game.teamId || 0);
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

      // Also check discovered deal pages for this game (import here to avoid circular dependency)
      const { dealVerificationService } = await import('./dealVerificationService');
      const discoveredDealResults = await dealVerificationService.verifyDealsForGame(gameId);
      
      const allTriggeredDeals = [...triggeredDeals, ...discoveredDealResults.triggeredDeals];

      if (allTriggeredDeals.length > 0) {
        console.log(`Total triggered deals: ${allTriggeredDeals.length} (${triggeredDeals.length} promotions + ${discoveredDealResults.triggeredDeals.length} discovered deals)`);
        
        // Send alerts to users who have preferences for this team
        await this.sendAlertsForTriggeredDeals(game.teamId || 0, allTriggeredDeals);
      }
    } catch (error) {
      console.error('Error processing game for promotions:', error);
    }
  }

  private async isPromotionTriggered(promotion: Promotion, game: Game): Promise<boolean> {
    const trigger = this.parseTriggerCondition(promotion.triggerCondition);
    const gameStats = game.gameStats as any || {};
    
    // Basic game result checks
    const didWin = game.teamScore !== null && game.opponentScore !== null && game.teamScore > game.opponentScore;
    const didLose = game.teamScore !== null && game.opponentScore !== null && game.teamScore < game.opponentScore;
    const runsScored = game.teamScore || 0;

    switch (trigger.type) {
      case 'win_home':
        return Boolean(game.isHome) && didWin;

      case 'any_win':
        return didWin;

      case 'loss':
        return didLose;

      case 'home_loss':
        return Boolean(game.isHome) && didLose;

      case 'runs_scored':
        return runsScored >= (trigger.threshold || 6);

      case 'home_win_and_runs':
        return Boolean(game.isHome) && didWin && runsScored >= (trigger.runsThreshold || 6);

      case 'strikeouts':
        // Batting strikeouts (team got struck out)
        return gameStats.strikeOuts >= (trigger.threshold || 7);

      case 'pitching_strikeouts':
        // Pitching strikeouts (team's pitchers struck out opponents)
        return gameStats.pitchingStrikeOuts >= (trigger.threshold || 7);

      case 'stolen_base_home':
        return Boolean(game.isHome) && (gameStats.stolenBases || 0) > 0;

      case 'stolen_base_ws':
        // Only during World Series (seasonal promotion)
        return (trigger.seasonal ?? false) && (gameStats.stolenBases || 0) > 0;

      default:
        console.warn(`Unknown trigger type: ${trigger.type}`);
        return false;
    }
  }

  private parseTriggerCondition(condition: string): PromotionTrigger {
    const lowerCondition = condition.toLowerCase();
    console.log(`Parsing trigger condition: "${condition}"`);

    // Complex conditions first (order matters)
    if (lowerCondition.includes('home') && lowerCondition.includes('win') && 
        (lowerCondition.includes('6') || lowerCondition.includes('run'))) {
      const runsMatch = condition.match(/(\d+)\s*\+?\s*runs?/i);
      const runsThreshold = runsMatch ? parseInt(runsMatch[1]) : 6;
      return { type: 'home_win_and_runs', runsThreshold };
    }

    // Win conditions
    if (lowerCondition.includes('win') && lowerCondition.includes('home')) {
      return { type: 'win_home' };
    }

    if (lowerCondition.includes('win') && !lowerCondition.includes('home')) {
      return { type: 'any_win' };
    }

    // Loss conditions  
    if (lowerCondition.includes('loss') || lowerCondition.includes('lose')) {
      if (lowerCondition.includes('home')) {
        return { type: 'home_loss' };
      }
      return { type: 'loss' };
    }

    // Runs scored
    if (lowerCondition.includes('run') || lowerCondition.includes('score')) {
      const runsMatch = condition.match(/(\d+)\s*\+?\s*runs?/i);
      const threshold = runsMatch ? parseInt(runsMatch[1]) : 6;
      return { type: 'runs_scored', threshold };
    }

    // Strikeout conditions
    if (lowerCondition.includes('strikeout') || lowerCondition.includes('strike out')) {
      const strikeoutMatch = condition.match(/(\d+)\s*\+?\s*strikeouts?/i);
      const threshold = strikeoutMatch ? parseInt(strikeoutMatch[1]) : 7;
      
      // Determine if this is pitching or batting strikeouts based on context
      if (lowerCondition.includes('pitch') || lowerCondition.includes('record')) {
        return { type: 'pitching_strikeouts', threshold };
      }
      return { type: 'strikeouts', threshold };
    }

    // Stolen base conditions
    if (lowerCondition.includes('steal') || lowerCondition.includes('stolen')) {
      if (lowerCondition.includes('world series')) {
        return { type: 'stolen_base_ws', seasonal: true };
      }
      if (lowerCondition.includes('home')) {
        return { type: 'stolen_base_home' };
      }
    }

    console.warn(`Could not parse trigger condition: "${condition}", using default home win`);
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
    console.error(`DEBUG: syncRecentGames called for team ${teamId}`);
    try {
      // Get team details to find external ID
      const team = await storage.getTeam(teamId);
      if (!team || !team.externalId) {
        console.log(`Team ${teamId} not found or no external ID`);
        return;
      }
      console.log(`Team found: ${team.name} (ID: ${team.id}, External ID: ${team.externalId})`);

      // Fetch recent games from MLB API
      console.log(`Syncing games for team ${teamId} (${team.name}) with external ID ${team.externalId}`);
      const recentGames = await sportsApiService.getRecentGames(teamId);

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
