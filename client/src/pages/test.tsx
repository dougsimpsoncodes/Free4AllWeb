import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function Test() {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  useEffect(() => {
    console.log("Test component mounted");
    console.log("Auth state:", { user, isLoading, isAuthenticated });
    console.log("Environment:", {
      NODE_ENV: process.env.NODE_ENV,
      DEV: import.meta.env.DEV,
      hostname: window.location.hostname,
    });
  }, [user, isLoading, isAuthenticated]);
  
  console.log("Test component rendered successfully");
  
  return (
    <div style={{ 
      padding: "20px", 
      textAlign: "center", 
      fontSize: "24px", 
      fontFamily: "Arial, sans-serif",
      backgroundColor: "#f0f0f0",
      minHeight: "100vh"
    }}>
      <h1 style={{ color: "green" }}>🎉 Hello World 🎉</h1>
      <p>React Router is working!</p>
      <p>This is the test page at /test</p>
      
      <div style={{ marginTop: "20px", fontSize: "16px" }}>
        <p>If you can see this, then:</p>
        <ul style={{ textAlign: "left", display: "inline-block" }}>
          <li>✅ React is working</li>
          <li>✅ TypeScript compilation is working</li>
          <li>✅ Wouter routing is working</li>
          <li>✅ The build system is working</li>
          <li>✅ Query client is working</li>
        </ul>
      </div>

      <div style={{ 
        marginTop: "20px", 
        fontSize: "14px", 
        padding: "10px", 
        backgroundColor: "white", 
        border: "1px solid #ccc",
        textAlign: "left"
      }}>
        <h3>Debug Information:</h3>
        <p><strong>Environment:</strong></p>
        <ul>
          <li>NODE_ENV: {process.env.NODE_ENV}</li>
          <li>DEV: {String(import.meta.env.DEV)}</li>
          <li>Hostname: {window.location.hostname}</li>
        </ul>
        <p><strong>Auth State:</strong></p>
        <ul>
          <li>Loading: {String(isLoading)}</li>
          <li>Authenticated: {String(isAuthenticated)}</li>
          <li>User: {user ? JSON.stringify(user) : "null"}</li>
        </ul>
      </div>

      <div style={{ marginTop: "20px" }}>
        <a href="/" style={{ color: "blue", textDecoration: "underline" }}>
          ← Go back to home page
        </a>
      </div>
    </div>
  );
}