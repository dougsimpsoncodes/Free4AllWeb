import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Utensils, Bell, Trophy, CheckCircle, Star, Shield, Zap } from "lucide-react";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import AdminToggle from "@/components/AdminToggle";

export default function Landing() {
  const { user, isLoaded } = useUser();
  
  // Set document title
  useEffect(() => {
    document.title = "Free4All - Get Food Deals When Your Team Wins";
  }, []);

  // Don't render auth buttons until Clerk is fully loaded
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-white">
      <AdminToggle />
      
      {/* Header */}
      <nav className="bg-gradient-to-r from-green-600 to-blue-600 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Utensils className="text-white h-8 w-8" />
              <span className="text-2xl font-bold text-white">Free4All</span>
            </div>
            <SignedOut>
              {!user && (
                <SignInButton mode="modal">
                  <Button variant="secondary" size="sm">
                    Sign In
                  </Button>
                </SignInButton>
              )}
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-green-600 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              🎯 Smart Deal Discovery
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Your Team Wins.<br />You Eat Free.
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Get instant notifications for food deals when the Dodgers win, score big, or hit milestones. 
              Never miss another victory meal!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <SignedOut>
                {!user && (
                  <>
                    <SignUpButton mode="modal">
                      <Button 
                        size="lg" 
                        className="bg-white text-blue-600 hover:bg-gray-100 px-12 py-6 text-xl font-bold rounded-full shadow-xl"
                      >
                        Get Started Free
                      </Button>
                    </SignUpButton>
                    <p className="text-white/80 text-sm">
                      No credit card required
                    </p>
                  </>
                )}
              </SignedOut>
              <SignedIn>
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100 px-12 py-6 text-xl font-bold rounded-full shadow-xl"
                  onClick={() => window.location.href = '/dashboard'}
                >
                  Go to Dashboard
                </Button>
              </SignedIn>
            </div>
          </div>
        </div>
      </div>

      {/* Value Props */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Fans Love Free4All
            </h2>
            <p className="text-xl text-gray-600">
              The smartest way to celebrate your team's victories
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-green-500 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-3">Instant Alerts</h3>
                <p className="text-gray-600">
                  Get notified within seconds when deals activate. Beat the rush!
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-blue-500 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-3">Team-Triggered</h3>
                <p className="text-gray-600">
                  Deals activate based on real game events - wins, runs, strikeouts & more
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-purple-500 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold mb-3">Major Chains</h3>
                <p className="text-gray-600">
                  McDonald's, Panda Express, Jack in the Box, and more partners
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Three simple steps to victory meals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Choose Your Team</h3>
              <p className="text-gray-600">
                Select the Dodgers and any other LA teams you follow
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Team Achieves Trigger</h3>
              <p className="text-gray-600">
                Win games, score runs, hit milestones - deals activate automatically
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Get Your Food</h3>
              <p className="text-gray-600">
                Receive instant alert with promo codes and instructions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Example Deals */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Popular Victory Deals
            </h2>
            <p className="text-xl text-gray-600">
              Restaurants that celebrate with you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-red-500 to-yellow-500 p-6 text-white">
                <h3 className="text-2xl font-bold mb-2">McDonald's</h3>
                <p className="text-white/90">Free McNuggets</p>
              </div>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-3">Activates when:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Dodgers score 6+ runs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Via mobile app</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-6 text-white">
                <h3 className="text-2xl font-bold mb-2">Panda Express</h3>
                <p className="text-white/90">Discounted Plate</p>
              </div>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-3">Activates when:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Dodgers win at home</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Online ordering</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-6 text-white">
                <h3 className="text-2xl font-bold mb-2">Jack in the Box</h3>
                <p className="text-white/90">Free Jumbo Jack</p>
              </div>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-3">Activates when:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">7+ strikeouts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">With drink purchase</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Privacy First</h3>
              <p className="text-gray-600 text-sm">
                We never share your data or spam you
              </p>
            </div>
            <div>
              <Bell className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Smart Alerts</h3>
              <p className="text-gray-600 text-sm">
                Only get notified for deals you care about
              </p>
            </div>
            <div>
              <Star className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">100% Free</h3>
              <p className="text-gray-600 text-sm">
                No hidden fees, no premium tiers
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Win & Eat?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of fans who never miss a victory meal
          </p>
          <SignedOut>
            {!user && (
              <>
                <SignUpButton mode="modal">
                  <Button 
                    size="lg"
                    className="bg-white text-green-600 hover:bg-gray-100 px-12 py-6 text-2xl font-bold rounded-full shadow-xl"
                  >
                    Start Free Today
                  </Button>
                </SignUpButton>
                <p className="text-blue-100 mt-6 text-sm">
                  ✓ Instant setup &nbsp;&nbsp; ✓ No credit card &nbsp;&nbsp; ✓ Cancel anytime
                </p>
              </>
            )}
          </SignedOut>
          <SignedIn>
            <Button 
              size="lg"
              className="bg-white text-green-600 hover:bg-gray-100 px-12 py-6 text-2xl font-bold rounded-full shadow-xl"
              onClick={() => window.location.href = '/dashboard'}
            >
              View Your Deals
            </Button>
            <p className="text-blue-100 mt-6 text-sm">
              ✓ Personalized alerts &nbsp;&nbsp; ✓ Team preferences &nbsp;&nbsp; ✓ Deal history
            </p>
          </SignedIn>
        </div>
      </div>
    </div>
  );
}