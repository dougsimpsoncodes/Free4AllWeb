import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  RefreshCw, 
  Search, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Globe,
  Target,
  AlertCircle,
  Zap,
  BarChart3,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredSite {
  id: number;
  url: string;
  title: string;
  content: string;
  confidence: string;
  status: 'pending' | 'approved' | 'rejected';
  foundAt: string;
  restaurantDetected?: string;
  teamDetected?: string;
  triggerDetected?: string;
  promoCodeDetected?: string;
}

interface DiscoverySource {
  id: number;
  name: string;
  type: string;
  priority: number;
  isActive: boolean;
  rateLimit: number;
  successCount: number;
  errorCount: number;
}

interface SearchTerm {
  id: number;
  term: string;
  category: string;
  successRate: string;
  usageCount: number;
  isActive: boolean;
}

export default function DealDiscovery() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("sites");
  const [precisionMode, setPrecisionMode] = useState(false);

  // Query for discovered sites
  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ["/api/admin/discovery/sites", precisionMode ? "precision" : "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/discovery/sites?${precisionMode ? 'precision=true&' : ''}limit=50`);
      const data = await response.json();
      console.log('Sites data:', data); // Debug logging
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds for development
  });

  // Query for pending sites
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/admin/discovery/pending", precisionMode ? "precision" : "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/discovery/pending?${precisionMode ? 'precision=true&' : ''}limit=50`);
      const data = await response.json();
      console.log('Pending data:', data); // Debug logging
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds for development
  });

  // Query for discovery sources
  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{sources: DiscoverySource[]}>({
    queryKey: ["/api/admin/discovery/sources"],
  });

  // Query for search terms
  const { data: termsData, isLoading: termsLoading } = useQuery<{terms: SearchTerm[]}>({
    queryKey: ["/api/admin/discovery/terms"],
  });

  // Extract deal mutation
  const extractDealMutation = useMutation({
    mutationFn: async (siteId: number) => {
      const res = await apiRequest("POST", `/api/admin/discovery/extract-deal/${siteId}`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery/pending"] });
      toast({
        title: "Deal Extracted!",
        description: data.message || "Deal details extracted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction Failed",
        description: error.message || "Could not extract deal from this site",
        variant: "destructive",
      });
    },
  });

  // Test extraction mutation
  const testExtractionMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/admin/discovery/test-extract", { url });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Extraction Successful!",
        description: `Extracted: ${data.extractedDeal?.title || 'Deal data'}`,
      });
      console.log('Extracted deal:', data.extractedDeal);
    },
    onError: (error: Error) => {
      toast({
        title: "Test Extraction Failed",
        description: error.message || "Could not extract deal from this URL",
        variant: "destructive",
      });
    },
  });

  // Run discovery mutation
  const runDiscoveryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/discovery/run");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Discovery Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery/pending"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update site status mutation
  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/admin/discovery/sites/${id}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Site Updated",
        description: "Site status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery/pending"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sites = sitesData?.sites || [];
  const pendingSites = pendingData?.sites || [];
  const sources = sourcesData?.sources || [];
  const terms = termsData?.terms || [];

  // Additional frontend sorting by confidence (backup to server-side sorting)
  const sortedSites = [...sites].sort((a, b) => {
    const confidenceA = parseFloat(a.confidence) || 0;
    const confidenceB = parseFloat(b.confidence) || 0;
    return confidenceB - confidenceA;
  });
  
  const sortedPendingSites = [...pendingSites].sort((a, b) => {
    const confidenceA = parseFloat(a.confidence) || 0;
    const confidenceB = parseFloat(b.confidence) || 0;
    return confidenceB - confidenceA;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    const conf = parseFloat(confidence);
    if (conf >= 0.8) return 'text-green-600 dark:text-green-400 font-bold'; // Perfect Dodgers deals
    if (conf >= 0.6) return 'text-green-600 dark:text-green-400'; // Good sports deals
    if (conf >= 0.4) return 'text-yellow-600 dark:text-yellow-400'; // Moderate relevance
    return 'text-red-600 dark:text-red-400'; // Low relevance/generic deals
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Deal Discovery Engine</h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered LA Dodgers deal discovery with integrated X/Twitter search • Confidence scoring prioritizes sports relevance
          </p>
          {precisionMode && (
            <Badge className="mt-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <Target className="h-3 w-3 mr-1" />
              Precision Mode: Showing only authentic deals (95.9% false positives filtered)
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setPrecisionMode(!precisionMode)}
            variant={precisionMode ? "default" : "outline"}
            className={precisionMode ? "bg-green-600 hover:bg-green-700 text-white" : "border-green-600 text-green-600 hover:bg-green-50"}
          >
            <Target className="h-4 w-4 mr-2" />
            Precision Mode {precisionMode ? "ON" : "OFF"}
          </Button>
          
          <Button 
            onClick={() => runDiscoveryMutation.mutate()}
            disabled={runDiscoveryMutation.isPending}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
          >
            {runDiscoveryMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Run Discovery
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">
                  {precisionMode ? "Authentic Deals" : "Total Sites"}
                </p>
                <p className="text-2xl font-bold">{sites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Pending Review</p>
                <p className="text-2xl font-bold">{pendingSites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Sources</p>
                <p className="text-2xl font-bold">{sources.filter((s: DiscoverySource) => s.isActive).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Search Terms</p>
                <p className="text-2xl font-bold">{terms.filter((t: SearchTerm) => t.isActive).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sites">Discovered Sites</TabsTrigger>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="terms">Search Terms</TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Discovered Sites</CardTitle>
              <CardDescription>
                Sites found through external API searches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {sitesLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading sites...</span>
                    </div>
                  ) : sortedSites.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                      No sites discovered yet. Run discovery to start finding deals!
                    </div>
                  ) : (
                    sortedSites.map((site) => (
                      <Card key={site.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center space-x-2 mb-2 flex-wrap">
                                <h3 className="font-semibold text-sm">{site.title}</h3>
                                <Badge className={getStatusColor(site.status)}>
                                  {site.status}
                                </Badge>
                                <span className={`text-sm font-bold ${getConfidenceColor(site.confidence)}`}>
                                  {Math.round(parseFloat(site.confidence) * 100)}%
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                {site.content}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500 flex-wrap">
                                <span>Found: {new Date(site.foundAt).toLocaleDateString()}</span>
                                {site.restaurantDetected && (
                                  <Badge variant="outline" className="text-xs">
                                    🍽️ {site.restaurantDetected}
                                  </Badge>
                                )}
                                {site.teamDetected && (
                                  <Badge variant="outline" className="text-xs">
                                    ⚾ {site.teamDetected}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Action buttons - responsive layout */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(site.url, '_blank')}
                                className="w-full sm:w-auto"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Source
                              </Button>
                              {site.status === 'pending' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateSiteMutation.mutate({ id: site.id, status: 'approved' })}
                                    disabled={updateSiteMutation.isPending}
                                    className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400 w-full sm:w-auto"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateSiteMutation.mutate({ id: site.id, status: 'rejected' })}
                                    disabled={updateSiteMutation.isPending}
                                    className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 w-full sm:w-auto"
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setLocation(`/admin/deal-template?siteId=${site.id}&title=${encodeURIComponent(site.title)}&restaurant=${encodeURIComponent(site.restaurantDetected || '')}`)}
                                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                                  >
                                    ✨ Create Deal Page
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Review</CardTitle>
              <CardDescription>
                High-confidence sites waiting for admin approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {pendingLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading pending sites...</span>
                    </div>
                  ) : pendingSites.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                      No sites pending review.
                    </div>
                  ) : (
                    sortedPendingSites.map((site) => (
                      <Card key={site.id} className="border-l-4 border-l-yellow-500">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center space-x-2 mb-2 flex-wrap">
                                <h3 className="font-semibold text-sm">{site.title}</h3>
                                <span className={`text-sm font-bold ${getConfidenceColor(site.confidence)}`}>
                                  {Math.round(parseFloat(site.confidence) * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {site.content}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2 flex-wrap">
                                <span>Found: {new Date(site.foundAt).toLocaleDateString()}</span>
                                {site.promoCodeDetected && (
                                  <Badge variant="outline" className="text-xs">
                                    🎯 Code: {site.promoCodeDetected}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-xs mb-3">
                                <span className="text-gray-600 dark:text-gray-400">Source:</span>
                                <a 
                                  href={site.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline truncate max-w-xs"
                                >
                                  {site.url}
                                </a>
                              </div>
                            </div>
                            
                            {/* Action buttons - stacked on mobile, inline on desktop */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(site.url, '_blank')}
                                className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 w-full sm:w-auto"
                                title="View original source to verify context and graphics"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Source
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateSiteMutation.mutate({ id: site.id, status: 'approved' })}
                                disabled={updateSiteMutation.isPending}
                                className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400 w-full sm:w-auto"
                                title="Approve this deal"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateSiteMutation.mutate({ id: site.id, status: 'rejected' })}
                                disabled={updateSiteMutation.isPending}
                                className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 w-full sm:w-auto"
                                title="Reject this deal"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => extractDealMutation.mutate(site.id)}
                                disabled={extractDealMutation.isPending}
                                className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400 w-full sm:w-auto"
                                title="Extract deal details automatically"
                              >
                                🔍 Extract Deal
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setLocation(`/admin/deal-template?siteId=${site.id}&title=${encodeURIComponent(site.title)}&restaurant=${encodeURIComponent(site.restaurantDetected || '')}`)}
                                className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                                title="Create a deal page from this discovery"
                              >
                                ✨ Create Deal Page
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discovery Sources</CardTitle>
              <CardDescription>
                External APIs and platforms we search for deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sourcesLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading sources...</span>
                  </div>
                ) : (
                  sources.map((source: DiscoverySource) => (
                    <Card key={source.id} className={`border-l-4 ${source.isActive ? 'border-l-green-500' : 'border-l-gray-400'}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold">{source.name}</h3>
                              <Badge variant={source.isActive ? "default" : "secondary"}>
                                {source.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline">
                                Priority: {source.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                              Type: {source.type} • Rate Limit: {source.rateLimit}/hour
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">
                              <span className="text-green-600">✓ {source.successCount}</span>
                              <span className="mx-2">•</span>
                              <span className="text-red-600">✗ {source.errorCount}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              Success rate: {source.successCount + source.errorCount > 0 
                                ? Math.round((source.successCount / (source.successCount + source.errorCount)) * 100)
                                : 0}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Terms</CardTitle>
              <CardDescription>
                Keywords and phrases used to find promotional content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {termsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading terms...</span>
                    </div>
                  ) : (
                    terms.map((term: SearchTerm) => (
                      <Card key={term.id} className={`border-l-4 ${term.isActive ? 'border-l-blue-500' : 'border-l-gray-400'}`}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-medium">"{term.term}"</span>
                                <Badge variant="outline" className="text-xs">
                                  {term.category}
                                </Badge>
                                <Badge variant={term.isActive ? "default" : "secondary"} className="text-xs">
                                  {term.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium text-green-600">
                                {Math.round(parseFloat(term.successRate) * 100)}% success
                              </div>
                              <div className="text-xs text-gray-500">
                                Used {term.usageCount} times
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}