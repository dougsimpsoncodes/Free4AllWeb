interface MLBGameResponse {
  games: Array<{
    gamePk: number;
    gameDate: string;
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
    status: {
      statusCode: string;
      detailedState: string;
    };
    linescore?: {
      teams: {
        home: {
          runs: number;
          hits: number;
          errors: number;
        };
        away: {
          runs: number;
          hits: number;
          errors: number;
        };
      };
    };
  }>;
}

interface MLBBoxScoreResponse {
  teams: {
    away: {
      teamStats: {
        batting: {
          runs: number;
          hits: number;
          strikeOuts: number;
          stolenBases: number;
        };
        pitching: {
          strikeOuts: number;
        };
      };
    };
    home: {
      teamStats: {
        batting: {
          runs: number;
          hits: number;
          strikeOuts: number;
          stolenBases: number;
        };
        pitching: {
          strikeOuts: number;
        };
      };
    };
  };
}

class SportsApiService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';

  async getRecentGames(teamId: number, days: number = 7): Promise<any[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const url = `${this.baseUrl}/schedule?teamId=${teamId}&startDate=${startDateStr}&endDate=${endDateStr}&sportId=1`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data: MLBGameResponse = await response.json();
      return data.games || [];
    } catch (error) {
      console.error('Error fetching recent games:', error);
      return [];
    }
  }

  async getGameBoxScore(gameId: number): Promise<any> {
    try {
      const url = `${this.baseUrl}/game/${gameId}/boxscore`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data: MLBBoxScoreResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching game box score:', error);
      return null;
    }
  }

  async getGameDetails(gameId: number): Promise<any> {
    try {
      const url = `${this.baseUrl}/game/${gameId}/feed/live`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching game details:', error);
      return null;
    }
  }

  parseGameStats(gameData: any, teamIsHome: boolean): any {
    if (!gameData || !gameData.teams) {
      return {};
    }

    const teamStats = teamIsHome ? gameData.teams.home : gameData.teams.away;
    const opponentStats = teamIsHome ? gameData.teams.away : gameData.teams.home;

    return {
      runs: teamStats.teamStats?.batting?.runs || 0,
      hits: teamStats.teamStats?.batting?.hits || 0,
      strikeOuts: teamStats.teamStats?.pitching?.strikeOuts || 0,
      stolenBases: teamStats.teamStats?.batting?.stolenBases || 0,
      opponentRuns: opponentStats.teamStats?.batting?.runs || 0,
    };
  }

  // Map external MLB team IDs to our internal team IDs
  getInternalTeamId(externalId: string): number | null {
    const teamMapping: { [key: string]: number } = {
      '119': 1, // LA Dodgers
      '108': 2, // LA Angels (when added)
      // Add more mappings as teams are added
    };

    return teamMapping[externalId] || null;
  }

  // Helper method to check if a team won
  teamWon(teamScore: number, opponentScore: number, isComplete: boolean): boolean {
    return isComplete && teamScore > opponentScore;
  }

  // Helper method to check if team was playing at home
  isHomeGame(gameData: any, teamId: number): boolean {
    return gameData.teams?.home?.team?.id === teamId;
  }
}

export const sportsApiService = new SportsApiService();
