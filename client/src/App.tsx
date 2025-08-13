import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkAuthProvider, useClerkAuth } from "@/contexts/ClerkAuthContext";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import AdminDashboard from "@/pages/AdminDashboard";
import UserAnalytics from "@/pages/UserAnalytics";
// AgentDashboard removed - fake agent system eliminated
import DealMigration from "@/pages/DealMigration";
import DealDiscovery from "@/pages/DealDiscovery";
import GameAnalytics from "@/pages/GameAnalytics";
import DealTemplate from "@/pages/deal-template";
import DealPage from "@/pages/deal-page";
import NotificationsPage from "@/pages/notifications";
import GameSchedulingTest from "@/pages/GameSchedulingTest";
import DealVerificationTestPage from "@/pages/deal-verification-test";
import NotFound from "@/pages/not-found";
import Test from "@/pages/test";

function Router() {
  try {
    const { isAuthenticated, isLoading } = useClerkAuth();

    // Development mode - full access without authentication
    const isDevelopment = import.meta.env.DEV || window.location.hostname.includes('replit');

    if (isDevelopment) {
      return (
        <Switch>
          <Route path="/test" component={Test} />
          <Route path="/" component={Landing} />
          <Route path="/home" component={Home} />
          <Route path="/admin" component={Admin} />
          <Route path="/admin/analytics" component={UserAnalytics} />
          <Route path="/admin/migration" component={DealMigration} />
          {/* Agent dashboard removed - fake system eliminated */}
          <Route path="/deal-discovery" component={DealDiscovery} />
          <Route path="/analytics" component={GameAnalytics} />
          <Route path="/admin/deal-template" component={() => <DealTemplate />} />
          <Route path="/deal/:slug" component={DealPage} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/game-scheduling-test" component={GameSchedulingTest} />
          <Route path="/deal-verification-test" component={DealVerificationTestPage} />
          <Route component={NotFound} />
        </Switch>
      );
    }

    return (
      <Switch>
        {/* Production routes with authentication */}
        <Route path="/test" component={Test} />
        {isLoading || !isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
          </>
        ) : (
          <>
            <Route path="/" component={Home} />
            <Route path="/admin" component={Admin} />
            <Route path="/admin/analytics" component={UserAnalytics} />
            <Route path="/admin/migration" component={DealMigration} />
            {/* Agent dashboard removed - fake system eliminated */}
            <Route path="/deal-discovery" component={DealDiscovery} />
            <Route path="/analytics" component={GameAnalytics} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route path="/game-scheduling-test" component={GameSchedulingTest} />
            <Route path="/deal-verification-test" component={DealVerificationTestPage} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    );
  } catch (error) {
    console.error("Router error:", error);
    // Fallback to just the Landing component if there's an error
    return <Landing />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkAuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ClerkAuthProvider>
    </QueryClientProvider>
  );
}

export default App;