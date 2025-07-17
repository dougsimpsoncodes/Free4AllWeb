import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ExternalLink, Clock } from "lucide-react";
import RestaurantLogo from "./RestaurantLogo";

interface DealCardProps {
  dealData: {
    deal: any;
    promotion: any;
    restaurant: any;
    team?: any;
    game?: any;
  };
}

export default function DealCard({ dealData }: DealCardProps) {
  const { deal, promotion, restaurant, team, game } = dealData;
  
  const isActive = deal?.isActive ?? false;
  const restaurantColor = restaurant?.primaryColor || '#3b82f6';

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow ${isActive ? 'border-2 border-success-green' : ''}`}>
      <div className="relative">
        <div 
          className="h-24 bg-gradient-to-r"
          style={{ 
            background: `linear-gradient(to right, ${restaurantColor}, ${adjustBrightness(restaurantColor, -20)})` 
          }}
        ></div>
        <div className="absolute top-4 left-4 bg-white rounded-lg p-2 shadow-sm">
          <RestaurantLogo 
            restaurantName={restaurant?.name} 
            className="h-6 w-6"
          />
        </div>
        <div className="absolute top-4 right-4">
          {isActive ? (
            <Badge className="bg-success-green text-white">
              <CheckCircle className="h-3 w-3 mr-1" />
              ACTIVE
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Not Active
            </Badge>
          )}
        </div>
      </div>
      
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{restaurant?.name}</h3>
        <div className="text-2xl font-bold mb-3" style={{ color: restaurantColor }}>
          {promotion?.offerValue}
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <div className="mr-2 text-gray-400">🏆</div>
            <span>Trigger: {promotion?.triggerCondition}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="mr-2 text-gray-400">📱</div>
            <span>Redeem: {promotion?.redemptionInstructions}</span>
          </div>
          {promotion?.promoCode && (
            <div className="flex items-center text-sm text-gray-600">
              <div className="mr-2 text-gray-400">🏷️</div>
              <span className="font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                {promotion.promoCode}
              </span>
            </div>
          )}
        </div>

        {isActive ? (
          <div className="bg-success-green text-white rounded-lg p-3 text-center">
            <div className="font-semibold flex items-center justify-center">
              <ExternalLink className="h-4 w-4 mr-2" />
              Claim Your Deal Now
            </div>
            {deal?.expiresAt && (
              <div className="text-xs mt-1 opacity-90">
                <Clock className="h-3 w-3 inline mr-1" />
                Expires: {new Date(deal.expiresAt).toLocaleDateString()}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-sm text-red-700 flex items-center">
              <XCircle className="h-4 w-4 mr-2" />
              Game requirement not met
            </div>
            {game && (
              <div className="text-xs text-red-600 mt-1">
                Last game: {game.opponent} ({game.teamScore}-{game.opponentScore})
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function adjustBrightness(color: string, amount: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * amount);
  const R = (num >> 16) + amt;
  const B = (num >> 8 & 0x00FF) + amt;
  const G = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
}


