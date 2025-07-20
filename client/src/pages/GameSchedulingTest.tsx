import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, CheckCircle, AlertTriangle, Calendar, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function GameSchedulingTest() {
  const { toast } = useToast();

  // Test pre-game alert
  const testPreGameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/game-scheduling/test-pregame");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pre-Game Alert Sent",
        description: `Test alert sent successfully for ${data.gameData.teamName} vs ${data.gameData.opponent}`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/game-scheduling/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test post-game alert
  const testPostGameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/game-scheduling/test-postgame");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Post-Game Alert Sent",
        description: `Victory alert sent with ${data.gameData.triggeredDeals.length} triggered deals`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/game-scheduling/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reinitialize scheduling service
  const reinitializeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/game-scheduling/initialize");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Service Reinitialized",
        description: "Game scheduling service has been reinitialized successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/game-scheduling/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/game-scheduling/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reinitialization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch scheduling stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/game-scheduling/stats"],
    retry: false,
  });

  // Fetch upcoming games
  const { data: upcomingGames, isLoading: gamesLoading } = useQuery({
    queryKey: ["/api/admin/game-scheduling/upcoming"],
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Game Scheduling Test Center</h1>
          <p className="text-gray-600">Test pre-game and post-game notification system with real-time scheduling capabilities.</p>
        </div>

        {/* Test Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                Pre-Game Alert Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Send a test "game starts in 1 hour" alert with potential deals preview.
              </p>
              <Button 
                onClick={() => testPreGameMutation.mutate()}
                disabled={testPreGameMutation.isPending}
                className="w-full"
                variant="outline"
              >
                {testPreGameMutation.isPending ? "Sending..." : "Send Pre-Game Alert"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-green-600" />
                Post-Game Alert Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Send a test victory alert with triggered deals and promo codes.
              </p>
              <Button 
                onClick={() => testPostGameMutation.mutate()}
                disabled={testPostGameMutation.isPending}
                className="w-full"
                variant="outline"
              >
                {testPostGameMutation.isPending ? "Sending..." : "Send Victory Alert"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Reinitialize Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Restart the game scheduling service and reload upcoming games.
              </p>
              <Button 
                onClick={() => reinitializeMutation.mutate()}
                disabled={reinitializeMutation.isPending}
                className="w-full"
                variant="outline"
              >
                {reinitializeMutation.isPending ? "Reinitializing..." : "Reinitialize"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Scheduling Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : stats?.success ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{stats.stats.totalAlerts}</p>
                    <p className="text-sm text-gray-600">Total Alerts</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{stats.stats.preGameAlerts}</p>
                    <p className="text-sm text-gray-600">Pre-Game</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{stats.stats.postGameAlerts}</p>
                    <p className="text-sm text-gray-600">Post-Game</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{stats.stats.successRate}%</p>
                    <p className="text-sm text-gray-600">Success Rate</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No statistics available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Upcoming Games
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gamesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : upcomingGames?.success && upcomingGames?.games?.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {upcomingGames.games.slice(0, 5).map((game: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-sm">{game.opponent}</p>
                        <p className="text-xs text-gray-500">{new Date(game.gameDate).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {game.isHome ? 'Home' : 'Away'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No upcoming games scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>Game Timing System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Pre-Game Alerts (1 hour before)</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Sent automatically 1 hour before game start</li>
                  <li>• Shows potential deals that could trigger</li>
                  <li>• Builds excitement for upcoming game</li>
                  <li>• Includes game time, venue, and opponent info</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Post-Game Alerts (after victory)</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Sent immediately after game completion</li>
                  <li>• Only sent for games that trigger deals</li>
                  <li>• Includes promo codes and instructions</li>
                  <li>• Deals expire 24 hours after trigger</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}