import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Check, X } from "lucide-react";

export default function AlertSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedRestaurants, setSelectedRestaurants] = useState<number[]>([]);
  const [alertTiming, setAlertTiming] = useState<string>("immediate");

  // Fetch data
  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    retry: false,
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ["/api/restaurants"],
    retry: false,
  });

  const { data: alertPreferences = [], isLoading: preferencesLoading } = useQuery({
    queryKey: ["/api/alert-preferences"],
    retry: false,
  });

  // Set initial values from existing preferences
  useState(() => {
    if (alertPreferences.length > 0) {
      const teamIds = [...new Set(alertPreferences.map((p: any) => p.teamId))];
      const restaurantIds = alertPreferences
        .filter((p: any) => p.restaurantId)
        .map((p: any) => p.restaurantId);
      const timing = alertPreferences[0]?.alertTiming || "immediate";
      
      setSelectedTeams(teamIds);
      setSelectedRestaurants(restaurantIds);
      setAlertTiming(timing);
    }
  }, [alertPreferences]);

  // Create alert preference mutation
  const createPreferenceMutation = useMutation({
    mutationFn: async (preferenceData: any) => {
      await apiRequest("POST", "/api/alert-preferences", preferenceData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Alert preferences saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alert-preferences"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save alert preferences",
        variant: "destructive",
      });
    },
  });

  // Delete alert preference mutation
  const deletePreferenceMutation = useMutation({
    mutationFn: async (preferenceId: number) => {
      await apiRequest("DELETE", `/api/alert-preferences/${preferenceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-preferences"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete alert preference",
        variant: "destructive",
      });
    },
  });

  const handleTeamToggle = (teamId: number, checked: boolean) => {
    if (checked) {
      setSelectedTeams(prev => [...prev, teamId]);
    } else {
      setSelectedTeams(prev => prev.filter(id => id !== teamId));
      // Remove existing preferences for this team
      const preferencesToDelete = alertPreferences.filter(
        (p: any) => p.teamId === teamId
      );
      preferencesToDelete.forEach((pref: any) => {
        deletePreferenceMutation.mutate(pref.id);
      });
    }
  };

  const handleRestaurantToggle = (restaurantId: number, checked: boolean) => {
    if (checked) {
      setSelectedRestaurants(prev => [...prev, restaurantId]);
    } else {
      setSelectedRestaurants(prev => prev.filter(id => id !== restaurantId));
    }
  };

  const handleSavePreferences = async () => {
    if (selectedTeams.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one team to follow",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clear existing preferences first
      const deletePromises = alertPreferences.map((pref: any) =>
        deletePreferenceMutation.mutateAsync(pref.id)
      );
      await Promise.all(deletePromises);

      // Create new preferences for each selected team
      const createPromises = selectedTeams.map(teamId => {
        if (selectedRestaurants.length > 0) {
          // Create preferences for each team-restaurant combination
          return Promise.all(
            selectedRestaurants.map(restaurantId =>
              createPreferenceMutation.mutateAsync({
                teamId,
                restaurantId,
                emailAlerts: true,
                smsAlerts: false,
                alertTiming,
                isActive: true,
              })
            )
          );
        } else {
          // Create preference for team only (all restaurants)
          return createPreferenceMutation.mutateAsync({
            teamId,
            restaurantId: null,
            emailAlerts: true,
            smsAlerts: false,
            alertTiming,
            isActive: true,
          });
        }
      });

      await Promise.all(createPromises);
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  const activeTeams = teams.filter((team: any) => team.isActive);
  const dodgers = activeTeams.find((team: any) => team.id === 1);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl text-white p-8 md:p-12">
      <div className="text-center mb-8">
        <Bell className="text-4xl mb-4 opacity-80 mx-auto h-16 w-16" />
        <h2 className="text-3xl font-bold mb-4">Never Miss a Deal Again</h2>
        <p className="text-xl text-blue-100 max-w-2xl mx-auto">
          Get instant email alerts within minutes of game completion when deals are triggered by your favorite teams.
        </p>
      </div>

      {/* Alert Subscription Form */}
      <div className="bg-white rounded-xl p-6 text-gray-900 max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold mb-4">Set Up Your Alert Preferences</h3>
        
        <div className="space-y-6">
          {/* Email Display */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Email Address</Label>
            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600">
              {user?.email || "Please log in to set up alerts"}
            </div>
          </div>

          {/* Team Selection */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Teams to Follow</Label>
            <div className="space-y-2">
              {dodgers && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={`team-${dodgers.id}`}
                    checked={selectedTeams.includes(dodgers.id)}
                    onCheckedChange={(checked) => handleTeamToggle(dodgers.id, checked as boolean)}
                  />
                  <Label htmlFor={`team-${dodgers.id}`} className="flex items-center cursor-pointer">
                    <div 
                      className="w-6 h-6 rounded text-white text-xs flex items-center justify-center mr-2"
                      style={{ backgroundColor: dodgers.primaryColor || '#1e40af' }}
                    >
                      {dodgers.abbreviation}
                    </div>
                    {dodgers.name} (MLB)
                  </Label>
                </div>
              )}
              
              {/* Coming Soon Teams */}
              <div className="flex items-center space-x-3 opacity-50">
                <Checkbox disabled />
                <Label className="flex items-center text-gray-500">
                  <div className="w-6 h-6 bg-red-600 rounded text-white text-xs flex items-center justify-center mr-2">
                    LAA
                  </div>
                  LA Angels (Coming Soon)
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 opacity-50">
                <Checkbox disabled />
                <Label className="flex items-center text-gray-500">
                  <div className="w-6 h-6 bg-purple-600 rounded text-white text-xs flex items-center justify-center mr-2">
                    LAL
                  </div>
                  LA Lakers (Coming Soon)
                </Label>
              </div>
            </div>
          </div>

          {/* Restaurant Preferences */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Restaurant Preferences (Optional)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {restaurants.slice(0, 4).map((restaurant: any) => (
                <div key={restaurant.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`restaurant-${restaurant.id}`}
                    checked={selectedRestaurants.includes(restaurant.id)}
                    onCheckedChange={(checked) => handleRestaurantToggle(restaurant.id, checked as boolean)}
                  />
                  <Label htmlFor={`restaurant-${restaurant.id}`} className="text-sm cursor-pointer">
                    {restaurant.name}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Leave unchecked to receive alerts for all restaurant deals
            </p>
          </div>

          {/* Alert Timing */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Alert Timing</Label>
            <Select value={alertTiming} onValueChange={setAlertTiming}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate (within 5 minutes of game end)</SelectItem>
                <SelectItem value="morning">Next morning digest (8:00 AM)</SelectItem>
                <SelectItem value="both">Both immediate and morning digest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            className="w-full bg-sports-blue text-white hover:bg-blue-700"
            onClick={handleSavePreferences}
            disabled={createPreferenceMutation.isPending || deletePreferenceMutation.isPending || preferencesLoading}
          >
            {createPreferenceMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                {alertPreferences.length > 0 ? 'Update Alert Preferences' : 'Start Getting Alerts'}
              </>
            )}
          </Button>

          {/* Current Subscriptions */}
          {alertPreferences.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-2">
                <Check className="h-4 w-4 inline mr-1" />
                Current Subscriptions:
              </div>
              <div className="flex flex-wrap gap-2">
                {[...new Set(alertPreferences.map((p: any) => p.teamId))].map((teamId: number) => {
                  const team = teams.find((t: any) => t.id === teamId);
                  return team ? (
                    <Badge key={teamId} variant="secondary" className="bg-blue-100 text-blue-800">
                      {team.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alert Preview */}
      <div className="mt-8 max-w-md mx-auto">
        <h4 className="text-center text-blue-100 mb-4">Preview Email Alert:</h4>
        <Card className="bg-white text-gray-900 text-sm">
          <CardContent className="p-4">
            <div className="border-b border-gray-200 pb-2 mb-3">
              <div className="font-semibold">🎉 Free Food Alert: Dodgers Won!</div>
              <div className="text-gray-600 text-xs">from alerts@free4all.com</div>
            </div>
            <div>
              <p className="mb-2">Great news! The Dodgers won 8-3 last night, which means you've got free food waiting:</p>
              <p className="font-medium text-sports-blue">• $6 Two-Item Plate at Panda Express</p>
              <p className="font-medium text-sports-blue">• Free 6pc McNuggets at McDonald's</p>
              <div className="text-center mt-3">
                <Badge className="bg-sports-blue text-white text-xs">View All Active Deals</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
