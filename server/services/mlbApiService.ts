import { db } from "../db";
import { games, teams, triggeredDeals, promotions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface MLBGameData {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    codedGameState: string;
    detailedState: string;
  };
  teams: {
    away: {
      team: {
        id: number;
        name: string;
      };
      score: number;
    };
    home: {
      team: {
        id: number;
        name: string;
      };
      score: number;
    };
  };
  venue: {
    id: number;
    name: string;
  };
}

interface MLBLiveGameData {
  gameData: {
    game: {
      pk: number;
    };
    status: {
      abstractGameState: string;
    };
    teams: {
      away: { id: number; name: string };
      home: { id: number; name: string };
    };
  };
  liveData: {
    linescore: {
      teams: {
        home: { runs: number; hits: number; errors: number };
        away: { runs: number; hits: number; errors: number };
      };
      currentInning: number;
      isTopInning: boolean;
    };
    boxscore: {
      teams: {
        home: {
          teamStats: {
            batting: {
              runs: number;
              hits: number;
              strikeOuts: number;
              baseOnBalls: number;
              stolenBases: number;
            };
            pitching: {
              strikeOuts: number;
              baseOnBalls: number;
            };
          };
        };
        away: {
          teamStats: {
            batting: {
              runs: number;
              hits: number;
              strikeOuts: number;
              baseOnBalls: number;
              stolenBases: number;
            };
            pitching: {
              strikeOuts: number;
              baseOnBalls: number;
            };
          };
        };
      };
    };
  };
}

export class MLBApiService {
  private readonly baseUrl = "https://statsapi.mlb.com/api/v1";

