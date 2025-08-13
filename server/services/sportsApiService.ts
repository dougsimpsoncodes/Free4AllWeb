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
  private mlbUrl = 'https://statsapi.mlb.com/api/v1';
  private espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';

  async getRecentGames(internalTeamId: number, days: number = 7): Promise<any[]> {
    // Get external team ID for API calls
    const externalTeamId = this.getExternalTeamId(internalTeamId);
    if (!externalTeamId) {
      console.error(`No external team mapping for internal team ID ${internalTeamId}`);
      return [];
    }

    console.log(`Getting recent games for team ${internalTeamId} (external ID: ${externalTeamId})`);
    
    // Try MLB API first
    try {
      const games = await this.getRecentGamesFromMLB(parseInt(externalTeamId), days);
      if (games.length > 0) {
        console.log(`Found ${games.length} games from MLB API`);
        return games;
      }
    } catch (error) {
      console.log('MLB API failed, trying ESPN as backup...', error.message);
    }

    // Fallback to ESPN API
    try {
      const games = await this.getRecentGamesFromESPN(parseInt(externalTeamId), days);
      console.log(`Found ${games.length} games from ESPN API`);
      return games;
    } catch (error) {
      console.error('Both MLB and ESPN APIs failed:', error);
      return [];
    }
  }

  private getExternalTeamId(internalTeamId: number): string | null {
    const teamMapping: { [key: number]: string } = {
      1: '119', // LA Dodgers
      // Add more mappings as teams are added
    };
    return teamMapping[internalTeamId] || null;
  }

  private async getRecentGamesFromMLB(teamId: number, days: number): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const url = `${this.mlbUrl}/schedule?teamId=${teamId}&startDate=${startDateStr}&endDate=${endDateStr}&sportId=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status}`);
    }

    const data: MLBGameResponse = await response.json();
    return data.games || [];
  }

  private async getRecentGamesFromESPN(teamId: number, days: number): Promise<any[]> {
    // ESPN uses different team IDs, need to map
    const espnTeamId = this.getESPNTeamId(teamId);
    if (!espnTeamId) {
      throw new Error(`No ESPN team mapping for team ID ${teamId}`);
    }

    const response = await fetch(`${this.espnUrl}/teams/${espnTeamId}/schedule`);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    const recentGames = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Process ESPN game format and convert to MLB-like format
    if (data.events) {
      for (const event of data.events) {
        const gameDate = new Date(event.date);
        if (gameDate >= cutoffDate && event.status.type.completed) {
          recentGames.push(this.convertESPNGameToMLBFormat(event, teamId));
        }
      }
    }

    return recentGames;
  }

  private getESPNTeamId(internalTeamId: number): string | null {
    const teamMapping: { [key: number]: string } = {
      1: '119', // LA Dodgers - same ID in ESPN
      // Add more mappings as needed
    };
    return teamMapping[internalTeamId] || null;
  }

  private convertESPNGameToMLBFormat(espnGame: any, teamId: number): any {
    const isHome = espnGame.competitions[0].competitors.some(
      (comp: any) => comp.homeAway === 'home' && comp.team.id === teamId.toString()
    );
    
    const homeTeam = espnGame.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = espnGame.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
    
    return {
      gamePk: parseInt(espnGame.id),
      gameDate: espnGame.date,
      teams: {
        home: {
          team: { id: parseInt(homeTeam.team.id), name: homeTeam.team.displayName },
          score: parseInt(homeTeam.score || 0)
        },
        away: {
          team: { id: parseInt(awayTeam.team.id), name: awayTeam.team.displayName },
          score: parseInt(awayTeam.score || 0)
        }
      },
      status: {
        statusCode: espnGame.status.type.completed ? 'F' : 'S',
        detailedState: espnGame.status.type.description
      },
      source: 'ESPN' // Mark as ESPN sourced
    };
  }

  async getGameBoxScore(gameId: number): Promise<any> {
    try {
      const url = `${this.mlbUrl}/game/${gameId}/boxscore`;
      
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
      const url = `${this.mlbUrl}/game/${gameId}/feed/live`;
      
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
