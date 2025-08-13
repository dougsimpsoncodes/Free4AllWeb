import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Database, Zap, CheckCircle, Clock, AlertCircle, Search, Eye, Layers } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface GameProcessorStatus {
  isRunning: boolean;
  isProcessing: boolean;
  lastCheck: string | null;
}

interface PromotionData {
  team: string;
  restaurant: string;
  title: string;
  trigger_condition: string;
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  // Fetch game processor status
  const { data: status, isLoading: statusLoading } = useQuery<GameProcessorStatus>({
    queryKey: ['/api/mlb/games/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch today's games
  const { data: todaysGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['/api/mlb/games/today'],
    refetchInterval: 30000, // Refresh every 30 seconds
  }) as { data: any[] | undefined, isLoading: boolean };

  // Fetch active promotions
  const { data: promotions, isLoading: promotionsLoading } = useQuery<PromotionData[]>({
    queryKey: ['/api/admin/promotions'],
    // This would be a custom endpoint to fetch promotion data
  });

  // Fetch discovery status
  const { data: discoveryStats, isLoading: discoveryLoading } = useQuery({
    queryKey: ['/api/admin/discovery/sites'],
    select: (data: any[]) => {
      if (!data) return null;
      const pending = data.filter(site => site.status === 'pending').length;
      const approved = data.filter(site => site.status === 'approved').length;
      const highConfidence = data.filter(site => site.confidenceScore && site.confidenceScore >= 0.7).length;
      return { pending, approved, highConfidence, total: data.length };
    }
  });

  // Manual game processing
  const processGamesMutation = useMutation({
    mutationFn: () => apiRequest('/api/mlb/games/process', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mlb/games/status'] });
    },
  });

  const getStatusColor = () => {
    if (!status) return "gray";
    if (status.isProcessing) return "yellow";
    if (status.isRunning) return "green";
    return "red";
  };

  const getStatusText = () => {
    if (!status) return "Unknown";
    if (status.isProcessing) return "Processing Games...";
    if (status.isRunning) return "Active & Monitoring";
    return "Stopped";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MLB Game Processing Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Monitor real-time game data and promotion triggers
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Game Processor Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Game Processor</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusColor() === "green" ? "default" : "destructive"}>
                  {getStatusText()}
                </Badge>
                {status?.isProcessing && <Clock className="h-4 w-4 animate-spin" />}
              </div>
              {status?.lastCheck && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last check: {new Date(status.lastCheck).toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Today's Games */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Games</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {gamesLoading ? "..." : todaysGames?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {todaysGames?.length === 0 ? "Off-season" : "Games scheduled"}
              </p>
            </CardContent>
          </Card>

          {/* Active Promotions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">3</div>
              <p className="text-xs text-muted-foreground">
                Ready for Dodgers games
              </p>
            </CardContent>
          </Card>

          {/* Deal Discovery Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deal Discovery</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {discoveryLoading ? "..." : discoveryStats?.pending || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending review
              </p>
              {discoveryStats && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    {discoveryStats.highConfidence} high confidence
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    {discoveryStats.approved} approved
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => processGamesMutation.mutate()}
                disabled={processGamesMutation.isPending}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {processGamesMutation.isPending ? "Processing..." : "Process Games Now"}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries()}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Refresh Data
              </Button>
            </div>
            
            {processGamesMutation.isSuccess && (
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-400">
                  ✅ Game processing completed successfully
                </p>
              </div>
            )}
            
            {processGamesMutation.isError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-400">
                  ❌ Game processing failed
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Promotions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Active Promotions Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Trigger Condition</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Los Angeles Dodgers</TableCell>
                  <TableCell>McDonald's</TableCell>
                  <TableCell>Free Big Mac on Dodgers Home Win</TableCell>
                  <TableCell>home win and 6+ runs scored</TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Los Angeles Dodgers</TableCell>
                  <TableCell>ampm</TableCell>
                  <TableCell>Free Coffee on Dodgers Win</TableCell>
                  <TableCell>home win</TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Los Angeles Dodgers</TableCell>
                  <TableCell>Jack in the Box</TableCell>
                  <TableCell>Free Curly Fries on 7+ Strikeouts</TableCell>
                  <TableCell>home game and 7+ strikeouts</TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>MLB API Endpoint:</strong>
                <br />
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  statsapi.mlb.com/api/v1
                </code>
              </div>
              <div>
                <strong>Processing Interval:</strong>
                <br />
                Every 5 minutes
              </div>
              <div>
                <strong>Game Check Window:</strong>
                <br />
                Today + Yesterday
              </div>
              <div>
                <strong>Deal Expiration:</strong>
                <br />
                End of day (11:59 PM)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}