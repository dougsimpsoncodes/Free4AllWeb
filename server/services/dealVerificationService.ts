import { storage } from '../storage';
import { promotionService } from './promotionService';
import type { Game, DealPage } from '@shared/schema';

/**
 * Deal Verification Service
 * Bridges discovered deals with game result verification
 * Converts deal pages into verifiable promotions and checks game triggers
 */
export class DealVerificationService {
  
  /**
   * Check all active deal pages against a completed game
   * This is called after each game to see if any deals are triggered
   */
  async verifyDealsForGame(gameId: number): Promise<{
    triggeredDeals: any[];
    checkedDeals: number;
    gameDetails: Game | null;
  }> {
    try {
      const game = await storage.getGame(gameId);
      if (!game || !game.isComplete) {
        return {
          triggeredDeals: [],
          checkedDeals: 0,
          gameDetails: null
        };
      }

      console.log(`Verifying deals for game ${gameId}: ${game.opponent} (${game.isHome ? 'Home' : 'Away'}) - Score: ${game.teamScore}-${game.opponentScore}`);

      // Get all active deal pages for this team
      const teamDeals = await this.getActiveDealPagesForTeam(game.teamId);
      console.log(`Found ${teamDeals.length} active deal pages for team ${game.teamId}`);

      const triggeredDeals = [];

      for (const dealPage of teamDeals) {
        const isTriggered = await this.isDealTriggered(dealPage, game);
        
        if (isTriggered) {
          // Create a triggered deal record
          const triggeredDeal = await storage.createTriggeredDeal({
            promotionId: null, // Deal pages don't have promotion IDs
            gameId: game.id,
            dealPageId: dealPage.id,
            expiresAt: this.calculateDealExpiration(dealPage),
          });

          triggeredDeals.push({
            deal: triggeredDeal,
            dealPage: dealPage,
            game: game,
            triggerReason: this.getTriggerReason(dealPage.triggerCondition, game)
          });

          console.log(`✅ Deal triggered: ${dealPage.title} - ${dealPage.triggerCondition}`);
        } else {
          console.log(`❌ Deal not triggered: ${dealPage.title} - ${dealPage.triggerCondition}`);
        }
      }

      return {
        triggeredDeals,
        checkedDeals: teamDeals.length,
        gameDetails: game
      };

    } catch (error) {
      console.error('Error verifying deals for game:', error);
      return {
        triggeredDeals: [],
        checkedDeals: 0,
        gameDetails: null
      };
    }
  }

  /**
   * Check if a specific deal page's conditions are met by a game result
   */
  private async isDealTriggered(dealPage: DealPage, game: Game): Promise<boolean> {
    return await this.evaluateTriggerCondition(dealPage.triggerCondition, game);
  }

  /**
   * Enhanced trigger condition evaluation
   * Handles both simple and complex deal conditions
   */
  private async evaluateTriggerCondition(condition: string, game: Game): Promise<boolean> {
    const lowerCondition = condition.toLowerCase();
    const gameStats = game.gameStats as any || {};
    
    // Basic game result data
    const didWin = game.teamScore !== null && game.opponentScore !== null && game.teamScore > game.opponentScore;
    const didLose = game.teamScore !== null && game.opponentScore !== null && game.teamScore < game.opponentScore;
    const runsScored = game.teamScore || 0;

    console.log(`Evaluating condition: "${condition}" for game with stats:`, {
      isHome: game.isHome,
      didWin,
      runsScored,
      strikeOuts: gameStats.strikeOuts,
      pitchingStrikeOuts: gameStats.pitchingStrikeOuts,
      stolenBases: gameStats.stolenBases
    });

    // Complex conditions (order matters - check most specific first)
    
    // McDonald's style: "Home win + 6 runs"
    if (lowerCondition.includes('home') && lowerCondition.includes('win') && 
        (lowerCondition.includes('6') || lowerCondition.includes('run'))) {
      const runsMatch = condition.match(/(\d+)\s*\+?\s*runs?/i);
      const requiredRuns = runsMatch ? parseInt(runsMatch[1]) : 6;
      return game.isHome && didWin && runsScored >= requiredRuns;
    }

    // Win conditions
    if (lowerCondition.includes('win')) {
      if (lowerCondition.includes('home')) {
        return game.isHome && didWin;
      }
      return didWin; // Any win
    }

    // Loss conditions (for consolation deals)
    if (lowerCondition.includes('loss') || lowerCondition.includes('lose')) {
      if (lowerCondition.includes('home')) {
        return game.isHome && didLose;
      }
      return didLose;
    }

    // Runs/score based
    if (lowerCondition.includes('run') || lowerCondition.includes('score')) {
      const runsMatch = condition.match(/(\d+)\s*\+?\s*runs?/i);
      const requiredRuns = runsMatch ? parseInt(runsMatch[1]) : 6;
      return runsScored >= requiredRuns;
    }

    // Strikeout based
    if (lowerCondition.includes('strikeout') || lowerCondition.includes('strike out')) {
      const strikeoutMatch = condition.match(/(\d+)\s*\+?\s*strikeouts?/i);
      const requiredStrikeouts = strikeoutMatch ? parseInt(strikeoutMatch[1]) : 7;
      
      // Check if this refers to pitching strikeouts
      if (lowerCondition.includes('pitch') || lowerCondition.includes('record')) {
        return (gameStats.pitchingStrikeOuts || 0) >= requiredStrikeouts;
      }
      
      // Default to batting strikeouts
      return (gameStats.strikeOuts || 0) >= requiredStrikeouts;
    }

    // Stolen base conditions
    if (lowerCondition.includes('steal') || lowerCondition.includes('stolen')) {
      const stolenBases = gameStats.stolenBases || 0;
      
      if (lowerCondition.includes('home')) {
        return game.isHome && stolenBases > 0;
      }
      
      return stolenBases > 0;
    }

    // NEW: Margin of victory conditions
    if (lowerCondition.includes('win by') || lowerCondition.includes('blowout')) {
      const marginMatch = condition.match(/win by (\d+)\s*\+?\s*(?:runs?|points?)/i);
      const requiredMargin = marginMatch ? parseInt(marginMatch[1]) : 5;
      
      const winMargin = didWin ? (game.teamScore - game.opponentScore) : 0;
      return didWin && winMargin >= requiredMargin;
    }

    // NEW: Home run conditions  
    if (lowerCondition.includes('home run') || lowerCondition.includes('homer')) {
      const hrMatch = condition.match(/(\d+)\s*\+?\s*home runs?/i);
      const requiredHRs = hrMatch ? parseInt(hrMatch[1]) : 1;
      return (gameStats.homeRuns || 0) >= requiredHRs;
    }

    // NEW: Extra innings conditions
    if (lowerCondition.includes('extra inning')) {
      return (gameStats.innings || 9) > 9;
    }

    // NEW: Walk-off victory conditions
    if (lowerCondition.includes('walk-off') || lowerCondition.includes('walkoff')) {
      return didWin && game.isHome && (gameStats.walkOff === true);
    }

    // Default: treat unknown conditions as "any win"
    console.warn(`Unknown deal condition: "${condition}", defaulting to any win`);
    return didWin;
  }

