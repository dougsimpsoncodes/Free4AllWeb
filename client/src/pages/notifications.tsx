import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Bell, Check, Mail, MessageSquare, Settings, Target, Clock, X } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedRestaurants, setSelectedRestaurants] = useState<number[]>([]);
  const [alertTiming, setAlertTiming] = useState<string>("immediate");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // Fetch data
  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    retry: false,
  });

  const { data: restaurants = [] } = useQuery<any[]>({
    queryKey: ["/api/restaurants"],
    retry: false,
  });

  const { data: alertPreferences = [], isLoading: preferencesLoading } = useQuery<any[]>({
    queryKey: ["/api/alert-preferences"],
    retry: false,
  });

  const { data: alertHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/alert-history"],
    retry: false,
  });

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await apiRequest("POST", "/api/notifications/test", { type });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Notification Sent",
        description: "Check your email for the test notification",
      });
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
        description: "Failed to send test notification",
        variant: "destructive",
      });
    },
  });

  const currentPreferences = (alertPreferences as any[]).length > 0 ? (alertPreferences as any[])[0] : null;
  const recentAlerts = (alertHistory as any[]).slice(0, 10);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Notification Center
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your deal alerts and notification preferences
        </p>
      </div>

      <Tabs defaultValue="preferences" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preferences">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="test">
            <Target className="h-4 w-4 mr-2" />
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-6">
          {/* Notification Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Get instant email alerts when deals are triggered
                  </p>
                </div>
                <Switch
                  checked={emailEnabled}
                  onCheckedChange={setEmailEnabled}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">SMS Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Get text messages for urgent deals (Coming Soon)
                  </p>
                </div>
                <Switch
                  checked={smsEnabled}
                  onCheckedChange={setSmsEnabled}
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          {/* Timing Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timing Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Label>When would you like to receive alerts?</Label>
                <Select value={alertTiming} onValueChange={setAlertTiming}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Immediate (within 5 minutes)
                      </div>
                    </SelectItem>
                    <SelectItem value="morning">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Morning digest (8:00 AM)
                      </div>
                    </SelectItem>
                    <SelectItem value="both">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Both immediate and morning
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Current Subscriptions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                Current Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(alertPreferences as any[]).length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(alertPreferences as any[]).map((pref: any) => (
                      <div key={pref.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {(teams as any[]).find((t: any) => t.id === pref.teamId)?.name || 'Unknown Team'}
                          </Badge>
                          {pref.restaurantId && (
                            <Badge variant="outline">
                              {(restaurants as any[]).find((r: any) => r.id === pref.restaurantId)?.name || 'Unknown Restaurant'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {pref.emailAlerts && <Mail className="h-4 w-4 text-green-600" />}
                          {pref.smsAlerts && <MessageSquare className="h-4 w-4 text-blue-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      You're subscribed to {(alertPreferences as any[]).length} alert{(alertPreferences as any[]).length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No active subscriptions</p>
                  <Button onClick={() => window.location.href = '/'}>
                    Set Up Alerts
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {recentAlerts.map((alert: any) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          alert.status === 'sent' ? 'bg-green-100 text-green-600' :
                          alert.status === 'failed' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {alert.status === 'sent' ? <Check className="h-4 w-4" /> :
                           alert.status === 'failed' ? <X className="h-4 w-4" /> :
                           <Clock className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium">
                            {alert.alertType === 'email' ? 'Email' : 'SMS'} Alert
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(alert.sentAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        alert.status === 'sent' ? 'default' :
                        alert.status === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {alert.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No notification history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Test Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Test your notification settings to make sure everything is working correctly.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => testNotificationMutation.mutate('deal_alert')}
                  disabled={testNotificationMutation.isPending || !emailEnabled}
                  className="w-full"
                >
                  {testNotificationMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Test Deal Alert
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => testNotificationMutation.mutate('welcome')}
                  disabled={testNotificationMutation.isPending || !emailEnabled}
                  variant="outline"
                  className="w-full"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Test Welcome Email
                </Button>
              </div>
              
              {!emailEnabled && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Enable email notifications to test alerts
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}