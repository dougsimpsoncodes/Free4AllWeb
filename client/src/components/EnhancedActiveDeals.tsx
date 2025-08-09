import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Zap, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredDeal {
  id: number;
  url: string;
  title: string;
  content: string;
  confidence: string;
  status: string;
  foundAt: string;
  sourceId?: number;
  restaurantDetected?: string;
  teamDetected?: string;
  dealExtracted?: string;
  promoCodeDetected?: string;
}

export default function EnhancedActiveDeals() {
  const { toast } = useToast();
  const [filterConfidence, setFilterConfidence] = useState(0.3);

  // Fetch real discovered deals from the API
  const { data: discoveredDeals, isLoading, refetch, isRefetching } = useQuery<{sites: DiscoveredDeal[]}>({
    queryKey: ['discovered-deals'],
    queryFn: async () => {
      const response = await fetch('/api/admin/discovery/sites');
      if (!response.ok) throw new Error('Failed to fetch deals');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Filter deals based on confidence and relevance
  const getFilteredDeals = () => {
    if (!discoveredDeals?.sites) return [];
    
    return discoveredDeals.sites
      .filter(deal => {
        const confidence = parseFloat(deal.confidence);
        const content = (deal.title + ' ' + deal.content).toLowerCase();
        
        // Filter by confidence and food/deal related keywords
        const hasRelevantKeywords = 
          content.includes('free') || 
          content.includes('deal') || 
          content.includes('promo') || 
          content.includes('discount') || 
          content.includes('offer') ||
          content.includes('coupon') ||
          content.includes('save') ||
          content.includes('pizza') ||
          content.includes('burger') ||
          content.includes('food') ||
          content.includes('restaurant') ||
          content.includes('mcdonalds') || 
          content.includes('panda') || 
          content.includes('taco') ||
          content.includes('subway') ||
          content.includes('dodgers') ||
          content.includes('lakers') ||
          content.includes('win');
        
        return confidence >= filterConfidence && hasRelevantKeywords;
      })
      .sort((a, b) => parseFloat(b.confidence) - parseFloat(a.confidence))
      .slice(0, 20); // Show top 20 deals
  };

  const filteredDeals = getFilteredDeals();
  const totalDeals = discoveredDeals?.sites?.length || 0;

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.7) return "bg-green-100 text-green-800";
    if (confidence >= 0.5) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const dealDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - dealDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Yesterday";
    return `${diffInDays} days ago`;
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing deals...",
      description: "Fetching latest deals from discovery engine"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with real-time stats */}
      <div className="text-center space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Real-Time Deal Discovery</h1>
          <p className="text-lg text-muted-foreground">
            Live monitoring of {totalDeals} discovered deals • 
            <span className="font-semibold text-green-600"> {filteredDeals.length} relevant deals</span> • 
            Auto-refreshes every 30 seconds
          </p>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Discovery Engine Status</h3>
              <div className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                  Active - Monitoring Reddit, Social Media, News
                </span>
              </div>
            </div>
            <Button 
              onClick={handleRefresh}
              disabled={isRefetching}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Confidence Filter */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-sm font-medium">Min Confidence:</span>
          <div className="flex gap-2">
            {[0.2, 0.3, 0.4, 0.5, 0.6].map(threshold => (
              <Button
                key={threshold}
                size="sm"
                variant={filterConfidence === threshold ? "default" : "outline"}
                onClick={() => setFilterConfidence(threshold)}
              >
                {Math.round(threshold * 100)}%
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading real-time deals from discovery engine...</p>
          </CardContent>
        </Card>
      )}

      {/* No deals state */}
      {!isLoading && filteredDeals.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No deals found matching your criteria.
            </p>
            <Button 
              onClick={() => setFilterConfidence(0.2)}
              variant="outline"
            >
              Lower confidence threshold
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Real Discovered Deals */}
      {filteredDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span>Live Discovered Deals</span>
              <Badge variant="outline">{filteredDeals.length} of {totalDeals}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDeals.map((deal) => {
                const confidence = parseFloat(deal.confidence);
                return (
                  <Card 
                    key={deal.id} 
                    className={`border-l-4 ${
                      confidence >= 0.6 ? 'border-l-green-500' : 
                      confidence >= 0.4 ? 'border-l-yellow-500' : 
                      'border-l-gray-400'
                    } hover:shadow-lg transition-shadow`}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header with confidence */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm line-clamp-2 flex-1">
                            {deal.title}
                          </h4>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs whitespace-nowrap ${getConfidenceBadgeColor(confidence)}`}
                          >
                            {Math.round(confidence * 100)}%
                          </Badge>
                        </div>

                        {/* Content preview */}
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {deal.content}
                        </p>

                        {/* Extracted data if available */}
                        {(deal.restaurantDetected || deal.teamDetected || deal.promoCodeDetected) && (
                          <div className="flex flex-wrap gap-1">
                            {deal.restaurantDetected && (
                              <Badge variant="outline" className="text-xs">
                                {deal.restaurantDetected}
                              </Badge>
                            )}
                            {deal.teamDetected && (
                              <Badge variant="outline" className="text-xs">
                                {deal.teamDetected}
                              </Badge>
                            )}
                            {deal.promoCodeDetected && (
                              <Badge variant="default" className="text-xs">
                                Code: {deal.promoCodeDetected}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Footer with time and link */}
                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getTimeAgo(deal.foundAt)}
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => window.open(deal.url, '_blank')}
                            className="h-7 text-xs"
                          >
                            View Source <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time update indicator */}
      <div className="text-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
          Real-time data • Updates every 30 seconds • Last refresh: {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}