  /**
   * Get all active deal pages for a specific team
   */
  private async getActiveDealPagesForTeam(teamId: number): Promise<DealPage[]> {
    try {
      // For now, get all active deal pages since we don't have team-specific filtering yet
      // In a real implementation, you'd filter by team or add team associations to deal pages
      return await storage.getActiveDealPages();
    } catch (error) {
      console.error('Error getting active deal pages:', error);
      return [];
    }
  }

  /**
   * Calculate when a triggered deal should expire
   */
  private calculateDealExpiration(dealPage: DealPage): Date {
    if (dealPage.validUntil) {
      return new Date(dealPage.validUntil);
    }

    // Default: expires 24 hours after triggering
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 1);
    return expiration;
  }

  /**
   * Generate human-readable reason why a deal was triggered
   */
  private getTriggerReason(condition: string, game: Game): string {
    const gameStats = game.gameStats as any || {};
    const runsScored = game.teamScore || 0;
    
    if (condition.toLowerCase().includes('home') && condition.toLowerCase().includes('win')) {
      if (condition.toLowerCase().includes('run')) {
        return `Dodgers won at home (${game.teamScore}-${game.opponentScore}) and scored ${runsScored} runs`;
      }
      return `Dodgers won at home (${game.teamScore}-${game.opponentScore})`;
    }
    
    if (condition.toLowerCase().includes('win')) {
      return `Dodgers won (${game.teamScore}-${game.opponentScore})`;
    }
    
    if (condition.toLowerCase().includes('strikeout')) {
      const strikeouts = gameStats.pitchingStrikeOuts || gameStats.strikeOuts || 0;
      return `Game had ${strikeouts} strikeouts`;
    }
    
    return `Game conditions met: ${condition}`;
  }

  /**
   * Get all currently active (non-expired) triggered deals
   */
  async getActiveTriggeredDeals(): Promise<any[]> {
    try {
      const activeDeals = await storage.getActiveTriggeredDeals();
      const enrichedDeals = [];

      for (const deal of activeDeals) {
        let enrichedDeal: any = { deal };

        // Get associated deal page or promotion
        if (deal.dealPageId) {
          enrichedDeal.dealPage = await storage.getDealPageById(deal.dealPageId);
        }
        
        if (deal.promotionId) {
          enrichedDeal.promotion = await storage.getPromotion(deal.promotionId);
        }

        if (deal.gameId) {
          enrichedDeal.game = await storage.getGame(deal.gameId);
        }

        enrichedDeals.push(enrichedDeal);
      }

      return enrichedDeals;
    } catch (error) {
      console.error('Error getting active triggered deals:', error);
      return [];
    }
  }

  /**
   * Test deal verification against a specific game
   * Useful for debugging and manual testing
   */
  async testDealVerification(dealPageId: number, gameId: number): Promise<{
    dealPage: DealPage | null;
    game: Game | null;
    isTriggered: boolean;
    reason: string;
  }> {
    try {
      const dealPage = await storage.getDealPageById(dealPageId);
      const game = await storage.getGame(gameId);

      if (!dealPage || !game) {
        return {
          dealPage,
          game,
          isTriggered: false,
          reason: 'Deal page or game not found'
        };
      }

      const isTriggered = await this.isDealTriggered(dealPage, game);
      const reason = isTriggered ? 
        this.getTriggerReason(dealPage.triggerCondition, game) :
        `Conditions not met for: ${dealPage.triggerCondition}`;

      return {
        dealPage,
        game,
        isTriggered,
        reason
      };
    } catch (error) {
      console.error('Error testing deal verification:', error);
      return {
        dealPage: null,
        game: null,
        isTriggered: false,
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const dealVerificationService = new DealVerificationService();