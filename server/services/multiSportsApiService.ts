// Multi-sport API service supporting MLB, NBA, NFL, NHL
interface BaseGameData {
  id: string;
  date: string;
  homeTeam: { id: string; name: string; score?: number };
  awayTeam: { id: string; name: string; score?: number };
  status: string;
  isComplete: boolean;
  stats?: any;
}

interface BaseTeamData {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  sport: 'MLB' | 'NBA' | 'NFL' | 'NHL';
  conference?: string;
  division?: string;
  primaryColor?: string;
}

class MultiSportsApiService {
  private baseUrls = {
    MLB: 'https://statsapi.mlb.com/api/v1',
    NBA: 'https://stats.nba.com/stats',
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
    NHL: 'https://statsapi.web.nhl.com/api/v1'
  };

  // MLB API methods
  async getMLBGames(teamId: string, days: number = 7): Promise<BaseGameData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const url = `${this.baseUrls.MLB}/schedule?teamId=${teamId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      return data.dates?.flatMap((date: any) => 
        date.games?.map((game: any) => ({
          id: game.gamePk.toString(),
          date: game.gameDate,
          homeTeam: {
            id: game.teams.home.team.id.toString(),
            name: game.teams.home.team.name,
            score: game.teams.home.score
          },
          awayTeam: {
            id: game.teams.away.team.id.toString(),
            name: game.teams.away.team.name,
            score: game.teams.away.score
          },
          status: game.status.detailedState,
          isComplete: game.status.statusCode === 'F',
          stats: game.linescore
        }))
      ) || [];
    } catch (error) {
      console.error('MLB API error:', error);
      return [];
    }
  }

  async getMLBTeams(): Promise<BaseTeamData[]> {
    try {
      const response = await fetch(`${this.baseUrls.MLB}/teams`);
      const data = await response.json();
      
      return data.teams?.map((team: any) => ({
        id: team.id.toString(),
        name: team.name,
        city: team.locationName,
        abbreviation: team.abbreviation,
        sport: 'MLB' as const,
        conference: team.league.name, // AL/NL
        division: team.division.name,
        primaryColor: team.teamColors?.primary
      })) || [];
    } catch (error) {
      console.error('MLB Teams API error:', error);
      return [];
    }
  }

  // NBA API methods
  async getNBAGames(teamId: string, days: number = 7): Promise<BaseGameData[]> {
    // NBA API requires different approach due to CORS and authentication
    try {
      const response = await fetch(`${this.baseUrls.NBA}/teamgamelog?TeamID=${teamId}&Season=2024-25&SeasonType=Regular Season`);
      const data = await response.json();
      
      return data.resultSets?.[0]?.rowSet?.slice(0, days)?.map((game: any[]) => ({
        id: game[1]?.toString(),
        date: game[3],
        homeTeam: {
          id: game[7] === 'vs' ? teamId : 'opponent',
          name: game[7] === 'vs' ? 'Team' : game[4],
          score: game[7] === 'vs' ? game[24] : game[25]
        },
        awayTeam: {
          id: game[7] === '@' ? teamId : 'opponent',
          name: game[7] === '@' ? 'Team' : game[4],
          score: game[7] === '@' ? game[24] : game[25]
        },
        status: game[6] || 'Final',
        isComplete: true,
        stats: { points: game[24], rebounds: game[19], assists: game[20] }
      })) || [];
    } catch (error) {
      console.error('NBA API error:', error);
      return [];
    }
  }

  async getNBATeams(): Promise<BaseTeamData[]> {
    const teams = [
      { id: '1610612737', name: 'Hawks', city: 'Atlanta', abbreviation: 'ATL', conference: 'Eastern', division: 'Southeast' },
      { id: '1610612738', name: 'Celtics', city: 'Boston', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic' },
      { id: '1610612739', name: 'Cavaliers', city: 'Cleveland', abbreviation: 'CLE', conference: 'Eastern', division: 'Central' },
      { id: '1610612740', name: 'Pelicans', city: 'New Orleans', abbreviation: 'NOP', conference: 'Western', division: 'Southwest' },
      { id: '1610612741', name: 'Bulls', city: 'Chicago', abbreviation: 'CHI', conference: 'Eastern', division: 'Central' },
      { id: '1610612742', name: 'Mavericks', city: 'Dallas', abbreviation: 'DAL', conference: 'Western', division: 'Southwest' },
      { id: '1610612743', name: 'Nuggets', city: 'Denver', abbreviation: 'DEN', conference: 'Western', division: 'Northwest' },
      { id: '1610612744', name: 'Warriors', city: 'Golden State', abbreviation: 'GSW', conference: 'Western', division: 'Pacific' },
      { id: '1610612745', name: 'Rockets', city: 'Houston', abbreviation: 'HOU', conference: 'Western', division: 'Southwest' },
      { id: '1610612746', name: 'Clippers', city: 'LA', abbreviation: 'LAC', conference: 'Western', division: 'Pacific' },
      { id: '1610612747', name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL', conference: 'Western', division: 'Pacific' },
      { id: '1610612748', name: 'Heat', city: 'Miami', abbreviation: 'MIA', conference: 'Eastern', division: 'Southeast' },
      { id: '1610612749', name: 'Bucks', city: 'Milwaukee', abbreviation: 'MIL', conference: 'Eastern', division: 'Central' },
      { id: '1610612750', name: 'Timberwolves', city: 'Minnesota', abbreviation: 'MIN', conference: 'Western', division: 'Northwest' },
      { id: '1610612751', name: 'Nets', city: 'Brooklyn', abbreviation: 'BKN', conference: 'Eastern', division: 'Atlantic' },
      { id: '1610612752', name: 'Knicks', city: 'New York', abbreviation: 'NYK', conference: 'Eastern', division: 'Atlantic' },
      { id: '1610612753', name: 'Magic', city: 'Orlando', abbreviation: 'ORL', conference: 'Eastern', division: 'Southeast' },
      { id: '1610612754', name: 'Pacers', city: 'Indiana', abbreviation: 'IND', conference: 'Eastern', division: 'Central' },
      { id: '1610612755', name: '76ers', city: 'Philadelphia', abbreviation: 'PHI', conference: 'Eastern', division: 'Atlantic' },
      { id: '1610612756', name: 'Suns', city: 'Phoenix', abbreviation: 'PHX', conference: 'Western', division: 'Pacific' },
      { id: '1610612757', name: 'Trail Blazers', city: 'Portland', abbreviation: 'POR', conference: 'Western', division: 'Northwest' },
      { id: '1610612758', name: 'Kings', city: 'Sacramento', abbreviation: 'SAC', conference: 'Western', division: 'Pacific' },
      { id: '1610612759', name: 'Spurs', city: 'San Antonio', abbreviation: 'SAS', conference: 'Western', division: 'Southwest' },
      { id: '1610612760', name: 'Thunder', city: 'Oklahoma City', abbreviation: 'OKC', conference: 'Western', division: 'Northwest' },
      { id: '1610612761', name: 'Raptors', city: 'Toronto', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic' },
      { id: '1610612762', name: 'Jazz', city: 'Utah', abbreviation: 'UTA', conference: 'Western', division: 'Northwest' },
      { id: '1610612763', name: 'Grizzlies', city: 'Memphis', abbreviation: 'MEM', conference: 'Western', division: 'Southwest' },
      { id: '1610612764', name: 'Wizards', city: 'Washington', abbreviation: 'WAS', conference: 'Eastern', division: 'Southeast' },
      { id: '1610612765', name: 'Pistons', city: 'Detroit', abbreviation: 'DET', conference: 'Eastern', division: 'Central' },
      { id: '1610612766', name: 'Hornets', city: 'Charlotte', abbreviation: 'CHA', conference: 'Eastern', division: 'Southeast' }
    ];

    return teams.map(team => ({
      ...team,
      sport: 'NBA' as const
    }));
  }

  // Generic methods for all sports
  async getGamesForTeam(sport: string, teamId: string, days: number = 7): Promise<BaseGameData[]> {
    switch (sport) {
      case 'MLB':
        return this.getMLBGames(teamId, days);
      case 'NBA':
        return this.getNBAGames(teamId, days);
      case 'NFL':
        // NFL implementation would go here
        return [];
      case 'NHL':
        // NHL implementation would go here
        return [];
      default:
        return [];
    }
  }

  async getTeamsForSport(sport: string): Promise<BaseTeamData[]> {
    switch (sport) {
      case 'MLB':
        return this.getMLBTeams();
      case 'NBA':
        return this.getNBATeams();
      case 'NFL':
        // NFL teams would go here
        return [];
      case 'NHL':
        // NHL teams would go here
        return [];
      default:
        return [];
    }
  }

  // Utility methods
  determineWinner(game: BaseGameData): 'home' | 'away' | 'tie' | null {
    if (!game.isComplete || !game.homeTeam.score || !game.awayTeam.score) {
      return null;
    }
    
    if (game.homeTeam.score > game.awayTeam.score) return 'home';
    if (game.awayTeam.score > game.homeTeam.score) return 'away';
    return 'tie';
  }

  teamWon(game: BaseGameData, teamId: string): boolean {
    const winner = this.determineWinner(game);
    if (!winner || winner === 'tie') return false;
    
    const teamIsHome = game.homeTeam.id === teamId;
    return (teamIsHome && winner === 'home') || (!teamIsHome && winner === 'away');
  }
}

export const multiSportsApiService = new MultiSportsApiService();