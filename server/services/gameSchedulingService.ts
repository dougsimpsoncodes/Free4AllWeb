import { storage } from "../storage";
import { emailService } from "./emailService";

interface GameSchedule {
  gameId: string;
  teamId: number;
  gameDate: Date;
  startTime: Date;
  opponent: string;
  isHome: boolean;
  venue: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed';
}

interface GameOutcome {
  gameId: string;
  teamId: number;
  finalScore: {
    home: number;
    away: number;
  };
  isWin: boolean;
  runs: number;
  hits: number;
  strikeouts: number;
  gameDate: Date;
  endTime: Date;
}

class GameSchedulingService {
  private preGameAlerts = new Map<string, NodeJS.Timeout>();
  private postGameChecks = new Map<string, NodeJS.Timeout>();
  
  async scheduleGameAlerts(gameSchedule: GameSchedule) {
    const now = new Date();
    const preGameTime = new Date(gameSchedule.startTime.getTime() - 60 * 60 * 1000); // 1 hour before
    
    // Schedule pre-game alert
    if (preGameTime > now) {
      const timeout = setTimeout(() => {
        this.sendPreGameAlert(gameSchedule);
      }, preGameTime.getTime() - now.getTime());
      
      this.preGameAlerts.set(gameSchedule.gameId, timeout);
    }
    
    // Schedule post-game outcome checking (start checking 2 hours after game start)
    const postGameCheckTime = new Date(gameSchedule.startTime.getTime() + 2 * 60 * 60 * 1000);
    if (postGameCheckTime > now) {
      const timeout = setTimeout(() => {
        this.startPostGameMonitoring(gameSchedule);
      }, postGameCheckTime.getTime() - now.getTime());
      
      this.postGameChecks.set(gameSchedule.gameId, timeout);
    }
  }
  
  private async sendPreGameAlert(gameSchedule: GameSchedule) {
    try {
      // Get all users subscribed to this team
      const users = await storage.getUsersByTeamSubscription(gameSchedule.teamId);
      
      // Get active promotions for this team
      const promotions = await storage.getPromotionsByTeam(gameSchedule.teamId);
      
      if (promotions.length === 0) return;
      
      const preGameData = {
        gameId: gameSchedule.gameId,
        teamName: await this.getTeamName(gameSchedule.teamId),
        opponent: gameSchedule.opponent,
        gameTime: gameSchedule.startTime,
        venue: gameSchedule.venue,
        isHome: gameSchedule.isHome,
        potentialDeals: promotions.map(p => ({
          restaurant: (p as any).restaurant,
          offer: p.description,
          triggerCondition: p.triggerCondition,
          value: p.offerValue
        }))
      };
      
      // Send pre-game alerts to subscribed users
      for (const user of users) {
        await emailService.sendPreGameAlert(user.email || '', preGameData);
        
        // Store alert history
        await storage.storeAlertHistory({
          userId: user.id,
          gameId: gameSchedule.gameId,
          alertType: 'pre_game',
          status: 'sent',
          sentAt: new Date()
        });
      }
      
      console.log(`Pre-game alerts sent for game ${gameSchedule.gameId}`);
    } catch (error) {
      console.error('Error sending pre-game alert:', error);
    }
  }
  
