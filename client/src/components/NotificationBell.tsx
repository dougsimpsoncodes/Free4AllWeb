import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "wouter";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/notifications/unread"],
    retry: false,
  });

  const { data: recentAlerts = [] } = useQuery({
    queryKey: ["/api/alert-history"],
    retry: false,
  });

  const recentNotifications = recentAlerts.slice(0, 5);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Notifications</span>
              <Link href="/notifications">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotifications.length > 0 ? (
              <div className="space-y-3">
                {recentNotifications.map((notification: any) => (
                  <div key={notification.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
                    <div className={`p-1 rounded-full ${
                      notification.status === 'sent' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {notification.alertType === 'email' ? 'Email' : 'SMS'} Alert
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(notification.sentAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No notifications yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}