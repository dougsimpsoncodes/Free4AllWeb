import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Clock, MapPin, Star, Trophy, ExternalLink, Timer, Utensils } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import MultiSportStats from "./MultiSportStats";
import RestaurantLogo from "./RestaurantLogo";
import FoodImage from "./FoodImage";

interface ActiveDeal {
  id: number;
  title: string;
  description: string;
  restaurant: string;
  team: string;
  teamColor: string;
  teamAbbr: string;
  sport: string;
  gameResult: string;
  triggeredAt: string;
  expiresAt: string;
  location: string;
  isActive: boolean;
}

export default function ActiveDealsShowcase() {
  // Simulate active deals from our multi-sport testing
  const activeDeals: ActiveDeal[] = [
    {
      id: 1,
      title: "mcnuggets",
      restaurant: "McDonald's",
      team: "Los Angeles Dodgers",
      teamColor: "#1e40af",
      teamAbbr: "LAD",
      sport: "MLB",
      gameResult: "Dodgers 8 - Giants 4",
      triggeredAt: "2025-07-15T22:30:00Z",
      expiresAt: "2025-07-16T23:59:59Z",
      location: "All LA locations",
      isActive: true
    },
    {
      id: 2,
      title: "panda plate",
      restaurant: "Panda Express",
      team: "Los Angeles Dodgers", 
      teamColor: "#1e40af",
      teamAbbr: "LAD",
      sport: "MLB",
      gameResult: "Dodgers 8 - Giants 4",
      triggeredAt: "2025-07-15T22:30:00Z",
      expiresAt: "2025-07-16T23:59:59Z",
      location: "LA Metro area",
      isActive: true
    },
    {
      id: 3,
      title: "jumbo jack",
      restaurant: "Jack in the Box",
      team: "Los Angeles Dodgers",
      teamColor: "#1e40af",
      teamAbbr: "LAD",
      sport: "MLB",
      gameResult: "Dodgers 8 - Giants 4",
      triggeredAt: "2025-07-15T22:30:00Z",
      expiresAt: "2025-07-16T23:59:59Z",
      location: "Greater LA area",
      isActive: true
    },
    {
      id: 4,
      title: "hot dog",
      restaurant: "ampm",
      team: "Los Angeles Dodgers",
      teamColor: "#1e40af", 
      teamAbbr: "LAD",
      sport: "MLB",
      gameResult: "Dodgers 8 - Giants 4",
      triggeredAt: "2025-07-15T22:30:00Z",
      expiresAt: "2025-07-16T23:59:59Z",
      location: "Greater LA area",
      isActive: true
    }
  ];

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffInHours = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours <= 0) return "Expired";
    if (diffInHours < 24) return `${diffInHours}h remaining`;
    return formatDistanceToNow(expiry, { addSuffix: true });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">🔥 Active Deals Right Now!</h2>
        <p className="text-muted-foreground">
          Your teams just triggered these deals from their recent wins
        </p>
      </div>

      {/* Clean grid of promotional images - Mobile-optimized full-width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {activeDeals.map((deal) => (
          <div key={deal.id} className="w-full">
            {/* Promotional Image - Dynamic sizing for maximum mobile readability */}
            <FoodImage 
              foodItem={deal.title}
              restaurantName={deal.restaurant}
              className="w-full h-auto min-h-[240px] sm:min-h-[280px] md:min-h-[200px] lg:h-48 object-contain bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-gray-900"
              alt={`${deal.restaurant} promotional deal`}
            />
          </div>
        ))}
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-2 border-dashed border-blue-200 dark:border-blue-700">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Multi-Sport Deal Engine Active</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Monitoring <strong>MLB, NBA, and NFL games</strong> for instant deal triggers across LA teams
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Dodgers Active</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Lakers Active</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Rams Monitoring</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Sport Statistics Dashboard */}
      <div className="mt-8">
        <MultiSportStats />
      </div>
    </div>
  );
}