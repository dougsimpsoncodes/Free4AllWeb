import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Check, X, RefreshCw, Search, Edit, Plus, Trash2 } from "lucide-react";
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

interface TriggerCondition {
  id: string;
  stat: string;
  operator: string;
  value: number;
  gameLocation: 'home' | 'away' | 'any';
}

interface DealForm {
  restaurant: string;
  team: string;
  offerTitle: string;
  triggerType: 'game_outcome' | 'score_threshold' | 'player_performance' | 'combined';
  triggerConditions: TriggerCondition[];
  triggerLogic: 'AND' | 'OR';
  expirationDate: string;
  promoCode: string;
  description: string;
  redemptionInstructions: string;
  imageUrl: string;
  sourceUrl: string;
}

export default function SimpleDealReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [reviewingDeal, setReviewingDeal] = useState<DiscoveredDeal | null>(null);
  
  // Check URL for siteId parameter
  const urlParams = new URLSearchParams(window.location.search);
  const siteIdFromUrl = urlParams.get('siteId');
  const [dealForm, setDealForm] = useState<DealForm>({
    restaurant: "",
    team: "Los Angeles Dodgers",
    offerTitle: "",
    triggerType: 'score_threshold',
    triggerConditions: [{
      id: 'default',
      stat: 'runs_scored',
      operator: '>=',
      value: 1,
      gameLocation: 'home'
    }],
    triggerLogic: 'AND',
    expirationDate: "",
    promoCode: "",
    description: "",
    redemptionInstructions: "",
    imageUrl: "",
    sourceUrl: ""
  });

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

  // Auto-load specific deal from URL parameter
  useEffect(() => {
    if (siteIdFromUrl && discoveredDeals?.sites) {
      const dealToReview = discoveredDeals.sites.find(
        deal => deal.id === parseInt(siteIdFromUrl)
      );
      if (dealToReview) {
        setReviewingDeal(dealToReview);
        const extractedData = extractDealDetails(dealToReview);
        setDealForm(extractedData);
        // Clear the URL parameter to avoid re-triggering
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [siteIdFromUrl, discoveredDeals]);

  // Extract deal details from content and create structured triggers
  const extractDealDetails = (deal: DiscoveredDeal): DealForm => {
    const content = deal.content.toLowerCase();
    const title = deal.title.toLowerCase();
    const combined = `${title} ${content}`;

    // Extract restaurant
    const restaurants = ['mcdonalds', "mcdonald's", 'panda express', 'jack in the box', 'del taco', 'ampm', 'subway', 'taco bell'];
    const detectedRestaurant = restaurants.find(r => combined.includes(r)) || deal.restaurantDetected || "";

    // Extract offer
    let offerTitle = "";
    const freePatterns = [/free ([^.!?\n]+)/i, /get ([^.!?\n]*free[^.!?\n]*)/i];
    for (const pattern of freePatterns) {
      const match = combined.match(pattern);
      if (match) {
        offerTitle = match[1].trim();
        break;
      }
    }

    // Extract and structure trigger conditions
    const conditions: TriggerCondition[] = [];
    let triggerType: DealForm['triggerType'] = 'score_threshold';
    let gameLocation: TriggerCondition['gameLocation'] = 'any';

    // Detect game location
    if (combined.includes('home')) gameLocation = 'home';
    else if (combined.includes('away')) gameLocation = 'away';

    // Extract specific trigger patterns for all sports
    const triggerPatterns = [
      // Game outcomes
      { pattern: /win/i, stat: 'game_outcome', type: 'game_outcome' as const, value: 1 },
      { pattern: /lose/i, stat: 'game_outcome', type: 'game_outcome' as const, value: 0 },
      
      // Baseball/MLB
      { pattern: /(\d+)[\+\s]*runs?/i, stat: 'runs_scored', type: 'score_threshold' as const },
      { pattern: /(\d+)[\+\s]*strikeouts?/i, stat: 'strikeouts', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*home\s*runs?/i, stat: 'home_runs', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*hits?/i, stat: 'hits', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*rbis?/i, stat: 'rbis', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*doubles?/i, stat: 'doubles', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*triples?/i, stat: 'triples', type: 'player_performance' as const },
      
      // Football/NFL
      { pattern: /(\d+)[\+\s]*touchdowns?/i, stat: 'touchdowns', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*passing\s*yards?/i, stat: 'passing_yards', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*rushing\s*yards?/i, stat: 'rushing_yards', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*receiving\s*yards?/i, stat: 'receiving_yards', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*interceptions?/i, stat: 'interceptions', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*sacks?/i, stat: 'sacks', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*field\s*goals?/i, stat: 'field_goals', type: 'player_performance' as const },
      
      // Basketball/NBA
      { pattern: /(\d+)[\+\s]*points?/i, stat: 'points', type: 'score_threshold' as const },
      { pattern: /(\d+)[\+\s]*rebounds?/i, stat: 'rebounds', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*assists?/i, stat: 'assists', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*steals?/i, stat: 'steals', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*blocks?/i, stat: 'blocks', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*three[s]?\s*pointers?/i, stat: 'three_pointers', type: 'player_performance' as const },
      
      // Hockey/NHL
      { pattern: /(\d+)[\+\s]*goals?/i, stat: 'goals', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*saves?/i, stat: 'saves', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*shots?/i, stat: 'shots', type: 'player_performance' as const },
      
      // Soccer/MLS
      { pattern: /(\d+)[\+\s]*corners?/i, stat: 'corners', type: 'player_performance' as const },
      { pattern: /(\d+)[\+\s]*shots?\s*on\s*goal/i, stat: 'shots_on_goal', type: 'player_performance' as const },
      
      // General scoring
      { pattern: /score[s]?\s*(\d+)/i, stat: 'points_scored', type: 'score_threshold' as const },
      { pattern: /(\d+)[\+\s]*points?\s*scored/i, stat: 'points_scored', type: 'score_threshold' as const },
    ];

    for (const { pattern, stat, type, value } of triggerPatterns) {
      const match = combined.match(pattern);
      if (match) {
        const extractedValue = value !== undefined ? value : parseInt(match[1]);
        if (!isNaN(extractedValue)) {
          conditions.push({
            id: `${Date.now()}-${Math.random()}`,
            stat,
            operator: stat === 'game_outcome' ? '=' : '>=',
            value: extractedValue,
            gameLocation
          });
          triggerType = type;
        }
      }
    }

    // Default condition if none found
    if (conditions.length === 0) {
      conditions.push({
        id: `${Date.now()}-default`,
        stat: 'runs_scored',
        operator: '>=',
        value: 1,
        gameLocation: 'home'
      });
    }

    // Extract promo code
    const promoMatch = combined.match(/code[:\s]*([a-z0-9]+)/i);
    const promoCode = promoMatch?.[1] || deal.promoCodeDetected || "";

    return {
      restaurant: detectedRestaurant,
      team: "Los Angeles Dodgers",
      offerTitle: offerTitle || deal.title,
      triggerType,
      triggerConditions: conditions,
      triggerLogic: 'AND',
      expirationDate: "",
      promoCode,
      description: deal.content.substring(0, 200)
    };
  };

  // Start review process
  const startReview = (deal: DiscoveredDeal) => {
    setReviewingDeal(deal);
    setDealForm(extractDealDetails(deal));
  };

  // Cancel review
  const cancelReview = () => {
    setReviewingDeal(null);
    setDealForm({
      restaurant: "",
      team: "Los Angeles Dodgers", 
      offerTitle: "",
      triggerType: 'score_threshold',
      triggerConditions: [],
      triggerLogic: 'AND',
      expirationDate: "",
      promoCode: "",
      description: ""
    });
  };

  // Add new trigger condition
  const addTriggerCondition = () => {
    const newCondition: TriggerCondition = {
      id: `${Date.now()}-${Math.random()}`,
      stat: 'runs_scored',
      operator: '>=',
      value: 1,
      gameLocation: 'any'
    };
    setDealForm(prev => ({
      ...prev,
      triggerConditions: [...prev.triggerConditions, newCondition]
    }));
  };

  // Remove trigger condition
  const removeTriggerCondition = (id: string) => {
    setDealForm(prev => ({
      ...prev,
      triggerConditions: prev.triggerConditions.filter(c => c.id !== id)
    }));
  };

  // Update trigger condition
  const updateTriggerCondition = (id: string, updates: Partial<TriggerCondition>) => {
    setDealForm(prev => ({
      ...prev,
      triggerConditions: prev.triggerConditions.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    }));
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


  // Save manual deal mutation
  const saveManualDeal = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/deals/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealDetails: dealForm
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save manual deal');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Deal Created", 
        description: `${dealForm.offerTitle} saved successfully for ${data.details.restaurant}` 
      });
      setShowManualForm(false);
      // Reset form state
      setDealForm({
        restaurant: "",
        team: "Los Angeles Dodgers",
        offerTitle: "",
        triggerType: 'score_threshold',
        triggerConditions: [{
          id: 'default',
          stat: 'runs_scored',
          operator: '>=',
          value: 1,
          gameLocation: 'home'
        }],
        triggerLogic: 'AND',
        expirationDate: "",
        promoCode: "",
        description: "",
        redemptionInstructions: "",
        imageUrl: "",
        sourceUrl: ""
      });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Approve deal mutation with form data
  const approveDeal = useMutation({
    mutationFn: async () => {
      if (!reviewingDeal) throw new Error('No deal selected');
      
      const response = await fetch(`/api/admin/deals/${reviewingDeal.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealDetails: dealForm,
          sourceUrl: reviewingDeal.url
        })
      });
      if (!response.ok) throw new Error('Failed to approve deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['high-quality-deals'] });
      toast({ title: "Deal Approved", description: `${dealForm.offerTitle} is now live` });
      cancelReview();
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

  // Manual deal entry form
  if (showManualForm) {
    return (
      <div className="space-y-6">
        {/* Manual Entry Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Verified Deal</h1>
            <p className="text-gray-600">Enter deal details after verifying from source</p>
          </div>
          <Button variant="outline" onClick={() => setShowManualForm(false)}>
            Back to List
          </Button>
        </div>

        {/* Manual Deal Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>Deal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="restaurant">Restaurant *</Label>
                <Select value={dealForm.restaurant} onValueChange={(value) => 
                  setDealForm(prev => ({ ...prev, restaurant: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="McDonald's">McDonald's</SelectItem>
                    <SelectItem value="Panda Express">Panda Express</SelectItem>
                    <SelectItem value="Jack in the Box">Jack in the Box</SelectItem>
                    <SelectItem value="ampm">ampm</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="team">Team</Label>
                <Input
                  id="team"
                  value={dealForm.team}
                  onChange={(e) => setDealForm(prev => ({ ...prev, team: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="offerTitle">What's Free/Discounted? *</Label>
              <Input
                id="offerTitle"
                value={dealForm.offerTitle}
                onChange={(e) => setDealForm(prev => ({ ...prev, offerTitle: e.target.value }))}
                placeholder="e.g. Free Big Mac, 50% off pizza, Free coffee"
              />
            </div>

            {/* Simple Trigger Setup */}
            <div>
              <Label>When does this trigger? *</Label>
              {dealForm.triggerConditions.map((condition) => (
                <div key={condition.id} className="grid grid-cols-4 gap-3 mt-2 p-3 border rounded">
                  <Select value={condition.stat} onValueChange={(value) => 
                    updateTriggerCondition(condition.id, { stat: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Stat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="game_outcome">Win/Loss</SelectItem>
                      <SelectItem value="runs_scored">Runs Scored</SelectItem>
                      <SelectItem value="strikeouts">Strikeouts</SelectItem>
                      <SelectItem value="home_runs">Home Runs</SelectItem>
                      <SelectItem value="touchdowns">Touchdowns</SelectItem>
                      <SelectItem value="points_scored">Points Scored</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={condition.operator} onValueChange={(value) => 
                    updateTriggerCondition(condition.id, { operator: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">=">≥ (or more)</SelectItem>
                      <SelectItem value="=">= (exactly)</SelectItem>
                      <SelectItem value=">">＞ (more than)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Input
                    type="number"
                    value={condition.value}
                    onChange={(e) => updateTriggerCondition(condition.id, { value: parseInt(e.target.value) || 0 })}
                    placeholder="Value"
                    min="0"
                  />
                  
                  <Select value={condition.gameLocation} onValueChange={(value: TriggerCondition['gameLocation']) => 
                    updateTriggerCondition(condition.id, { gameLocation: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home Games</SelectItem>
                      <SelectItem value="away">Away Games</SelectItem>
                      <SelectItem value="any">Any Game</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="promoCode">Promo Code (if required)</Label>
                <Input
                  id="promoCode"
                  value={dealForm.promoCode}
                  onChange={(e) => setDealForm(prev => ({ ...prev, promoCode: e.target.value }))}
                  placeholder="e.g. DODGERS"
                />
              </div>
              <div>
                <Label htmlFor="expirationDate">Valid Until</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={dealForm.expirationDate}
                  onChange={(e) => setDealForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sourceUrl">Source URL *</Label>
              <Input
                id="sourceUrl"
                value={dealForm.sourceUrl}
                onChange={(e) => setDealForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                placeholder="Paste the URL where you found this deal"
              />
              <p className="text-xs text-gray-500 mt-1">Original source of the deal information</p>
            </div>

            <div>
              <Label htmlFor="redemptionInstructions">Redemption Instructions *</Label>
              <Textarea
                id="redemptionInstructions"
                value={dealForm.redemptionInstructions}
                onChange={(e) => setDealForm(prev => ({ ...prev, redemptionInstructions: e.target.value }))}
                placeholder="e.g. 'Use the McDonald's app and enter code in Deals section' or 'Show ticket at counter'"
                className="min-h-[80px]"
              />
              <p className="text-xs text-gray-500 mt-1">How customers can redeem this deal (app, in-store, etc.)</p>
            </div>

            <div>
              <Label htmlFor="imageUrl">Deal Image URL (optional)</Label>
              <Input
                id="imageUrl"
                value={dealForm.imageUrl}
                onChange={(e) => setDealForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://example.com/deal-image.jpg"
              />
              <p className="text-xs text-gray-500 mt-1">Paste a URL to an image for this deal</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => saveManualDeal.mutate()}
                disabled={saveManualDeal.isPending || !dealForm.restaurant || !dealForm.offerTitle || !dealForm.redemptionInstructions || !dealForm.sourceUrl}
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saveManualDeal.isPending ? "Saving..." : "Save Deal"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Management</h1>
          <p className="text-gray-600">
            {reviewableDeals.length} discovered deal sources available
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={runDiscovery} 
            disabled={isRunningDiscovery}
            variant="outline"
          >
            {isRunningDiscovery ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Find More Sources
          </Button>
          <Button 
            onClick={() => setShowManualForm(true)}
            size="lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Verified Deal
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Click links below to verify deals are real</li>
            <li>2. Copy the URL of any verified deal</li>
            <li>3. Click "Add Verified Deal" to create a structured deal entry</li>
            <li>4. Fill out the trigger conditions for automated validation</li>
          </ol>
        </CardContent>
      </Card>

      {/* No deals message */}
      {reviewableDeals.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No deal sources found</h3>
              <p>Click "Find More Sources" to discover potential deals</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discovered Sources List */}
      <div className="space-y-3">
        {reviewableDeals.map((deal) => (
          <Card key={deal.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">
                    {deal.title.length > 80 ? `${deal.title.substring(0, 80)}...` : deal.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {deal.content.substring(0, 150)}
                    {deal.content.length > 150 && '...'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {(parseFloat(deal.confidence) * 100).toFixed(0)}% confidence
                    </Badge>
                    {deal.restaurantDetected && (
                      <Badge variant="outline" className="text-xs">🍔 {deal.restaurantDetected}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(deal.url, '_blank')}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Check Deal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigator.clipboard.writeText(deal.url)}
                    className="text-xs"
                  >
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => rejectDeal.mutate(deal.id)}
                    disabled={rejectDeal.isPending}
                    className="text-red-600 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Hide
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}