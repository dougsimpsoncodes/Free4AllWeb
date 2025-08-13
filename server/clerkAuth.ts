import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";

// Extend Express Request type to include Clerk auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId?: string | null;
        sessionId?: string | null;
        sessionClaims?: any;
        getToken?: (options?: any) => Promise<string | null>;
      };
    }
  }
}

// Validate Clerk environment variables
if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
  console.warn("Clerk credentials not found. Please set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY environment variables.");
  console.warn("Authentication will be disabled until credentials are provided.");
}

export function getSession() {
  // Simple session for CSRF tokens and other non-auth data
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  return session({
    secret: process.env.SESSION_SECRET || "dev-only-secret-never-use-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  // Security middleware
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : {
      directives: {
        defaultSrc: ["'self'", "https://clerk.com", "https://*.clerk.accounts.dev"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://clerk.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "https://img.clerk.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://clerk.com", "https://*.clerk.accounts.dev"],
        connectSrc: ["'self'", "https://clerk.com", "https://*.clerk.accounts.dev", "wss://*.clerk.accounts.dev"]
      }
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000,
    max: isDevelopment ? 1000 : 100,
    message: {
      error: isDevelopment ? 
        "Rate limit reached (dev mode: 1000 requests/minute)" : 
        "Too many requests from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: isDevelopment ? (req) => {
      const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('127.0.0.1');
      return isLocal;
    } : undefined,
  });
  app.use(limiter);
  
  // Admin route rate limiting
  const adminLimiter = rateLimit({
    windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000,
    max: isDevelopment ? 500 : 50,
    message: {
      error: isDevelopment ? 
        "Admin rate limit reached (dev mode: 500 requests/minute)" : 
        "Too many admin requests, please try again later."
    },
    skip: isDevelopment ? (req) => {
      const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('127.0.0.1');
      return isLocal;
    } : undefined,
  });
  app.use('/api/admin', adminLimiter);
  
  // Session for CSRF tokens
  app.use(getSession());
  
  // Add Clerk middleware
  app.use(clerkMiddleware());
  
  // Remove old Google OAuth routes that are no longer needed
  // Clerk handles authentication through its own hosted pages and SDK
  
  app.post("/api/auth/sign-out", async (req: Request, res: Response) => {
    // Clear any server-side session data
    req.session?.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
    });
    
    res.json({ success: true });
  });
  
  // Debug endpoint
  app.get("/api/debug/clerk", async (req: Request, res: Response) => {
    const auth = getAuth(req);
    console.log("=== CLERK DEBUG ===");
    console.log("Full auth object:", auth);
    console.log("Authorization header:", req.headers.authorization);
    console.log("All headers:", req.headers);
    console.log("==================");
    
    res.json({
      hasAuth: !!auth,
      userId: auth?.userId,
      sessionId: auth?.sessionId,
      headers: req.headers,
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    // Prevent caching of this endpoint
    res.set('Cache-Control', 'no-store');
    
    const auth = getAuth(req);
    console.log("=== AUTH USER ENDPOINT ===");
    console.log("Full auth object:", auth);
    console.log("Has auth:", !!auth);
    console.log("User ID:", auth?.userId);
    console.log("Session ID:", auth?.sessionId);
    console.log("Is authenticated:", auth?.isAuthenticated);
    console.log("Authorization header:", req.headers.authorization);
    console.log("Cookie header:", req.headers.cookie);
    console.log("========================");
    
    if (!auth?.userId) {
      console.log("No auth or userId, returning null user");
      return res.json({ user: null });
    }
    
    try {
      // Atomic user upsert - prevents race conditions and variable shadowing
      console.log("=== UPSERT USER LOGIC ===");
      console.log("Clerk userId:", auth.userId);
      
      // 1) Fetch Clerk user data first
      const clerkUserResponse = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        }
      });
      const clerkUserData = await clerkUserResponse.json();
      console.log("Clerk API response status:", clerkUserResponse.status);
      console.log("Clerk user data fetched:", !!clerkUserData);
      
      // 2) Atomic upsert - either get existing or create new
      const dbUser = await storage.upsertUser({
        id: auth.userId,
        email: clerkUserData.email_addresses?.[0]?.email_address || null,
        firstName: clerkUserData.first_name || null,
        lastName: clerkUserData.last_name || null,
        profileImageUrl: clerkUserData.profile_image_url || null,
      });
      
      console.log("DB user upserted successfully:", !!dbUser);
      console.log("User ID:", dbUser?.id);
      console.log("========================");
      
      res.json({ user: dbUser });
    } catch (error) {
      console.error("=== AUTH USER ERROR ===");
      console.error("Error details:", error);
      console.error("======================");
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });
  
  // Setup CSRF endpoint
  setupCSRFEndpoint(app);
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  // SECURITY: Removed dangerous development bypass
  // All environments must use proper authentication
  
  // Use Clerk's auth middleware
  const auth = getAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    // Get user from our database
    const user = await storage.getUser(auth.userId);
      if (!user) {
        // User authenticated with Clerk but not in our DB yet
        // This shouldn't happen if /api/auth/user is called first
        return res.status(401).json({ message: "User not found in database" });
      }
      
    req.user = user;
    next();
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Admin-only middleware
export const isAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  // SECURITY: Removed dangerous development bypass
  // All environments must use proper authentication and authorization
  
  // Use Clerk's auth middleware first
  const auth = getAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    // Get user from our database and check role
    const user = await storage.getUser(auth.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ 
          message: "Admin access required. Contact support if you need admin privileges." 
        });
      }
      
    req.user = user;
    next();
  } catch (error) {
    console.error('Error checking admin role:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// CSRF protection
import crypto from "crypto";

export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const csrfProtection: RequestHandler = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF in development for easier testing
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = (req.session as any)?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ 
      message: "Invalid CSRF token. Please refresh the page and try again." 
    });
  }
  
  next();
};

// Endpoint to get CSRF token
export const setupCSRFEndpoint = (app: Express) => {
  app.get('/api/csrf-token', (req: any, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCSRFToken();
    }
    res.json({ csrfToken: req.session.csrfToken });
  });
};