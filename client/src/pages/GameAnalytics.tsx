import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, TrendingUp, Trophy, Target, Clock, MapPin } from "lucide-react";

interface GameData {
  id: number;
  opponent: string;
  gameDate: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  isComplete: boolean;
  gameStats: any;
}

interface UpcomingGame {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
  };
  teams: {
    away: { team: { name: string } };
    home: { team: { name: string } };
  };
  venue: { name: string };
  isHome: boolean;
}

interface TriggeredDeal {
  id: number;
  triggeredAt: string;
  expiresAt: string;
  isActive: boolean;
  promotionTitle: string;
  promotionDescription: string;
  restaurantName: string;
  teamName: string;
  gameOpponent: string;
  gameDate: string;
  teamScore: number;
  opponentScore: number;
}

interface Analytics {
  totalGames: number;
  wins: number;
  losses: number;
  homeGames: number;
  awayGames: number;
  homeWins: number;
  awayWins: number;
  averageRunsScored: number;
  averageRunsAllowed: number;
  gamesScored6Plus: number;
  recentForm: string;
}

export default function GameAnalytics() {
  const [selectedTeamId] = useState(1); // Dodgers team ID from seeded data

  // Fetch recent games
  const { data: recentGames, isLoading: loadingRecent } = useQuery<GameData[]>({
    queryKey: [`/api/admin/mlb/recent-games/${selectedTeamId}`],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch upcoming games
  const { data: upcomingGames, isLoading: loadingUpcoming } = useQuery<UpcomingGame[]>({
    queryKey: [`/api/admin/mlb/upcoming-games/${selectedTeamId}`],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch triggered deals
  const { data: triggeredDeals, isLoading: loadingDeals } = useQuery<TriggeredDeal[]>({
    queryKey: ['/api/admin/mlb/triggered-deals'],
    refetchInterval: 30000,
  });

  // Fetch analytics
  const { data: analytics, isLoading: loadingAnalytics } = useQuery<Analytics>({
    queryKey: [`/api/admin/mlb/analytics/${selectedTeamId}`],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const getGameResult = (game: GameData) => {
    if (!game.isComplete) return "In Progress";
    return game.teamScore > game.opponentScore ? "W" : "L";
  };

  const getGameResultBadge = (game: GameData) => {
    const result = getGameResult(game);
    if (result === "W") return <Badge className="bg-green-100 text-green-800">W</Badge>;
    if (result === "L") return <Badge className="bg-red-100 text-red-800">L</Badge>;
    return <Badge variant="secondary">IP</Badge>;
  };

  const formatGameTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MLB Game Analytics - Los Angeles Dodgers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Live game data, outcomes, and promotion triggers
          </p>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{analytics.totalGames}</div>
                <p className="text-sm text-muted-foreground">Total Games</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{analytics.wins}</div>
                <p className="text-sm text-muted-foreground">Wins</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{analytics.losses}</div>
                <p className="text-sm text-muted-foreground">Losses</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{analytics.homeWins}</div>
                <p className="text-sm text-muted-foreground">Home Wins</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{analytics.gamesScored6Plus}</div>
                <p className="text-sm text-muted-foreground">6+ Run Games</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-lg font-bold text-gray-600">{(analytics.averageRunsScored || 0).toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Avg Runs/Game</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Form */}
        {analytics?.recentForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Form (Last 10 Games)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1">
                {analytics.recentForm.split('').map((result, index) => (
                  <Badge 
                    key={index} 
                    variant={result === 'W' ? 'default' : 'destructive'}
                    className={result === 'W' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                  >
                    {result}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recent">Recent Games</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming Games</TabsTrigger>
            <TabsTrigger value="deals">Triggered Deals</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Recent Games */}
          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Recent Game Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRecent ? (
                  <div className="text-center py-8">Loading recent games...</div>
                ) : recentGames && recentGames.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Opponent</TableHead>
                        <TableHead>Home/Away</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Runs Scored</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentGames.map((game) => (
                        <TableRow key={game.id}>
                          <TableCell>{formatGameTime(game.gameDate)}</TableCell>
                          <TableCell className="font-medium">vs {game.opponent}</TableCell>
                          <TableCell>
                            <Badge variant={game.isHome ? "default" : "secondary"}>
                              {game.isHome ? "Home" : "Away"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {game.isComplete ? `${game.teamScore} - ${game.opponentScore}` : "In Progress"}
                          </TableCell>
                          <TableCell>{getGameResultBadge(game)}</TableCell>
                          <TableCell>
                            <span className={game.teamScore >= 6 ? "font-bold text-green-600" : ""}>
                              {game.teamScore}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent games found. Game data will appear here during the season.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upcoming Games */}
          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Upcoming Games
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUpcoming ? (
                  <div className="text-center py-8">Loading upcoming games...</div>
                ) : upcomingGames && upcomingGames.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Opponent</TableHead>
                        <TableHead>Home/Away</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingGames.map((game) => (
                        <TableRow key={game.gamePk}>
                          <TableCell>{formatDateTime(game.gameDate)}</TableCell>
                          <TableCell className="font-medium">
                            vs {game.isHome ? game.teams.away.team.name : game.teams.home.team.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={game.isHome ? "default" : "secondary"}>
                              {game.isHome ? "Home" : "Away"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {game.venue.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{game.status.detailedState}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No upcoming games scheduled. Check back during the season.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Triggered Deals */}
          <TabsContent value="deals">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Recently Triggered Deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDeals ? (
                  <div className="text-center py-8">Loading triggered deals...</div>
                ) : triggeredDeals && triggeredDeals.length > 0 ? (
                  <div className="space-y-4">
                    {triggeredDeals.map((deal) => (
                      <div key={deal.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{deal.promotionTitle}</h3>
                          <Badge variant={deal.isActive ? "default" : "secondary"}>
                            {deal.isActive ? "Active" : "Expired"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{deal.promotionDescription}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="font-medium">Restaurant:</span> {deal.restaurantName}
                          </div>
                          <div>
                            <span className="font-medium">Game:</span> vs {deal.gameOpponent}
                          </div>
                          <div>
                            <span className="font-medium">Score:</span> {deal.teamScore}-{deal.opponentScore}
                          </div>
                          <div>
                            <span className="font-medium">Triggered:</span> {formatDateTime(deal.triggeredAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No deals have been triggered yet. Deals will appear here when game conditions are met.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingAnalytics ? (
                    <div className="text-center py-8">Loading analytics...</div>
                  ) : analytics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-lg font-semibold">Home Record</div>
                          <div className="text-muted-foreground">
                            {analytics.homeWins}-{analytics.homeGames - analytics.homeWins} 
                            ({analytics.homeGames > 0 ? ((analytics.homeWins / analytics.homeGames) * 100).toFixed(1) : 0}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">Away Record</div>
                          <div className="text-muted-foreground">
                            {analytics.awayWins}-{analytics.awayGames - analytics.awayWins}
                            ({analytics.awayGames > 0 ? ((analytics.awayWins / analytics.awayGames) * 100).toFixed(1) : 0}%)
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-lg font-semibold">Avg Runs Scored</div>
                          <div className="text-muted-foreground">{(analytics.averageRunsScored || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">Avg Runs Allowed</div>
                          <div className="text-muted-foreground">{(analytics.averageRunsAllowed || 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No analytics available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Deal Trigger Potential</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-lg font-semibold">6+ Run Games</div>
                        <div className="text-muted-foreground">
                          {analytics.gamesScored6Plus} of {analytics.totalGames} games 
                          ({analytics.totalGames > 0 ? ((analytics.gamesScored6Plus / analytics.totalGames) * 100).toFixed(1) : 0}%)
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Home Win Rate</div>
                        <div className="text-muted-foreground">
                          {analytics.homeGames > 0 ? ((analytics.homeWins / analytics.homeGames) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-4">
                        <p>• McDonald's: Home wins + 6+ runs</p>
                        <p>• ampm: Any home win</p>
                        <p>• Jack in the Box: Home game + 7+ strikeouts</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Analytics loading...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}