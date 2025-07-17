import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target, Zap, Trophy } from "lucide-react";

export default function MultiSportStats() {
  const stats = [
    {
      sport: "MLB",
      teams: 5,
      activeDeals: 2,
      totalTriggered: 47,
      recentWins: "Dodgers (8-4)",
      color: "bg-blue-500",
      icon: "⚾"
    },
    {
      sport: "NBA", 
      teams: 3,
      activeDeals: 2,
      totalTriggered: 23,
      recentWins: "Lakers (125-105)",
      color: "bg-orange-500",
      icon: "🏀"
    },
    {
      sport: "NFL",
      teams: 2,
      activeDeals: 0,
      totalTriggered: 8,
      recentWins: "Rams (28-14)",
      color: "bg-green-600",
      icon: "🏈"
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2">Multi-Sport Tracking Dashboard</h3>
        <p className="text-muted-foreground">Real-time deal monitoring across all major leagues</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((sport) => (
          <Card key={sport.sport} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${sport.color}`} />
            
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{sport.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{sport.sport}</CardTitle>
                    <Badge variant="outline">{sport.teams} teams tracked</Badge>
                  </div>
                </div>
                <Badge 
                  variant={sport.activeDeals > 0 ? "default" : "secondary"}
                  className={sport.activeDeals > 0 ? sport.color.replace('bg-', 'bg-') : ''}
                >
                  {sport.activeDeals} active
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{sport.totalTriggered}</div>
                  <div className="text-xs text-muted-foreground">Total Deals</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{sport.activeDeals}</div>
                  <div className="text-xs text-muted-foreground">Live Now</div>
                </div>
              </div>

              <div className="p-2 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Latest:</span>
                  <span className="text-muted-foreground">{sport.recentWins}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Live Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Lakers deal triggered!</span>
                  <Badge variant="outline">NBA</Badge>
                  <span className="text-sm text-muted-foreground">2 minutes ago</span>
                </div>
                <p className="text-sm text-muted-foreground">Free Del Burger - Lakers scored 125+ points</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Dodgers deal triggered!</span>
                  <Badge variant="outline">MLB</Badge>
                  <span className="text-sm text-muted-foreground">1 hour ago</span>
                </div>
                <p className="text-sm text-muted-foreground">Free Big Mac - Dodgers scored 8 runs at home</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Monitoring active games...</span>
                  <Badge variant="secondary">Multi-Sport</Badge>
                  <span className="text-sm text-muted-foreground">Real-time</span>
                </div>
                <p className="text-sm text-muted-foreground">Watching 10 teams across MLB, NBA, NFL for deal triggers</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}