  private async startPostGameMonitoring(gameSchedule: GameSchedule) {
    // Check game status every 10 minutes until completed
    const checkInterval = setInterval(async () => {
      try {
        const gameOutcome = await this.checkGameOutcome(gameSchedule.gameId);
        
        if (gameOutcome) {
          clearInterval(checkInterval);
          await this.processGameOutcome(gameOutcome);
        }
      } catch (error) {
        console.error('Error checking game outcome:', error);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes
    
    // Stop checking after 6 hours
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 6 * 60 * 60 * 1000);
  }
  
  private async checkGameOutcome(gameId: string): Promise<GameOutcome | null> {
    try {
      // Use existing MLB API service to get game result
      const response = await fetch(`https://statsapi.mlb.com/api/v1/game/${gameId}/linescore`);
      
      if (!response.ok) return null;
      
      const gameData = await response.json();
      
      // Check if game is completed
      if (gameData.game?.status?.statusCode !== 'F') {
        return null; // Game not finished yet
      }
      
      const homeScore = gameData.linescore?.teams?.home?.runs || 0;
      const awayScore = gameData.linescore?.teams?.away?.runs || 0;
      const teamId = this.extractTeamIdFromGame(gameData);
      
      return {
        gameId,
        teamId,
        finalScore: {
          home: homeScore,
          away: awayScore
        },
        isWin: this.determineWin(gameData, teamId),
        runs: this.getTeamRuns(gameData, teamId),
        hits: this.getTeamHits(gameData, teamId),
        strikeouts: this.getTeamStrikeouts(gameData, teamId),
        gameDate: new Date(gameData.game?.gameDate),
        endTime: new Date()
      };
    } catch (error) {
      console.error('Error fetching game outcome:', error);
      return null;
    }
  }
  
  private async processGameOutcome(outcome: GameOutcome) {
    try {
      // Get promotions for this team
      const promotions = await storage.getPromotionsByTeam(outcome.teamId);
      
      // Check which promotions are triggered
      const triggeredPromotions = [];
      
      for (const promotion of promotions) {
        if (this.isPromotionTriggered(promotion, outcome)) {
          triggeredPromotions.push(promotion);
          
          // Store triggered deal
          await storage.storeTriggeredDeal({
            promotionId: promotion.id,
            gameId: outcome.gameId,
            teamId: outcome.teamId,
            triggerCondition: promotion.triggerCondition,
            actualResult: this.getActualResult(outcome),
            isActive: true,
            triggeredAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          });
        }
      }
      
      if (triggeredPromotions.length > 0) {
        await this.sendPostGameAlerts(outcome, triggeredPromotions);
      }
      
      console.log(`Processed game outcome for ${outcome.gameId}: ${triggeredPromotions.length} deals triggered`);
    } catch (error) {
      console.error('Error processing game outcome:', error);
    }
  }
  
  private async sendPostGameAlerts(outcome: GameOutcome, triggeredPromotions: any[]) {
    try {
      // Get all users subscribed to this team
      const users = await storage.getUsersByTeamSubscription(outcome.teamId);
      
      const postGameData = {
        gameId: outcome.gameId,
        teamName: await this.getTeamName(outcome.teamId),
        finalScore: outcome.finalScore,
        isWin: outcome.isWin,
        triggeredDeals: triggeredPromotions.map(p => ({
          restaurant: p.restaurant,
          offer: p.offer,
          value: p.value,
          promoCode: p.promoCode,
          instructions: p.instructions,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }))
      };
      
      // Send post-game victory alerts
      for (const user of users) {
        await emailService.sendPostGameAlert(user.email || '', postGameData);
        
        // Store alert history
        await storage.storeAlertHistory({
          userId: user.id,
          gameId: outcome.gameId,
          alertType: 'post_game',
          status: 'sent',
          sentAt: new Date()
        });
      }
      
      console.log(`Post-game alerts sent for game ${outcome.gameId}`);
    } catch (error) {
      console.error('Error sending post-game alert:', error);
    }
  }
  
  private isPromotionTriggered(promotion: any, outcome: GameOutcome): boolean {
    const condition = promotion.triggerCondition.toLowerCase();
    
    // Parse trigger conditions
    if (condition.includes('win') && outcome.isWin) return true;
    if (condition.includes('home win') && outcome.isWin) return true;
    if (condition.includes('runs') && outcome.runs >= this.extractNumber(condition)) return true;
    if (condition.includes('strikeouts') && outcome.strikeouts >= this.extractNumber(condition)) return true;
    
    return false;
  }
  
  private extractNumber(condition: string): number {
    const match = condition.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  private extractTeamIdFromGame(gameData: any): number {
    // Extract team ID from game data - implement based on your team mapping
    return 119; // Dodgers ID for now
  }
  
  private determineWin(gameData: any, teamId: number): boolean {
    const homeScore = gameData.linescore?.teams?.home?.runs || 0;
    const awayScore = gameData.linescore?.teams?.away?.runs || 0;
    
    // Determine if this team won based on home/away status
    return homeScore > awayScore; // Simplified for now
  }
  
  private getTeamRuns(gameData: any, teamId: number): number {
    return gameData.linescore?.teams?.home?.runs || 0;
  }
  
  private getTeamHits(gameData: any, teamId: number): number {
    return gameData.linescore?.teams?.home?.hits || 0;
  }
  
  private getTeamStrikeouts(gameData: any, teamId: number): number {
    return gameData.boxscore?.teams?.home?.pitching?.strikeOuts || 0;
  }
  
  private getActualResult(outcome: GameOutcome): string {
    return `${outcome.isWin ? 'Win' : 'Loss'} ${outcome.finalScore.home}-${outcome.finalScore.away}`;
  }
  
  private async getTeamName(teamId: number): Promise<string> {
    const team = await storage.getTeam(teamId);
    return team?.name || 'Team';
  }
  
  // Initialize scheduled games from database
  async initializeScheduledGames() {
    try {
      // Get upcoming games for the next 7 days
      const upcomingGames = await storage.getUpcomingGames(7);
      
      for (const game of upcomingGames) {
        await this.scheduleGameAlerts({
          gameId: game.gameId,
          teamId: game.teamId,
          gameDate: new Date(game.gameDate),
          startTime: new Date(game.startTime),
          opponent: game.opponent,
          isHome: game.isHome,
          venue: game.venue || 'TBD',
          status: 'scheduled'
        });
      }
      
      console.log(`Initialized ${upcomingGames.length} scheduled game alerts`);
    } catch (error) {
      console.error('Error initializing scheduled games:', error);
    }
  }
  
  // Clean up expired timeouts
  cleanup() {
    this.preGameAlerts.forEach(timeout => clearTimeout(timeout));
    this.postGameChecks.forEach(timeout => clearTimeout(timeout));
    this.preGameAlerts.clear();
    this.postGameChecks.clear();
  }
}

export const gameSchedulingService = new GameSchedulingService();