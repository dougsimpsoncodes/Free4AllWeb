import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, Clock, MapPin, Smartphone, Globe, CheckCircle, Zap, Star, Timer, Gift } from "lucide-react";
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
  appDeepLink?: string; // Deep link for mobile apps
  dealDescription: string;
  foodItem: string;
  dealValue: string;
  dealImage?: string;
}

export default function EnhancedActiveDeals() {
  const { toast } = useToast();
  const [selectedDeal, setSelectedDeal] = useState<DealStatus | null>(null);

  // Enhanced deal data with mobile app deep linking
  const dealStatuses: DealStatus[] = [
    {
      id: 1,
      restaurant: "Panda Express",
      restaurantLogo: "🐼",
      team: "Los Angeles Dodgers",
      sport: "MLB",
      triggerConditions: ["Home game", "Won game"],
      conditionsMet: [true, true],
      redemptionMethod: "Online Code",
      promoCode: "DODGERSWIN",
      isActive: true,
      expiresAt: "2025-07-18T23:59:59Z",
      lastTriggeredGame: "Dodgers 8 - Giants 4",
      instructions: "Get a 2-Entrée Plate for $6 instead of $10.70 when the Dodgers win at home! Sign up for an account on their site or download the app. Offer is only valid online. Start an online order and select a participating location in California or Nevada. Enter 'DODGERSWIN' in the offer code during checkout.",
      websiteUrl: "https://www.pandaexpress.com/order",
      participatingLocations: "California and Nevada locations",
      dealDescription: "2-Entrée Plate for $6.00",
      foodItem: "Panda Plate",
      dealValue: "FREE $4.70 value",
      dealImage: "/attached_assets/panda-express-promo_1752690233859.png"
    },
    {
      id: 2,
      restaurant: "McDonald's",
      restaurantLogo: "🍟",
      team: "Los Angeles Dodgers", 
      sport: "MLB",
      triggerConditions: ["Scored 6+ runs"],
      conditionsMet: [true],
      redemptionMethod: "Mobile App Only",
      isActive: true,
      expiresAt: "2025-07-18T23:59:59Z",
      lastTriggeredGame: "Dodgers 8 - Giants 4 (8 runs)",
      instructions: "Free 6 pc Chicken McNuggets with minimum $2 purchase. Download the McDonald's mobile app and navigate to 'Rewards & Deals'. Look for the deal with the Dodgers logo in 'App exclusive deals'. Add to your mobile order with a minimum $2 purchase.",
      appStoreUrl: "https://apps.apple.com/us/app/mcdonalds/id922103212",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.mcdonalds.app",
      appDeepLink: "mcdonalds://deals/dodgers-nuggets",
      participatingLocations: "All Los Angeles area McDonald's",
      dealDescription: "Free 6pc Chicken McNuggets",
      foodItem: "McNuggets",
      dealValue: "FREE $3.99 value",
      dealImage: "/attached_assets/mcdonalds-dodgers-deal_1752690222163.png"
    },
    {
      id: 3,
      restaurant: "ampm",
      restaurantLogo: "⛽",
      team: "Los Angeles Dodgers",
      sport: "MLB", 
      triggerConditions: ["Home game", "Stole a base"],
      conditionsMet: [true, false],
      redemptionMethod: "Push Notification",
      isActive: false,
      instructions: "Download the ampm app and enable location sharing and push notifications. When the Dodgers steal a base at home, you'll get a push notification for a free hot dog and 12 oz Slim Coca-Cola. Offer available to first 1,000 responders for 24 hours.",
      appStoreUrl: "https://apps.apple.com/us/app/ampm/id1234567890",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.ampm.app",
      appDeepLink: "ampm://notifications/enable",
      participatingLocations: "Greater Los Angeles area",
      dealDescription: "Free Hot Dog + 12oz Coke",
      foodItem: "Hot Dog Combo",
      dealValue: "FREE $4.99 value",
      dealImage: "/attached_assets/ampm-dodgers-promo_1752690208698.jpg"
    },
    {
      id: 4,
      restaurant: "Jack in the Box",
      restaurantLogo: "🍔",
      team: "Los Angeles Dodgers",
      sport: "MLB",
      triggerConditions: ["Struck out 7+ opponents"],
      conditionsMet: [false],
      redemptionMethod: "Multi-Platform",
      promoCode: "GODODGERS25",
      isActive: false,
      instructions: "Free Jumbo Jack with purchase of large Coca-Cola (about $4 with tax). Activates the day after Dodgers strike out 7+ opponents. Use promo code 'GODODGERS25' through the app, website, or in-store.",
      websiteUrl: "https://www.jackinthebox.com",
      appStoreUrl: "https://apps.apple.com/us/app/jack-in-the-box/id1234567891",
      appDeepLink: "jackinthebox://promo/GODODGERS25",
      participatingLocations: "All Jack in the Box locations",
      dealDescription: "Free Jumbo Jack with Large Coke Purchase",
      foodItem: "Jumbo Jack",
      dealValue: "FREE $5.49 value",
      dealImage: "/attached_assets/jackinthebox-dodgers-deal_1752690195103.png"
    }
  ];

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffInHours = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours <= 0) return "Expired";
    if (diffInHours < 6) return `${diffInHours}h left`;
    if (diffInHours < 24) return `${diffInHours}h left`;
    return `${Math.ceil(diffInHours / 24)}d left`;
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: `Promo code "${code}" copied to clipboard`,
    });
  };

  const openMobileApp = (deal: DealStatus) => {
    if (deal.appDeepLink) {
      window.location.href = deal.appDeepLink;
      setTimeout(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const storeUrl = isIOS ? deal.appStoreUrl : deal.playStoreUrl;
        if (storeUrl) {
          window.open(storeUrl, '_blank');
        }
      }, 2000);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const storeUrl = isIOS ? deal.appStoreUrl : deal.playStoreUrl;
      if (storeUrl) {
        window.open(storeUrl, '_blank');
      }
    }
  };

  const activeDealCount = dealStatuses.filter(deal => deal.isActive).length;

  const activeDeals = dealStatuses.filter(deal => deal.isActive);

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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {dealStatuses.map((deal) => (
          <Card key={deal.id} className={deal.isActive ? "border-green-200 bg-green-50 dark:bg-green-900/10" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{deal.restaurantLogo}</span>
                  <div>
                    <h3 className="font-semibold">{deal.restaurant}</h3>
                    <p className="text-sm text-muted-foreground">{deal.team}</p>
                  </div>
                </div>
                {getStatusBadge(deal)}
              </div>
              
              <div className="mb-3">
                {renderTriggerConditions(deal)}
              </div>
              
              <div className="flex items-center justify-between">
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
                    <span className="text-muted-foreground">{deal.redemptionMethod}</span>
                  )}
                </div>
                
                {deal.isActive && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        REDEEM NOW
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                          <span className="text-2xl">{deal.restaurantLogo}</span>
                          How to redeem the {deal.restaurant} deal
                        </DialogTitle>
                      </DialogHeader>
                      <RedemptionInstructions deal={deal} />
                    </DialogContent>
                  </Dialog>
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

  const openMobileApp = (deal: DealStatus) => {
    if (deal.appDeepLink) {
      window.location.href = deal.appDeepLink;
      setTimeout(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const storeUrl = isIOS ? deal.appStoreUrl : deal.playStoreUrl;
        if (storeUrl) {
          window.open(storeUrl, '_blank');
        }
      }, 2000);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const storeUrl = isIOS ? deal.appStoreUrl : deal.playStoreUrl;
      if (storeUrl) {
        window.open(storeUrl, '_blank');
      }
    }
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
        <div className="font-medium">Quick Actions</div>
        <div className="space-y-3">
          {deal.websiteUrl && (
            <Button variant="outline" size="lg" asChild className="w-full h-12">
              <a href={deal.websiteUrl} target="_blank" rel="noopener noreferrer" className="gap-3">
                <Globe className="h-5 w-5" />
                Order Online
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {(deal.appStoreUrl || deal.playStoreUrl) && (
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => openMobileApp(deal)}
              className="w-full h-12 gap-3"
            >
              <Smartphone className="h-5 w-5" />
              Download App
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