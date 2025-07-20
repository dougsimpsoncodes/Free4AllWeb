import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Utensils, Bell, Trophy, CheckCircle, Clock, MapPin } from "lucide-react";
import { Link } from "wouter";
import RestaurantLogo from "@/components/RestaurantLogo";
import FoodImage from "@/components/FoodImage";
import DemoModeToggle from "@/components/DemoModeToggle";
import AdminToggle from "@/components/AdminToggle";
import EnhancedActiveDeals from "@/components/EnhancedActiveDeals";

export default function Landing() {
  const [demoMode, setDemoMode] = useState(false);
  
  // Set document title
  useEffect(() => {
    document.title = "Free4All - Never Miss Another Deal";
  }, []);

  const handleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  // Active deals using authentic promotional materials
  const activeDealExamples = [
    {
      restaurant: "McDonald's",
      food: "mcnuggets",
      status: "ACTIVE NOW",
      timeLeft: "18 hours left"
    },
    {
      restaurant: "Panda Express", 
      food: "panda plate",
      status: "ACTIVE NOW",
      timeLeft: "22 hours left"
    },
    {
      restaurant: "Jack in the Box",
      food: "jumbo jack",
      status: "ACTIVE NOW",
      timeLeft: "14 hours left"
    }
  ];

  // Demo mode: Show authenticated experience
  if (demoMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <DemoModeToggle onToggle={setDemoMode} />
        <AdminToggle />
        
        {/* Header with demo user info */}
        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍔</span>
                <h1 className="text-xl font-bold">Free4All</h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Welcome, Demo User!
                </span>
                <Badge variant="outline">Demo Mode</Badge>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <EnhancedActiveDeals />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <DemoModeToggle onToggle={setDemoMode} />
      <AdminToggle />
      
      {/* Header */}
      <nav className="bg-gradient-to-r from-green-600 to-blue-600 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-12">
            <div className="flex items-center space-x-2">
              <Utensils className="text-white h-8 w-8" />
              <span className="text-2xl font-bold text-white">Free4All</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Food First */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 py-6 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-white mb-2">
              Never Miss Another Deal
            </h1>
            <p className="text-base text-gray-300 mb-4">
              Get instant alerts for food deals when teams win
            </p>
            <Link href="/signup">
              <Button 
                size="lg" 
                className="bg-white text-green-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-full"
              >
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Active Deals Showcase */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">🔥 Active Deals Right Now</h2>
          </div>

          {/* Clean promotional images - Mobile-first full-width design */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            {activeDealExamples.map((deal, index) => (
              <div key={index} className="w-full">
                {/* Promotional Image - Dynamically sized for optimal mobile readability */}
                <FoodImage 
                  foodItem={deal.food}
                  restaurantName={deal.restaurant}
                  className="w-full h-auto min-h-[280px] sm:min-h-[320px] md:h-64 object-contain bg-white rounded-lg shadow-xl hover:shadow-2xl transition-shadow duration-300 cursor-pointer border border-gray-900"
                  alt={`${deal.restaurant} promotional deal`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section Divider */}
      <div className="border-t border-gray-200"></div>

      {/* How It Works - Visual */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">How It Works</h2>
            <p className="text-lg text-gray-600">Three simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">1. Your Team Wins</h3>
              <p className="text-sm text-gray-600">
                Or other qualifying activities and you win, too!
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">2. Get Instant Alert</h3>
              <p className="text-sm text-gray-600">
                Immediate email with deal details and promo codes
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="h-5 w-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">3. Claim Your Deal</h3>
              <p className="text-sm text-gray-600">
                We make it easy to get your deal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Popular Restaurants */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Partner Restaurants</h2>
            <p className="text-lg text-gray-600">Get deals from your favorite spots</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="text-center p-6 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
              <div className="flex justify-center mb-4">
                <RestaurantLogo restaurantName="McDonald's" />
              </div>
              <h3 className="font-bold text-gray-900">McDonald's</h3>
            </div>
            <div className="text-center p-6 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
              <div className="flex justify-center mb-4">
                <RestaurantLogo restaurantName="Panda Express" />
              </div>
              <h3 className="font-bold text-gray-900">Panda Express</h3>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <div className="flex justify-center mb-4">
                <RestaurantLogo restaurantName="Del Taco" />
              </div>
              <h3 className="font-bold text-gray-900">Del Taco</h3>
            </div>
            <div className="text-center p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="flex justify-center mb-4">
                <RestaurantLogo restaurantName="ampm" />
              </div>
              <h3 className="font-bold text-gray-900">ampm</h3>
            </div>
            <div className="text-center p-6 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
              <div className="flex justify-center mb-4">
                <RestaurantLogo restaurantName="Jack in the Box" />
              </div>
              <h3 className="font-bold text-gray-900">Jack in the Box</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Section Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Join Thousands of Smart Fans</h2>
          <p className="text-lg text-blue-100 mb-6">
            Join thousands of fans who get deals when their teams win
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="bg-white text-green-600 hover:bg-gray-100 px-12 py-4 text-xl font-bold rounded-full"
          >
            Sign Up
          </Button>
          <p className="text-blue-100 mt-4 text-sm">
            Free to join • Instant alerts • No spam, just deals
          </p>
        </div>
      </div>
    </div>
  );
}