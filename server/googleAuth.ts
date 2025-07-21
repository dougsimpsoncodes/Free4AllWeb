import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("Google OAuth credentials not found. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.");
  console.warn("Authentication will be disabled until credentials are provided.");
}

export function getSession() {
  // Security: Require SESSION_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "dev-only-secret-never-use-in-production",
    store: sessionStore,
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
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"]
      }
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: "Too many requests from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
  
  // More strict rate limiting for admin routes
  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // stricter limit for admin endpoints
    message: {
      error: "Too many admin requests, please try again later."
    }
  });
  app.use('/api/admin', adminLimiter);
  
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Only set up Google OAuth if credentials are available
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Google OAuth Strategy
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Create or update user from Google profile
            const user = await storage.upsertUser({
              id: profile.id,
              email: profile.emails?.[0]?.value || null,
              firstName: profile.name?.givenName || null,
              lastName: profile.name?.familyName || null,
              profileImageUrl: profile.photos?.[0]?.value || null,
            });
            
            return done(null, user);
          } catch (error) {
            console.error("Error in Google OAuth callback:", error);
            return done(error, false);
          }
        }
      )
    );

    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await storage.getUser(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });

    // Auth routes
    app.get("/api/auth/google", 
      passport.authenticate("google", { 
        scope: ["profile", "email"],
        prompt: "select_account" // Force account selection
      })
    );

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (req, res) => {
        // Successful authentication
        res.redirect("/");
      }
    );
  } else {
    // Fallback routes when OAuth is not configured
    app.get("/api/auth/google", (req, res) => {
      res.status(500).json({ 
        error: "Google OAuth not configured", 
        message: "Please contact support to enable Google sign-in" 
      });
    });

    app.get("/api/auth/google/callback", (req, res) => {
      res.redirect("/?auth=error");
    });
  }

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/");
    });
  });
  
  // Setup CSRF token endpoint
  setupCSRFEndpoint(app);
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  // Development mode - bypass authentication
  const isDevelopment = process.env.NODE_ENV === 'development' || req.hostname.includes('replit');
  
  if (isDevelopment) {
    // Mock user for development
    req.user = {
      id: 'dev-user-1',
      email: 'dev@example.com',
      firstName: 'Dev',
      lastName: 'User',
      profileImageUrl: null,
      role: 'admin', // Give dev user admin access
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return next();
  }
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin-only middleware - checks both authentication AND admin role
export const isAdmin: RequestHandler = async (req, res, next) => {
  // Development mode - bypass authentication with admin role
  const isDevelopment = process.env.NODE_ENV === 'development' || req.hostname.includes('replit');
  
  if (isDevelopment) {
    // Mock admin user for development
    req.user = {
      id: 'dev-user-1',
      email: 'dev@example.com',
      firstName: 'Dev',
      lastName: 'User',
      profileImageUrl: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return next();
  }
  
  // Check authentication first
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Get fresh user data to check role
  try {
    const user = await storage.getUser((req.user as any).id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        message: "Admin access required. Contact support if you need admin privileges." 
      });
    }
    
    // Update req.user with fresh data including role
    req.user = user;
    return next();
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Simple CSRF protection middleware
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
  app.get('/api/csrf-token', isAuthenticated, (req: any, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCSRFToken();
    }
    res.json({ csrfToken: req.session.csrfToken });
  });
};