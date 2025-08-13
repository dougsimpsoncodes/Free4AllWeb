import { multiSportsApiService } from './multiSportsApiService';
import { storage } from '../storage';

interface ScrapingResult {
  teamId: number;
  teamName: string;
  sport: string;
  gamesFound: number;
  dealsTriggered: number;
  errors: string[];
  lastGameDate?: string;
  gameResults: any[];
}

class GameScrapingService {
  async scrapeAllTeams(): Promise<ScrapingResult[]> {
    console.log('🔍 Starting comprehensive game scraping for all teams...');
    
    const teams = await storage.getActiveTeams();
    const results: ScrapingResult[] = [];

    for (const team of teams) {
      const result = await this.scrapeTeamGames(team);
      results.push(result);
    }

    return results;
  }

  async scrapeTeamGames(team: any): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      teamId: team.id,
      teamName: `${team.city} ${team.name}`,
      sport: team.sport,
      gamesFound: 0,
      dealsTriggered: 0,
      errors: [],
      gameResults: []
    };

    try {
      console.log(`📊 Scraping ${team.sport} games for ${team.city} ${team.name}...`);

      // Get recent games from external API
      const externalGames = await multiSportsApiService.getGamesForTeam(
        team.sport,
        team.externalId,
        14 // Last 14 days
      );

      result.gamesFound = externalGames.length;
      result.gameResults = externalGames;

      if (externalGames.length > 0) {
        result.lastGameDate = externalGames[0]?.date;
      }

      // Process each game and check for triggered deals
      for (const gameData of externalGames) {
        try {
          // Convert external game data to our internal format
          const internalGame = await this.convertToInternalGame(team, gameData);
          
          // Save game to database
          const savedGame = await storage.createGame(internalGame);
          
          // Promotion triggers handled by game processor - not simulated
          // Real promotion triggers are processed by the game processor service
          result.dealsTriggered += 0; // Actual count tracked by promotionService

        } catch (gameError) {
          result.errors.push(`Game processing error: ${(gameError as Error).message}`);
        }
      }

    } catch (error) {
      result.errors.push(`Team scraping error: ${(error as Error).message}`);
      console.error(`Error scraping ${team.sport} data for ${team.name}:`, error);
    }

    return result;
  }

  private async convertToInternalGame(team: any, gameData: any): Promise<any> {
    const isHome = gameData.homeTeam.id === team.externalId;
    const opponent = isHome ? gameData.awayTeam.name : gameData.homeTeam.name;
    const teamScore = isHome ? gameData.homeTeam.score : gameData.awayTeam.score;
    const opponentScore = isHome ? gameData.awayTeam.score : gameData.homeTeam.score;

    return {
      teamId: team.id,
      opponent,
      gameDate: new Date(gameData.date),
      isHome,
      teamScore: teamScore || 0,
      opponentScore: opponentScore || 0,
      isComplete: gameData.isComplete,
      gameStats: gameData.stats || {},
      externalId: gameData.id
    };
  }

  async testPromotionTriggers(teamId: number): Promise<any> {
    console.log(`🎯 Testing promotion triggers for team ${teamId}...`);
    
    const team = await storage.getTeam(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const promotions = await storage.getPromotionsByTeam(teamId);
    const recentGames = await storage.getRecentGames(teamId, 5);
    
    const results: {
      team: string;
      sport: string;
      promotions: number;
      recentGames: number;
      potentialTriggers: any[];
      actualTriggers: any[];
    } = {
      team: `${team.city} ${team.name}`,
      sport: team.sport,
      promotions: promotions.length,
      recentGames: recentGames.length,
      potentialTriggers: [],
      actualTriggers: []
    };

    // Analyze each promotion against recent games
    for (const promotion of promotions) {
      for (const game of recentGames) {
        const couldTrigger = await this.analyzePromotionTrigger(promotion, game, team);
        if (couldTrigger.triggered) {
          results.potentialTriggers.push({
            promotion: promotion.title,
            game: `vs ${game.opponent} (${game.teamScore}-${game.opponentScore})`,
            condition: promotion.triggerCondition,
            reason: couldTrigger.reason
          });
        }
      }
    }

    // Check for actual triggered deals
    const triggeredDeals = await storage.getTriggeredDealsByGame(recentGames[0]?.id || 0);
    results.actualTriggers = triggeredDeals.map(deal => ({
      dealId: deal.id,
      triggeredAt: deal.triggeredAt
    }));

    return results;
  }

  private async analyzePromotionTrigger(promotion: any, game: any, team: any): Promise<{triggered: boolean, reason: string}> {
    const condition = promotion.triggerCondition.toLowerCase();
    
    // Win conditions
    if (condition.includes('win_home') && game.isHome && game.teamScore > game.opponentScore) {
      return { triggered: true, reason: 'Home win' };
    }
    
    if (condition.includes('win_any') && game.teamScore > game.opponentScore) {
      return { triggered: true, reason: 'Any win' };
    }

    // Score-based conditions
    if (condition.includes('runs_scored:')) {
      const threshold = parseInt(condition.split(':')[1]);
      if (game.teamScore >= threshold) {
        return { triggered: true, reason: `Scored ${game.teamScore} (needed ${threshold})` };
      }
    }

    if (condition.includes('points_scored:')) {
      const threshold = parseInt(condition.split(':')[1]);
      if (game.teamScore >= threshold) {
        return { triggered: true, reason: `Scored ${game.teamScore} points (needed ${threshold})` };
      }
    }

    // Win margin conditions
    if (condition.includes('win_margin:')) {
      const threshold = parseInt(condition.split(':')[1]);
      const margin = game.teamScore - game.opponentScore;
      if (margin >= threshold) {
        return { triggered: true, reason: `Won by ${margin} (needed ${threshold})` };
      }
    }

    return { triggered: false, reason: 'Condition not met' };
  }

  async generateScrapingReport(): Promise<any> {
    const results = await this.scrapeAllTeams();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        teamsScraped: results.length,
        totalGamesFound: results.reduce((sum, r) => sum + r.gamesFound, 0),
        totalDealsTriggered: results.reduce((sum, r) => sum + r.dealsTriggered, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0)
      },
      sportBreakdown: this.groupBySport(results),
      detailedResults: results,
      recommendations: this.generateRecommendations(results)
    };

    console.log('📈 Scraping Report Generated:', report.summary);
    return report;
  }

  private groupBySport(results: ScrapingResult[]) {
    return results.reduce((acc, result) => {
      if (!acc[result.sport]) {
        acc[result.sport] = {
          teams: 0,
          games: 0,
          deals: 0,
          errors: 0
        };
      }
      acc[result.sport].teams++;
      acc[result.sport].games += result.gamesFound;
      acc[result.sport].deals += result.dealsTriggered;
      acc[result.sport].errors += result.errors.length;
      return acc;
    }, {} as any);
  }

  // simulatePromotionTriggers removed - was fake simulation
  // Real promotion triggers are handled by promotionService and gameProcessor

  private generateRecommendations(results: ScrapingResult[]): string[] {
    const recommendations = [];
    
    const sportsWithNoGames = results.filter(r => r.gamesFound === 0).map(r => r.sport);
    const uniqueSportsWithNoGames = Array.from(new Set(sportsWithNoGames));
    
    if (uniqueSportsWithNoGames.length > 0) {
      recommendations.push(`Consider updating API endpoints for: ${uniqueSportsWithNoGames.join(', ')}`);
    }

    const teamsWithErrors = results.filter(r => r.errors.length > 0);
    if (teamsWithErrors.length > 0) {
      recommendations.push(`${teamsWithErrors.length} teams had scraping errors - review API keys and endpoints`);
    }

    const totalDeals = results.reduce((sum, r) => sum + r.dealsTriggered, 0);
    if (totalDeals === 0) {
      recommendations.push('No deals triggered - consider adjusting promotion trigger conditions');
    }

    return recommendations;
  }
}

export const gameScrapingService = new GameScrapingService();