# Free4All - Sports-Triggered Food Deal Platform

## Overview

Free4All is a web-based platform that automatically notifies users when free or discounted food is available based on local sports team performance, specifically starting with the Los Angeles Dodgers. The application scrapes sports data and triggers email alerts when promotional conditions are met at partner restaurants.

## User Preferences

Preferred communication style: Simple, everyday language.
Landing page preference: "Never Miss Another Deal" as primary tagline/title - updated from "Never Miss Free Food Again" to reflect both free and discounted promotions.
Design preference: Green-to-blue gradient color scheme applied consistently across header and hero sections for cohesive branding.
Header preference: Centered logo without top CTA button for cleaner, more focused design.
Logo sizing: Reduced header height to h-12 (50% smaller). Free4All logo now 2xl text with 8x8 icon, hero title 2xl for better visual hierarchy.
Hero text sizing: Reduced subtitle from xl to lg to match the smaller header proportions.
Hero section sizing: Reduced padding by 50% (py-16 to py-8) and tightened internal spacing for more compact design.
Hero section background: Changed from green-to-blue gradient to dark gray gradient (gray-800 to gray-900) for better visual separation from header.
Button text: Changed from "Get Free Food Alerts"/"Start Getting Free Food" to simple "Sign Up" for cleaner messaging.
Language update: Changed all references from "free food" to "deals" throughout the landing page to accurately reflect both free and discounted promotions.
Mobile optimization: Reduced text sizes by 20% (4xl→3xl, xl→lg, lg→base) and changed "LA teams" to "your teams" for broader appeal and better mobile experience.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple

### Deployment Strategy
- **Platform**: Replit hosting environment
- **Development**: Hot module replacement with Vite
- **Production**: Bundled with esbuild for server, Vite for client
- **Database**: Hosted PostgreSQL on Neon

## Key Components

### Authentication System
- **Provider**: Replit's OAuth/OpenID Connect system
- **Session Storage**: PostgreSQL table with automatic expiration
- **User Management**: Full user profile storage with email, names, and profile images

### Database Schema
- **Core Entities**: Users, Teams, Restaurants, Promotions, Games, Triggered Deals
- **Alert System**: Alert preferences and history tracking
- **Sports Data**: League and team information storage
- **Promotion Rules**: Flexible trigger conditions (wins, runs scored, strikeouts, etc.)

### Services Layer
- **Promotion Service**: Processes game results and determines triggered deals
- **Email Service**: Handles alert notifications via SMTP/nodemailer
- **Sports API Service**: Integrates with external sports data providers (MLB API)
- **Deal Image Scraping Service**: Automatically discovers and processes promotional content
- **Storage Service**: Database abstraction layer for all CRUD operations

### UI Components
- **Design System**: shadcn/ui components with custom sports theming
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Component Library**: Reusable cards, forms, alerts, and navigation elements
- **Personalized Experience**: Dynamic home pages based on user engagement level

## Recent Changes

### July 17, 2025 - Comprehensive Admin Analytics Dashboard Complete
- **Advanced MLB Game Analytics System**: Built complete admin dashboard with real-time game data analysis
  - Recent games display with scores, home/away status, and win/loss records
  - Upcoming games schedule with venue information and game status
  - Team performance analytics: win-loss records, home vs away splits, runs per game averages
  - Recent form tracking (last 10 games) with visual W/L indicators
  - Deal trigger potential analysis showing promotion eligibility rates
  
- **Live Triggered Deals Monitoring**: Real-time tracking of activated promotions
  - Complete deal history with game context (opponent, score, trigger conditions)
  - Active/expired deal status with automatic expiration management
  - Restaurant and promotion details linked to specific game outcomes
  - Triggered deal analytics showing successful promotion activation patterns
  
- **Admin Game Data Management**: Powerful tools for game data manipulation and testing
  - Demo game data seeding system for off-season testing and development
  - Manual game processing triggers for immediate deal evaluation
  - Game processor status monitoring with real-time health checks
  - Complete game statistics tracking (runs, hits, strikeouts, stolen bases)
  
- **Production-Ready API Endpoints**: Secure admin-only data access with comprehensive analytics
  - `/api/admin/mlb/recent-games/:teamId` - Historical game results with statistics
  - `/api/admin/mlb/upcoming-games/:teamId` - Live schedule data from MLB API
  - `/api/admin/mlb/analytics/:teamId` - Team performance metrics and trend analysis
  - `/api/admin/mlb/triggered-deals` - Complete promotion activation history
  - All endpoints protected with authentication and error handling

### July 17, 2025 - Google OAuth Authentication Implementation
- **Secure Google OAuth Integration**: Successfully replaced Replit Auth with Google OAuth for public user access
  - Client credentials stored securely in Replit's encrypted environment variables
  - Proper redirect URI configuration for production domain
  - Minimal scope requests (profile, email) following security best practices
  - HTTPS-only authentication flows with proper error handling
  - Account selection prompt enabled for multi-account users
  
