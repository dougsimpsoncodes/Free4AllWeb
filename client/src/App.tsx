import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import AdminDashboard from "@/pages/AdminDashboard";
import DealMigration from "@/pages/DealMigration";
import DealDiscovery from "@/pages/DealDiscovery";
import GameAnalytics from "@/pages/GameAnalytics";
import DealTemplate from "@/pages/deal-template";
import DealPage from "@/pages/deal-page";
import Signup from "@/pages/signup";
import NotificationsPage from "@/pages/notifications";
import GameSchedulingTest from "@/pages/GameSchedulingTest";
import DealVerificationTestPage from "@/pages/deal-verification-test";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Development mode - full access without authentication
  const isDevelopment = import.meta.env.DEV || window.location.hostname.includes('replit');

  if (isDevelopment) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/home" component={Home} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/migration" component={DealMigration} />
        <Route path="/deal-discovery" component={DealDiscovery} />
        <Route path="/analytics" component={GameAnalytics} />
        <Route path="/admin/deal-template" component={() => <DealTemplate />} />
        <Route path="/deal/:slug" component={DealPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/game-scheduling-test" component={GameSchedulingTest} />
        <Route path="/deal-verification-test" component={DealVerificationTestPage} />
        <Route path="/signup" component={Signup} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      {/* Production routes with authentication */}
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/signup" component={Signup} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/admin" component={Admin} />
          <Route path="/admin/migration" component={DealMigration} />
          <Route path="/deal-discovery" component={DealDiscovery} />
          <Route path="/analytics" component={GameAnalytics} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/game-scheduling-test" component={GameSchedulingTest} />
          <Route path="/deal-verification-test" component={DealVerificationTestPage} />
          <Route path="/signup" component={Signup} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;