import { createRoot } from "react-dom/client";

// Step 1: Basic React test
function BasicTest() {
  console.log("BasicTest component rendering");
  return <div>Basic React Component Works!</div>;
}

// Step 2: Add CSS import
import "./index.css";

function CSSTest() {
  console.log("CSSTest component rendering");
  return <div className="text-red-500 p-4">CSS and Tailwind Works!</div>;
}

// Step 3: Add react-query
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

function QueryTest() {
  console.log("QueryTest component rendering");
  return (
    <QueryClientProvider client={queryClient}>
      <div className="text-blue-500 p-4">React Query Works!</div>
    </QueryClientProvider>
  );
}

// Step 4: Add wouter routing
import { Switch, Route } from "wouter";

function RouterTest() {
  console.log("RouterTest component rendering");
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={() => <div className="text-green-500 p-4">Wouter Router Works!</div>} />
        <Route component={() => <div className="text-red-500 p-4">404 Not Found</div>} />
      </Switch>
    </QueryClientProvider>
  );
}

// Step 5: Add useAuth hook
import { useAuth } from "./hooks/useAuth";

function AuthTest() {
  console.log("AuthTest component rendering");
  const { isAuthenticated, isLoading } = useAuth();
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className="text-purple-500 p-4">
        useAuth Hook Works! Loading: {isLoading ? "true" : "false"}, 
        Authenticated: {isAuthenticated ? "true" : "false"}
      </div>
    </QueryClientProvider>
  );
}

// Step 6: Test with minimal UI components
import { Button } from "./components/ui/button";

function UITest() {
  console.log("UITest component rendering");
  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-4">
        <Button>UI Components Work!</Button>
      </div>
    </QueryClientProvider>
  );
}

// Choose which test to run by commenting/uncommenting:
const TestComponent = BasicTest; // Start with BasicTest and work your way up

console.log("About to create React root...");
const root = document.getElementById("root");
console.log("Root element:", root);

if (root) {
  console.log("Creating React root and rendering...");
  createRoot(root).render(<TestComponent />);
  console.log("React rendering completed!");
} else {
  console.error("Could not find root element!");
}