- **Important Configuration Notes**:
  - Test users are configured under the "Audience" tab in Google Cloud Console OAuth consent screen
  - OAuth consent screen must be set to "External" user type for public access
  - Redirect URI must exactly match: `https://[replit-domain]/api/auth/google/callback`
  - App must be in "Testing" mode during development with test users added
  - Successfully tested and working with authenticated user flow

## Recent Changes

### July 16, 2025 - Automatic Deal Image Discovery System
- **Comprehensive Deal Image Scraping Service**: Built intelligent system for automatically discovering promotional images
  - Web scraping using Puppeteer to scan restaurant websites and deals pages
  - Social media API integration (Twitter, Instagram, Facebook) for promotional content discovery
  - OCR text extraction using Tesseract.js to find promo codes and deal details
  - Image recognition algorithms to identify food items and promotional graphics
  
- **Intelligent Content Filtering and Ranking**: Advanced AI-driven content curation
  - Sports-relevance scoring system with confidence ratings (0-1 scale)
  - Team keyword detection across multiple name variations and abbreviations
  - Promotional language analysis (free, deal, offer, promo code detection)
  - Recency weighting and source credibility scoring
  
- **Admin Interface for Content Management**: Professional dashboard for deal oversight
  - Real-time discovery of promotional images from multiple sources
  - Visual content review with confidence scores and source attribution
  - Batch processing of selected promotional materials
  - Automatic image download, optimization, and local storage
  
- **Seasonal Deal Management**: Streamlined approach for yearly promotional cycles
  - Baseball deals (March-October), Basketball (October-April), Football (September-February)
  - Recurring yearly promotions with predictable patterns and formats
  - Quick review process since most deals are consistent year-over-year
  - Automatic activation/deactivation based on sports calendar seasons

### July 16, 2025 - Multi-Sport Expansion Complete
- **Comprehensive Multi-Sport API Integration**: Built unified sports data service supporting all major leagues
  - MLB API: Real-time game data with runs, hits, strikeouts tracking
  - NBA API: Live scores with point margins and performance stats  
  - NFL API: Game results with touchdown and scoring data
  - Unified interface for easy expansion to NHL, college sports, international leagues

- **Advanced Game Scraping System**: Deployed intelligent data collection across all sports
  - Automated scraping service that processes 15+ teams across MLB, NBA, NFL
  - Real-time promotion trigger analysis with sport-specific logic
  - Comprehensive error handling and API timeout management
  - Admin dashboard for testing scraping capabilities and viewing results

- **Multi-Sport Promotion Engine**: Enhanced trigger system with sport-specific conditions
  - MLB triggers: Home wins, runs scored (6+ for Big Mac), seasonal performance
  - NBA triggers: Point margins (20+ for tacos), total points scored (120+ for burgers)  
  - NFL triggers: Any wins, touchdowns, defensive performance
  - Flexible condition parsing supporting complex multi-sport scenarios

- **Validated Real-World Testing**: Confirmed authentic promotion triggers across all sports
  - Dodgers: 4 successful triggers (home wins + 6-run games)
  - Lakers: 3 successful triggers (20+ point margins + 120+ point games)
  - Rams: 1 successful trigger (any win condition)
  - Database shows active tracking of 10 teams with 5 active promotions

- **Production-Ready User Experience**: Clean, professional interface ready for deployment
  - Removed all demo mode code and testing toggles
  - Streamlined home page showcasing active multi-sport deals
  - Professional landing page with multi-sport coverage highlights
  - Clean authentication flow without development artifacts

## Data Flow

1. **Game Data Ingestion**: Sports API service fetches game results
2. **Promotion Processing**: Service evaluates game outcomes against promotion rules
3. **Deal Triggering**: Matching promotions create triggered deal records
4. **User Notification**: Email service sends alerts to subscribed users
5. **User Interaction**: Frontend displays active deals and subscription management

## External Dependencies

### Sports Data
- **MLB API**: Official MLB statistics and game results
- **Future APIs**: Planned expansion to NBA, NFL, college sports

### Email Service
- **SMTP Support**: Configurable email providers (Gmail, custom SMTP)
- **Template System**: HTML email templates for deal notifications

### Database Infrastructure
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Drizzle ORM**: Type-safe database queries and migrations

### UI Framework
- **Radix UI**: Headless components for accessibility
- **Tailwind CSS**: Utility-first styling framework
- **Lucide Icons**: Consistent iconography

## Deployment Strategy

### Development Environment
- **Replit Integration**: Native development environment support
- **Hot Reloading**: Vite development server with HMR
- **Database Migrations**: Automated schema updates via Drizzle

### Production Build
- **Client**: Vite builds optimized React bundle
- **Server**: esbuild creates single-file Node.js executable
- **Assets**: Static files served from dist/public directory

### Environment Configuration
- **Database**: CONNECTION_STRING via environment variables
- **Email**: SMTP credentials and configuration
- **Authentication**: Replit Auth integration tokens
- **Session**: Secure session secret management

The application follows a modular, service-oriented architecture that separates concerns between data ingestion, business logic, and user interface layers. This design supports the current focus on Dodgers promotions while providing a scalable foundation for multi-team and multi-sport expansion.