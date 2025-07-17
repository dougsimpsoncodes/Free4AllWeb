import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Eye, ExternalLink, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DiscoveredDeal {
  id: string;
  restaurantName: string;
  teamName: string;
  dealText: string;
  promoCode?: string;
  sourceUrl: string;
  triggerCondition?: string;
  validUntil?: Date;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  discoveredAt: Date;
  approvedImagePath?: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Load existing deals
  const { data: existingDeals, isLoading: loadingDeals, refetch: loadDeals } = useQuery<{
    success: boolean;
    deals: DiscoveredDeal[];
    count: number;
  }>({
    queryKey: ['/api/admin/deals'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Discover new deals query
  const { data: discoveredDeals, isLoading: discovering, refetch: discoverDeals } = useQuery<{
    success: boolean;
    deals: DiscoveredDeal[];
    count: number;
  }>({
    queryKey: ['/api/admin/discover-deals'],
    enabled: false, // Only run when manually triggered
    retry: false,
  });

  // Approve deal mutation
  const approveDealMutation = useMutation({
    mutationFn: async ({ dealId, imageAssetPath }: { dealId: string; imageAssetPath?: string }) => {
      return await apiRequest(`/api/admin/deals/${dealId}/approve`, 'POST', { imageAssetPath });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Deal approved successfully!",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deals'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to approve deal.",
        variant: "destructive",
      });
      console.error('Approval failed:', error);
    },
  });

  // Reject deal mutation
  const rejectDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return await apiRequest(`/api/admin/deals/${dealId}/reject`, 'POST', {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Deal rejected successfully!",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deals'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reject deal.",
        variant: "destructive",
      });
      console.error('Rejection failed:', error);
    },
  });

  const toggleDealSelection = (dealId: string) => {
    const newSelection = new Set(selectedDeals);
    if (newSelection.has(dealId)) {
      newSelection.delete(dealId);
    } else {
      newSelection.add(dealId);
    }
    setSelectedDeals(newSelection);
  };

  // Combine existing and newly discovered deals
  const allDeals = [
    ...(existingDeals?.deals || []),
    ...(discoveredDeals?.deals || [])
  ].filter((deal, index, self) => 
    index === self.findIndex(d => d.id === deal.id)
  );

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  // Fetch MLB game processor status
  const { data: mlbStatus, isLoading: mlbStatusLoading } = useQuery({
    queryKey: ['/api/mlb/games/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: isAuthenticated,
    retry: false,
  });

  // Manual MLB game processing
  const processMLBGamesMutation = useMutation({
    mutationFn: () => apiRequest('/api/mlb/games/process', 'POST'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "MLB games processed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process MLB games",
        variant: "destructive",
      });
    },
  });

  // Seed demo games mutation
  const seedDemoGamesMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/seed-demo-games', 'POST'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Demo game data seeded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed demo game data",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor MLB game processing and discover sports deals from restaurant websites and social media.
        </p>
      </div>

      {/* MLB Game Processing Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            MLB Game Processing Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <span className="font-medium">Status:</span>
              {mlbStatusLoading ? (
                <span className="text-gray-500">Loading...</span>
              ) : mlbStatus ? (
                <Badge variant={mlbStatus.isRunning ? "default" : "destructive"}>
                  {mlbStatus.isProcessing ? "Processing..." : mlbStatus.isRunning ? "Active" : "Stopped"}
                </Badge>
              ) : (
                <Badge variant="secondary">Unknown</Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="font-medium">Last Check:</span>
              <span className="text-sm text-muted-foreground">
                {mlbStatus?.lastCheck ? new Date(mlbStatus.lastCheck).toLocaleTimeString() : "Never"}
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => processMLBGamesMutation.mutate()}
                disabled={processMLBGamesMutation.isPending || mlbStatus?.isProcessing}
                size="sm"
              >
                {processMLBGamesMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Process Games Now
              </Button>
              
              <Button
                onClick={() => seedDemoGamesMutation.mutate()}
                disabled={seedDemoGamesMutation.isPending}
                variant="outline"
                size="sm"
              >
                {seedDemoGamesMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Seed Demo Games
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>• Monitors MLB games every 5 minutes for completed games</p>
            <p>• Checks trigger conditions: home wins, 6+ runs scored, 7+ strikeouts</p>
            <p>• Automatically creates active deals when conditions are met</p>
            <p>• Use "Seed Demo Games" to populate analytics during off-season</p>
            <p>• <a href="/analytics" className="text-blue-600 hover:underline">View Game Analytics →</a></p>
          </div>
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Deal Discovery & Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={() => discoverDeals()}
              disabled={discovering}
              variant="outline"
            >
              {discovering ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Discover New Deals
            </Button>
            
            <Button 
              onClick={() => loadDeals()}
              disabled={loadingDeals}
              variant="outline"
            >
              {loadingDeals ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Refresh Deal List
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {existingDeals && `${existingDeals.count} total deals`}
            {discoveredDeals && ` • ${discoveredDeals.count} newly discovered`}
          </div>
        </CardContent>
      </Card>

      {/* Discovered Deals */}
      {allDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Discovered Deals - Review & Approve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allDeals.map((deal, index) => (
                <div 
                  key={deal.id} 
                  className={`border rounded-lg p-4 transition-all ${
                    deal.status === 'approved' 
                      ? 'border-green-500 bg-green-50' 
                      : deal.status === 'rejected'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={deal.confidence > 0.7 ? "default" : "secondary"}>
                        {Math.round(deal.confidence * 100)}% match
                      </Badge>
                      <div className="flex gap-1">
                        <Badge variant={deal.status === 'approved' ? 'default' : deal.status === 'rejected' ? 'destructive' : 'outline'}>
                          {deal.status}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(deal.sourceUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="bg-gray-100 rounded-lg p-3 min-h-[100px]">
                      <p className="text-sm font-medium mb-2">{deal.dealText}</p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p><strong>Restaurant:</strong> {deal.restaurantName}</p>
                        <p><strong>Team:</strong> {deal.teamName}</p>
                        {deal.triggerCondition && (
                          <p><strong>Trigger:</strong> {deal.triggerCondition}</p>
                        )}
                        {deal.promoCode && (
                          <p><strong>Code:</strong> {deal.promoCode}</p>
                        )}
                      </div>
                    </div>

                    {deal.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => approveDealMutation.mutate({ dealId: deal.id })}
                          disabled={approveDealMutation.isPending}
                          className="flex-1"
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => rejectDealMutation.mutate(deal.id)}
                          disabled={rejectDealMutation.isPending}
                          className="flex-1"
                        >
                          Reject
                        </Button>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Source: {new URL(deal.sourceUrl).hostname} • {new Date(deal.discoveredAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {allDeals.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No deals discovered yet. Click "Discover New Deals" to scan restaurant websites and social media.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p className="font-medium mb-2">Seasonal Deal Discovery Process:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Scans for yearly promotional cycles that rotate by sports season</li>
              <li>Baseball deals (March-October), Basketball (October-April), Football (September-February)</li>
              <li>Extracts seasonal deal text, promo codes, and trigger conditions</li>
              <li>Most deals are recurring yearly promotions with predictable patterns</li>
              <li>Quick review process since deal formats are generally consistent</li>
              <li>Upload appropriate graphics for approved seasonal promotions</li>
              <li>Deals automatically activate/deactivate based on sports calendar</li>
            </ol>
          </div>
          
          <div className="text-sm">
            <p className="font-medium mb-2">Supported Sources:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Restaurant official websites and deals pages</li>
              <li>Twitter/X promotional posts and announcements</li>
              <li>Instagram business accounts and stories</li>
              <li>Facebook page promotions and events</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}