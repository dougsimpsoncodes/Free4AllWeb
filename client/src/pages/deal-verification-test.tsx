import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, PlayCircle, Database, TestTube, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DealVerificationTestPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [testCondition, setTestCondition] = useState("Home win + 6 runs");

  // Fetch deal pages
  const { data: dealPages, isLoading: dealPagesLoading } = useQuery({
    queryKey: ["/api/deal-verification/deal-pages"],
  });

  // Fetch recent games (Dodgers team ID: 119)
  const { data: recentGames, isLoading: gamesLoading } = useQuery({
    queryKey: ["/api/deal-verification/recent-games/119"],
  });

  // Fetch active triggered deals
  const { data: activeDeals, isLoading: activeDealsLoading } = useQuery({
    queryKey: ["/api/deal-verification/active-deals"],
  });

  // Test deal verification mutation
  const testVerificationMutation = useMutation({
    mutationFn: async ({ dealPageId, gameId }: { dealPageId: number; gameId: number }) => {
      const response = await fetch('/api/deal-verification/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealPageId, gameId })
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification Test Complete",
        description: data.test.isTriggered ? "Deal would be triggered!" : "Deal would not trigger",
        variant: data.test.isTriggered ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verify game mutation
  const verifyGameMutation = useMutation({
    mutationFn: async (gameId: number) => {
      const response = await fetch(`/api/deal-verification/verify-game/${gameId}`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Game Verification Complete",
        description: `Found ${data.triggeredDeals.length} triggered deals`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-verification/active-deals"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Parse condition mutation
  const parseConditionMutation = useMutation({
    mutationFn: async (condition: string) => {
      const response = await fetch('/api/deal-verification/parse-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition })
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Condition Parsed",
        description: data.explanation,
        variant: data.triggered ? "default" : "destructive",
      });
    },
  });

  const handleTestVerification = () => {
    if (!selectedDealId || !selectedGameId) {
      toast({
        title: "Selection Required",
        description: "Please select both a deal and a game to test",
        variant: "destructive",
      });
      return;
    }

    testVerificationMutation.mutate({
      dealPageId: parseInt(selectedDealId),
      gameId: parseInt(selectedGameId)
    });
  };

  const handleVerifyGame = (gameId: number) => {
    verifyGameMutation.mutate(gameId);
  };

  const handleParseCondition = () => {
    if (!testCondition.trim()) {
      toast({
        title: "Condition Required",
        description: "Please enter a condition to test",
        variant: "destructive",
      });
      return;
    }

    parseConditionMutation.mutate(testCondition);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Deal Verification Testing</h1>
        <p className="text-muted-foreground">
          Test and debug the deal verification system that checks if game results meet deal requirements.
        </p>
      </div>

      <Tabs defaultValue="test" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="test">Test Verification</TabsTrigger>
          <TabsTrigger value="games">Verify Games</TabsTrigger>
          <TabsTrigger value="active">Active Deals</TabsTrigger>
          <TabsTrigger value="conditions">Parse Conditions</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Deal Verification
              </CardTitle>
              <CardDescription>
                Select a deal and game to test if the deal would be triggered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deal-select">Select Deal Page</Label>
                  <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a deal to test" />
                    </SelectTrigger>
                    <SelectContent>
                      {dealPages?.dealPages?.map((deal: any) => (
                        <SelectItem key={deal.id} value={deal.id.toString()}>
                          {deal.restaurant}: {deal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game-select">Select Game</Label>
                  <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a game to test" />
                    </SelectTrigger>
                    <SelectContent>
                      {recentGames?.games?.map((game: any) => (
                        <SelectItem key={game.id} value={game.id.toString()}>
                          vs {game.opponent} ({game.teamScore}-{game.opponentScore}) {game.isHome ? "Home" : "Away"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleTestVerification}
                disabled={testVerificationMutation.isPending || !selectedDealId || !selectedGameId}
                className="w-full"
              >
                {testVerificationMutation.isPending ? "Testing..." : "Test Verification"}
              </Button>

              {selectedDealId && dealPages?.dealPages && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  {(() => {
                    const deal = dealPages.dealPages.find((d: any) => d.id.toString() === selectedDealId);
                    return deal ? (
                      <div>
                        <h4 className="font-semibold">{deal.restaurant}: {deal.title}</h4>
                        <p className="text-sm text-muted-foreground">Trigger: {deal.triggerCondition}</p>
                        <p className="text-sm">Value: {deal.dealValue}</p>
                        {deal.promoCode && <p className="text-sm">Code: <code>{deal.promoCode}</code></p>}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="games" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Verify Recent Games
              </CardTitle>
              <CardDescription>
                Run deal verification against completed games
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gamesLoading ? (
                <div>Loading games...</div>
              ) : (
                <div className="space-y-3">
                  {recentGames?.games?.map((game: any) => (
                    <div key={game.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          vs {game.opponent} - {game.teamScore}-{game.opponentScore}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(game.gameDate).toLocaleDateString()} • {game.isHome ? "Home" : "Away"}
                          {game.gameStats && (
                            <span className="ml-2">
                              {game.gameStats.runs}R, {game.gameStats.hits}H, {game.gameStats.pitchingStrikeOuts}K
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleVerifyGame(game.id)}
                        disabled={verifyGameMutation.isPending}
                        size="sm"
                      >
                        {verifyGameMutation.isPending ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Active Triggered Deals
              </CardTitle>
              <CardDescription>
                Currently active deals that have been triggered by game results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeDealsLoading ? (
                <div>Loading active deals...</div>
              ) : activeDeals?.activeDeals?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active deals found. Run game verification to trigger deals.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeDeals?.activeDeals?.map((item: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">
                            {item.dealPage?.restaurant || item.promotion?.title || "Unknown Deal"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {item.dealPage?.title || item.promotion?.description}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      
                      {item.game && (
                        <div className="text-sm text-muted-foreground">
                          Triggered by: vs {item.game.opponent} ({item.game.teamScore}-{item.game.opponentScore})
                          on {new Date(item.game.gameDate).toLocaleDateString()}
                        </div>
                      )}
                      
                      {item.deal.expiresAt && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Expires: {new Date(item.deal.expiresAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Parse Trigger Conditions
              </CardTitle>
              <CardDescription>
                Test how the system parses and evaluates deal trigger conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Trigger Condition</Label>
                <Textarea
                  id="condition"
                  value={testCondition}
                  onChange={(e) => setTestCondition(e.target.value)}
                  placeholder="Enter a trigger condition to test (e.g., 'Home win + 6 runs', '7+ strikeouts', 'Any win')"
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleParseCondition}
                disabled={parseConditionMutation.isPending}
                className="w-full"
              >
                {parseConditionMutation.isPending ? "Parsing..." : "Parse Condition"}
              </Button>

              <div className="space-y-2">
                <h4 className="font-semibold">Common Condition Examples:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Home win + 6 runs",
                    "Any win",
                    "7+ strikeouts", 
                    "Home win",
                    "5+ runs scored",
                    "Stolen base at home"
                  ].map((example) => (
                    <Button
                      key={example}
                      variant="outline"
                      size="sm"
                      onClick={() => setTestCondition(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}