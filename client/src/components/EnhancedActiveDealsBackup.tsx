// BACKUP VERSION - Original lahomewin.com inspired table design
// This is the backup of the table-based design in case we need to revert

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, Clock, MapPin, Smartphone, Globe, Store, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RestaurantLogo from "./RestaurantLogo";

interface DealStatus {
  id: number;
  restaurant: string;
  restaurantLogo: string;
  team: string;
  sport: string;
  triggerConditions: string[];
  conditionsMet: boolean[];
  redemptionMethod: string;
  promoCode?: string;
  isActive: boolean;
  expiresAt?: string;
  lastTriggeredGame?: string;
  instructions: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  websiteUrl?: string;
  participatingLocations: string;
}

export default function EnhancedActiveDealsBackup() {
  const { toast } = useToast();
  const [selectedDeal, setSelectedDeal] = useState<DealStatus | null>(null);

  // Simulate real deal data based on actual game results
  const dealStatuses: DealStatus[] = [
    {
      id: 1,
      restaurant: "Panda Express",
      restaurantLogo: "🐼",
      team: "Los Angeles Dodgers",
      sport: "MLB",
      triggerConditions: ["Home game", "Won game"],
      conditionsMet: [true, true],
      redemptionMethod: "Code: DODGERSWIN",
      promoCode: "DODGERSWIN",
      isActive: true,
      expiresAt: "2025-07-18T23:59:59Z",
      lastTriggeredGame: "Dodgers 8 - Giants 4",
      instructions: "Get a 2-Entrée Plate for $6 instead of $10.70 when the Dodgers win at home! Sign up for an account on their site or download the app. Offer is only valid online. Start an online order and select a participating location in California or Nevada. Enter 'DODGERSWIN' in the offer code during checkout.",
      websiteUrl: "https://www.pandaexpress.com/order",
      participatingLocations: "California and Nevada locations"
    },
    {
      id: 2,
      restaurant: "McDonald's",
      restaurantLogo: "🍟",
      team: "Los Angeles Dodgers", 
      sport: "MLB",
      triggerConditions: ["Scored 6+ runs"],
      conditionsMet: [true],
      redemptionMethod: "Mobile app purchase",
      isActive: true,
      expiresAt: "2025-07-18T23:59:59Z",
      lastTriggeredGame: "Dodgers 8 - Giants 4 (8 runs)",
      instructions: "Download the McDonald's mobile app on iOS or Android. Sign in and navigate to 'Rewards & Deals'. Look for the deal with the Dodgers logo in 'App exclusive deals'. Add to your mobile order with a minimum $2 purchase.",
      appStoreUrl: "https://apps.apple.com/us/app/mcdonalds/id922103212",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.mcdonalds.app",
      participatingLocations: "All Los Angeles area McDonald's"
    },
    {
      id: 3,
      restaurant: "ampm",
      restaurantLogo: "⛽",
      team: "Los Angeles Dodgers",
      sport: "MLB", 
      triggerConditions: ["Home game", "Stole a base"],
      conditionsMet: [true, false],
      redemptionMethod: "Mobile app notification",
      isActive: false,
      instructions: "Download the ampm app and enable location sharing and push notifications. When the Dodgers steal a base at home, you'll get a push notification for a free hot dog and 12 oz Slim Coca-Cola. Offer available to first 1,000 responders for 24 hours.",
      appStoreUrl: "https://apps.apple.com/us/app/ampm/id1234567890",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.ampm.app",
      participatingLocations: "Greater Los Angeles area"
    },
    {
      id: 4,
      restaurant: "Jack in the Box",
      restaurantLogo: "🍔",
      team: "Los Angeles Dodgers",
      sport: "MLB",
      triggerConditions: ["Struck out 7+ opponents"],
      conditionsMet: [false],
      redemptionMethod: "Code: GODODGERS25",
      promoCode: "GODODGERS25",
      isActive: false,
      instructions: "Free Jumbo Jack with purchase of large Coca-Cola (about $4 with tax). Activates the day after Dodgers strike out 7+ opponents. Use promo code 'GODODGERS25' through the app, website, or in-store.",
      websiteUrl: "https://www.jackinthebox.com",
      participatingLocations: "All Jack in the Box locations"
    }
  ];

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffInHours = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours <= 0) return "Expired";
    if (diffInHours < 6) return `${diffInHours}h remaining`;
    if (diffInHours < 24) return `${diffInHours}h remaining`;
    return `${Math.ceil(diffInHours / 24)}d remaining`;
  };

  const getStatusBadge = (deal: DealStatus) => {
    if (!deal.isActive) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Not Active</Badge>;
    }
    
    if (deal.expiresAt) {
      const hoursLeft = Math.ceil((new Date(deal.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60));
      if (hoursLeft < 6) {
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800">Expires Soon</Badge>;
      }
    }
    
    return <Badge variant="default" className="bg-green-100 text-green-800 font-semibold">ACTIVE</Badge>;
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: `Promo code "${code}" copied to clipboard`,
    });
  };

  const renderTriggerConditions = (deal: DealStatus) => {
    return (
      <div className="space-y-1">
        {deal.triggerConditions.map((condition, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className={deal.conditionsMet[index] ? "text-green-600" : "text-red-500"}>
              {deal.conditionsMet[index] ? "✅" : "❌"}
            </span>
            <span className={deal.conditionsMet[index] ? "text-green-800" : "text-gray-600"}>
              {condition}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const activeDealCount = dealStatuses.filter(deal => deal.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header with game context */}
      <div className="text-center space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Did the Dodgers win at home yesterday?</h1>
          <p className="text-lg text-muted-foreground">
            Yes! Dodgers beat Giants 8-4. <span className="font-semibold text-green-600">{activeDealCount} deals available today.</span>
          </p>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Next home game</h3>
          <div className="text-sm text-muted-foreground">
            <div>Friday, July 18, 2025 - 7:10 PM</div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <span>Milwaukee Brewers</span>
              <span>vs</span>
              <span className="font-semibold">Los Angeles Dodgers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deals table - Desktop */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Active Deals Status</span>
              <Badge variant="outline">{activeDealCount} Active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Trigger Conditions</TableHead>
                  <TableHead>Redeem Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealStatuses.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{deal.restaurantLogo}</span>
                        <div>
                          <div className="font-medium">{deal.restaurant}</div>
                          <div className="text-sm text-muted-foreground">
                            {deal.isActive && deal.expiresAt && getTimeRemaining(deal.expiresAt)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{deal.team}</div>
                        <div className="text-muted-foreground">{deal.sport}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderTriggerConditions(deal)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {deal.promoCode ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyPromoCode(deal.promoCode!)}
                            className="gap-2"
                          >
                            <Copy className="h-3 w-3" />
                            {deal.promoCode}
                          </Button>
                        ) : (
                          <span>{deal.redemptionMethod}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(deal)}
                    </TableCell>
                    <TableCell>
                      {deal.isActive ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              REDEEM NOW
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3">
                                <span className="text-2xl">{deal.restaurantLogo}</span>
                                How to redeem the {deal.restaurant} deal
                              </DialogTitle>
                              <DialogDescription>
                                Step-by-step redemption instructions
                              </DialogDescription>
                            </DialogHeader>
                            <RedemptionInstructions deal={deal} />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Deals cards - Mobile */}
      <div className="md:hidden space-y-4">
        {dealStatuses.map((deal) => (
          <Card key={deal.id} className={deal.isActive ? "border-green-200" : "border-gray-200"}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{deal.restaurantLogo}</span>
                  <div>
                    <div className="font-medium">{deal.restaurant}</div>
                    <div className="text-sm text-muted-foreground">{deal.team} • {deal.sport}</div>
                  </div>
                </div>
                {getStatusBadge(deal)}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium mb-1">Trigger Conditions:</div>
                  {renderTriggerConditions(deal)}
                </div>

                <div>
                  <div className="text-sm font-medium mb-1">Redeem:</div>
                  <div className="text-sm">
                    {deal.promoCode ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyPromoCode(deal.promoCode!)}
                        className="gap-2"
                      >
                        <Copy className="h-3 w-3" />
                        {deal.promoCode}
                      </Button>
                    ) : (
                      <span>{deal.redemptionMethod}</span>
                    )}
                  </div>
                </div>

                {deal.isActive && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        REDEEM NOW
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg mx-4">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                          <span className="text-2xl">{deal.restaurantLogo}</span>
                          {deal.restaurant} Deal
                        </DialogTitle>
                      </DialogHeader>
                      <RedemptionInstructions deal={deal} />
                    </DialogContent>
                  </Dialog>
                )}

                {deal.isActive && deal.expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <Clock className="h-4 w-4" />
                    <span>{getTimeRemaining(deal.expiresAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RedemptionInstructions({ deal }: { deal: DealStatus }) {
  const { toast } = useToast();

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: `Promo code "${code}" copied to clipboard`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
        <div className="font-medium text-green-800 dark:text-green-200 mb-2">
          Deal Details
        </div>
        <p className="text-sm text-green-700 dark:text-green-300">
          {deal.instructions}
        </p>
      </div>

      {deal.promoCode && (
        <div>
          <div className="font-medium mb-2">Promo Code</div>
          <Button
            variant="outline"
            onClick={() => copyPromoCode(deal.promoCode!)}
            className="gap-2 font-mono"
          >
            <Copy className="h-4 w-4" />
            {deal.promoCode}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="font-medium">Quick Links</div>
        <div className="grid grid-cols-1 gap-2">
          {deal.websiteUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={deal.websiteUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
                <Globe className="h-4 w-4" />
                Order Online
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          {deal.appStoreUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={deal.appStoreUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Download iOS App
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          {deal.playStoreUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={deal.playStoreUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Download Android App
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="font-medium mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Participating Locations
        </div>
        <p className="text-sm text-muted-foreground">
          {deal.participatingLocations}
        </p>
      </div>

      {deal.lastTriggeredGame && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-sm">
            <div className="font-medium">Triggered by:</div>
            <div className="text-muted-foreground">{deal.lastTriggeredGame}</div>
          </div>
        </div>
      )}
    </div>
  );
}