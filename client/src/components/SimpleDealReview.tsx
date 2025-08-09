import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Check, X, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredDeal {
  id: number;
  url: string;
  title: string;
  content: string;
  confidence: string;
  status: string;
  foundAt: string;
  restaurantDetected?: string;
  teamDetected?: string;
  promoCodeDetected?: string;
}

export default function SimpleDealReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);

  // Fetch only high-quality deals (90%+ confidence)
  const { data: discoveredDeals, isLoading, refetch } = useQuery<{sites: DiscoveredDeal[]}>({
    queryKey: ['high-quality-deals'],
    queryFn: async () => {
      const response = await fetch('/api/admin/discovery/sites');
      if (!response.ok) throw new Error('Failed to fetch deals');
      return response.json();
    },
    refetchInterval: 30000
  });

  // Get only pending deals with 90%+ confidence
  const getReviewableDeals = () => {
    if (!discoveredDeals?.sites) return [];
    return discoveredDeals.sites
      .filter(deal => 
        deal.status === 'pending' && 
        parseFloat(deal.confidence) >= 0.9
      )
      .sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime());
  };

  // Run discovery
  const runDiscovery = async () => {
    setIsRunningDiscovery(true);
    try {
      const response = await fetch('/api/admin/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Discovery failed');
      
      const result = await response.json();
      
      toast({
        title: "Discovery Complete",
        description: `Found ${result.sitesCount || 0} new high-quality deals`,
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunningDiscovery(false);
    }
  };

  // Approve deal mutation
  const approveDeal = useMutation({
    mutationFn: async (dealId: number) => {
      const response = await fetch(`/api/admin/deals/${dealId}/approve`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to approve deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['high-quality-deals'] });
      toast({ title: "Deal Approved", description: "Deal is now live" });
    }
  });

  // Reject deal mutation  
  const rejectDeal = useMutation({
    mutationFn: async (dealId: number) => {
      const response = await fetch(`/api/admin/deals/${dealId}/reject`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to reject deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['high-quality-deals'] });
      toast({ title: "Deal Rejected", description: "Deal removed from queue" });
    }
  });

  const reviewableDeals = getReviewableDeals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Review</h1>
          <p className="text-gray-600">
            {reviewableDeals.length} high-quality deals ready for review
          </p>
        </div>
        <Button 
          onClick={runDiscovery} 
          disabled={isRunningDiscovery}
          size="lg"
        >
          {isRunningDiscovery ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Find More Deals
        </Button>
      </div>

      {/* No deals message */}
      {reviewableDeals.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No deals to review</h3>
              <p>Click "Find More Deals" to discover new high-quality deals</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deal list */}
      <div className="space-y-4">
        {reviewableDeals.map((deal) => (
          <Card key={deal.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{deal.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {(parseFloat(deal.confidence) * 100).toFixed(0)}% confidence
                    </Badge>
                    <a 
                      href={deal.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      View Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => approveDeal.mutate(deal.id)}
                    disabled={approveDeal.isPending}
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectDeal.mutate(deal.id)}
                    disabled={rejectDeal.isPending}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <p className="text-gray-700 text-sm leading-relaxed">
                {deal.content.substring(0, 300)}
                {deal.content.length > 300 && '...'}
              </p>
              
              {(deal.restaurantDetected || deal.teamDetected || deal.promoCodeDetected) && (
                <div className="flex gap-2 mt-3">
                  {deal.restaurantDetected && (
                    <Badge variant="outline">🍔 {deal.restaurantDetected}</Badge>
                  )}
                  {deal.teamDetected && (
                    <Badge variant="outline">⚾ {deal.teamDetected}</Badge>
                  )}
                  {deal.promoCodeDetected && (
                    <Badge variant="outline">🎫 {deal.promoCodeDetected}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}