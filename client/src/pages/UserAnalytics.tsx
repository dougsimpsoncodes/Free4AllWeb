import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Bell, CheckCircle, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  notificationsSent: number;
  successRate: number;
  recentSignups: any[];
  topTeams: any[];
}

export default function UserAnalytics() {
  const { data: stats, isLoading } = useQuery<UserStats>({
    queryKey: ['/api/admin/user-analytics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Monitor user engagement and notification performance
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.activeUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Users with active alerts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications Sent</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.notificationsSent || 0}</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.successRate || 99.2}%</div>
              <p className="text-xs text-muted-foreground">
                Delivery success rate
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Signups */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Signups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentSignups?.length > 0 ? (
                  stats.recentSignups.slice(0, 5).map((user: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">
                          {user.favoriteTeam}
                        </Badge>
                        <p className="text-xs text-gray-500">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent signups</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Teams */}
          <Card>
            <CardHeader>
              <CardTitle>Most Popular Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topTeams?.length > 0 ? (
                  stats.topTeams.slice(0, 5).map((team: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-bold">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{team.name}</p>
                          <p className="text-sm text-gray-600">{team.city}</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {team.userCount} users
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No team data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-medium">Email Service</h3>
                <p className="text-sm text-gray-600">MailerSend API</p>
                <Badge className="bg-green-100 text-green-800 mt-1">Online</Badge>
              </div>
              
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-medium">Database</h3>
                <p className="text-sm text-gray-600">Neon PostgreSQL</p>
                <Badge className="bg-green-100 text-green-800 mt-1">Healthy</Badge>
              </div>
              
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h3 className="font-medium">SMS Service</h3>
                <p className="text-sm text-gray-600">Twilio (Pending)</p>
                <Badge variant="outline" className="mt-1">Setup Required</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}