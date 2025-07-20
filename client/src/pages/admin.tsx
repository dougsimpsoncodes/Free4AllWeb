import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
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
  // All hooks must be called at the top level, in the same order every time
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

  // Development mode - always calculated the same way
  const isDevelopment = import.meta.env.DEV || window.location.hostname.includes('replit');
  
  // All queries and mutations defined unconditionally
  const { data: existingDeals, isLoading: loadingDeals, refetch: loadDeals } = useQuery<{
    success: boolean;
    deals: DiscoveredDeal[];
    count: number;
  }>({
    queryKey: ['/api/admin/deals'],
    enabled: isDevelopment || isAuthenticated,
    retry: false,
  });

  const { data: discoveredDeals, isLoading: discovering, refetch: discoverDeals } = useQuery<{
    success: boolean;
    deals: DiscoveredDeal[];
    count: number;
  }>({
    queryKey: ['/api/admin/discover-deals'],
    enabled: false,
    retry: false,
  });

  const { data: mlbStatus, isLoading: mlbStatusLoading } = useQuery({
    queryKey: ['/api/mlb/games/status'],
    refetchInterval: 5000,
    enabled: isDevelopment || isAuthenticated,
    retry: false,
  });

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

  // All effects after all hooks
  useEffect(() => {
    if (!isDevelopment && !isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast, isDevelopment]);

  // Helper functions
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

  // Early returns only after all hooks
  if (!isDevelopment && isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isDevelopment && !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Deal Discovery Admin</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage promotional content and game processing
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => discoverDeals()}
              disabled={discovering}
              variant="outline"
              className="gap-2"
            >
              {discovering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {discovering ? 'Discovering...' : 'Discover New Deals'}
            </Button>
          </div>
        </div>

        {/* MLB Game Processor Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              MLB Game Processor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <Badge variant={mlbStatus?.isRunning ? "default" : "destructive"}>
                  {mlbStatusLoading ? 'Loading...' : mlbStatus?.isRunning ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Processing</p>
                <Badge variant={mlbStatus?.isProcessing ? "default" : "secondary"}>
                  {mlbStatus?.isProcessing ? 'Active' : 'Idle'}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Actions</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => processMLBGamesMutation.mutate()}
                    disabled={processMLBGamesMutation.isPending}
                  >
                    Process Games
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => seedDemoGamesMutation.mutate()}
                    disabled={seedDemoGamesMutation.isPending}
                  >
                    Seed Demo Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discovered Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Discovered Deals ({allDeals.length})</span>
              {selectedDeals.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      selectedDeals.forEach(dealId => {
                        approveDealMutation.mutate({ dealId });
                      });
                      setSelectedDeals(new Set());
                    }}
                    disabled={approveDealMutation.isPending}
                  >
                    Approve Selected ({selectedDeals.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      selectedDeals.forEach(dealId => {
                        rejectDealMutation.mutate(dealId);
                      });
                      setSelectedDeals(new Set());
                    }}
                    disabled={rejectDealMutation.isPending}
                  >
                    Reject Selected ({selectedDeals.size})
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDeals ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading deals...</p>
              </div>
            ) : allDeals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No deals discovered yet.</p>
                <p className="text-sm">Click "Discover New Deals" to find promotional content.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {allDeals.map((deal) => (
                  <div key={deal.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedDeals.has(deal.id)}
                            onChange={() => toggleDealSelection(deal.id)}
                            className="h-4 w-4"
                          />
                          <h3 className="font-semibold">{deal.restaurantName} - {deal.teamName}</h3>
                          <Badge variant={
                            deal.status === 'approved' ? 'default' :
                            deal.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {deal.status}
                          </Badge>
                          <Badge variant="outline">
                            {Math.round(deal.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">{deal.dealText}</p>
                        {deal.promoCode && (
                          <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded inline-block">
                            Promo: {deal.promoCode}
                          </p>
                        )}
                        {deal.triggerCondition && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Trigger: {deal.triggerCondition}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(deal.sourceUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {deal.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approveDealMutation.mutate({ dealId: deal.id })}
                              disabled={approveDealMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectDealMutation.mutate(deal.id)}
                              disabled={rejectDealMutation.isPending}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}