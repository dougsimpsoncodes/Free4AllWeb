import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import EnhancedActiveDeals from "@/components/EnhancedActiveDeals";
import AdminToggle from "@/components/AdminToggle";

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Development mode - skip authentication check
  const isDevelopment = import.meta.env.DEV || window.location.hostname.includes('replit');
  
  // Redirect to login if not authenticated (only in production)
  useEffect(() => {
    if (!isDevelopment && !isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast, isDevelopment]);

  if (!isDevelopment && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <AdminToggle />
      
      {/* Header with user info and logout */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍔</span>
              <h1 className="text-xl font-bold">Free4All</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {(user as any)?.firstName || 'Dev User'}!
              </span>
              <a
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Admin
              </a>
              <a
                href="/analytics"
                className="text-sm text-green-600 hover:text-green-800"
              >
                Analytics
              </a>
              <a
                href="/api/logout"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Logout
              </a>
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