  /**
   * Get today's MLB games
   */
  async getTodaysGames(): Promise<MLBGameData[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${this.baseUrl}/schedule/games/?sportId=1&date=${today}`);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.dates || data.dates.length === 0) {
        return [];
      }

      return data.dates[0].games || [];
    } catch (error) {
      console.error("Error fetching today's games:", error);
      return [];
    }
  }

  /**
   * Get games for a specific date
   */
  async getGamesForDate(date: string): Promise<MLBGameData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/schedule/games/?sportId=1&date=${date}`);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.dates || data.dates.length === 0) {
        return [];
      }

      return data.dates[0].games || [];
    } catch (error) {
      console.error(`Error fetching games for ${date}:`, error);
      return [];
    }
  }

  /**
   * Get live game data with detailed stats
   */
  async getLiveGameData(gamePk: number): Promise<MLBLiveGameData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/game/${gamePk}/feed/live`);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching live game data for ${gamePk}:`, error);
      return null;
    }
  }

  /**
   * Process and store game results in database
   */
  async processCompletedGames(): Promise<void> {
    console.log("Processing completed games...");
    
    const todaysGames = await this.getTodaysGames();
    const yesterdaysGames = await this.getGamesForDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    
    const allGames = [...todaysGames, ...yesterdaysGames];
    const completedGames = allGames.filter(game => 
      game.status.abstractGameState === "Final"
    );

    for (const game of completedGames) {
      await this.storeGameResult(game);
    }
  }

  /**
   * Store individual game result in database
   */
  private async storeGameResult(gameData: MLBGameData): Promise<void> {
    try {
      // Get detailed game stats
      const liveData = await this.getLiveGameData(gameData.gamePk);
      if (!liveData) return;

      // Find our teams in the database
      const homeTeam = await db.select().from(teams).where(
        eq(teams.externalId, gameData.teams.home.team.id.toString())
      );
      
      const awayTeam = await db.select().from(teams).where(
        eq(teams.externalId, gameData.teams.away.team.id.toString())
      );

      // Process for both teams if they exist in our database
      for (const [teamSide, teamData] of [['home', homeTeam], ['away', awayTeam]]) {
        if (!Array.isArray(teamData) || teamData.length === 0) continue;
        
        const team = teamData[0];
        const isHome = teamSide === 'home';
        const opponent = isHome ? gameData.teams.away.team.name : gameData.teams.home.team.name;
        const teamScore = isHome ? gameData.teams.home.score : gameData.teams.away.score;
        const opponentScore = isHome ? gameData.teams.away.score : gameData.teams.home.score;
        
        // Extract detailed game stats
        const teamStats = liveData.liveData.boxscore.teams[teamSide as 'home' | 'away'].teamStats;
        const opponentStats = liveData.liveData.boxscore.teams[teamSide === 'home' ? 'away' : 'home'].teamStats;
        
        const gameStats = {
          runs: teamStats.batting.runs,
          hits: teamStats.batting.hits,
          strikeOuts: teamStats.batting.strikeOuts,
          stolenBases: teamStats.batting.stolenBases,
          pitchingStrikeOuts: teamStats.pitching.strikeOuts,
          walks: teamStats.batting.baseOnBalls,
          opponentRuns: teamSide === 'home' ? liveData.liveData.boxscore.teams.away.teamStats.batting.runs : liveData.liveData.boxscore.teams.home.teamStats.batting.runs,
          won: teamScore > opponentScore
        };

        // Check if game already exists
        const existingGame = await db.select().from(games).where(
          and(
            eq(games.externalId, gameData.gamePk.toString()),
            eq(games.teamId, team.id)
          )
        );

        if (existingGame.length === 0) {
          // Insert new game record
          const [insertedGame] = await db.insert(games).values({
            teamId: team.id,
            opponent,
            gameDate: new Date(gameData.gameDate),
            isHome,
            teamScore,
            opponentScore,
            isComplete: true,
            gameStats,
            externalId: gameData.gamePk.toString()
          }).returning();

          console.log(`Stored game result: ${team.name} vs ${opponent} (${teamScore}-${opponentScore})`);

          // Check for triggered promotions
          await this.checkTriggeredPromotions(team.id, insertedGame.id, gameStats, isHome);
        }
      }
    } catch (error) {
      console.error("Error storing game result:", error);
    }
  }

  /**
   * Check if any promotions are triggered by this game result
   */
  private async checkTriggeredPromotions(
    teamId: number, 
    gameId: number, 
    gameStats: any, 
    isHome: boolean
  ): Promise<void> {
    try {
      // Get active promotions for this team
      const activePromotions = await db.select().from(promotions).where(
        and(
          eq(promotions.teamId, teamId),
          eq(promotions.isActive, true)
        )
      );

      for (const promotion of activePromotions) {
        if (await this.evaluateTriggerCondition(promotion.triggerCondition, gameStats, isHome)) {
          // Check if this promotion was already triggered today
          const existingTrigger = await db.select().from(triggeredDeals).where(
            and(
              eq(triggeredDeals.promotionId, promotion.id),
              eq(triggeredDeals.gameId, gameId)
            )
          );

          if (existingTrigger.length === 0) {
            // Trigger the deal
            const expiresAt = new Date();
            expiresAt.setHours(23, 59, 59, 999); // Expires at end of day

            await db.insert(triggeredDeals).values({
              promotionId: promotion.id,
              gameId,
              expiresAt,
              isActive: true
            });

            console.log(`Triggered promotion: ${promotion.title} for team ${teamId}`);
            
            // Here we would send notifications to users
            // await this.sendNotifications(promotion.id, gameId);
          }
        }
      }
    } catch (error) {
      console.error("Error checking triggered promotions:", error);
    }
  }

  /**
   * Evaluate if a trigger condition is met
   */
  private async evaluateTriggerCondition(
    condition: string, 
    gameStats: any, 
    isHome: boolean
  ): Promise<boolean> {
    const conditionLower = condition.toLowerCase();

    // Home game conditions
    if (conditionLower.includes("home") && !isHome) {
      return false;
    }

    // Win conditions
    if (conditionLower.includes("win") || conditionLower.includes("won")) {
      if (!gameStats.won) return false;
    }

    // Run scoring conditions
    if (conditionLower.includes("6+ runs") || conditionLower.includes("scored 6")) {
      if (gameStats.runs < 6) return false;
    }

    // Strikeout conditions
    if (conditionLower.includes("7+ strikeouts") || conditionLower.includes("struck out 7")) {
      if (gameStats.pitchingStrikeOuts < 7) return false;
    }

    // Stolen base conditions
    if (conditionLower.includes("stole") || conditionLower.includes("stolen base")) {
      if (gameStats.stolenBases < 1) return false;
    }

    return true;
  }

  /**
   * Get current MLB teams for reference
   */
  async getAllMLBTeams(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/teams?sportId=1`);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data = await response.json();
      return data.teams || [];
    } catch (error) {
      console.error("Error fetching MLB teams:", error);
      return [];
    }
  }
}

export const mlbApiService = new MLBApiService();