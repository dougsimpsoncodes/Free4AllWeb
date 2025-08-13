# Claude Coding Principles for Free4AllWeb

## Core Philosophy: Lean & Direct

### 0. ALWAYS Check Existing Files First
- **BEFORE creating ANY file**: Use Glob/LS to check if similar files exist
- **BEFORE adding ANY functionality**: Search for existing implementations
- **BEFORE writing ANY code**: Read the relevant existing files
- For iOS/Xcode projects: ALWAYS check for Info.plist, xcconfig files, etc.
- For web projects: ALWAYS check package.json, existing routes, existing components

### 1. No Bloat
- **NEVER** add features not explicitly requested
- **NEVER** create "nice to have" additions
- **NEVER** over-engineer solutions
- If it works, don't add to it

### 2. Efficiency First
- Solve at the source, not with extra layers
- Inline fixes > separate processing steps  
- Modify existing code > create new files
- One-line fixes > complex refactors

### 3. Real Data Only
- No mock data, fake systems, or simulations
- No placeholder functionality  
- If it doesn't work, remove it

### 4. Minimal Implementation
- Simplest solution that works
- Reuse existing patterns and code
- Don't create abstractions for single use cases
- Don't add UI elements without explicit request

### 5. Direct Communication
- Show the fix, not the explanation
- Code first, description only if asked
- No speculation about "what might be nice"

## Examples:
❌ BAD: Creating new extraction service + UI button + admin workflow
✅ GOOD: Adding inline regex extraction at save point

❌ BAD: "Precision Mode" toggle that doesn't actually filter  
✅ GOOD: Removing unused UI elements

❌ BAD: Building fake agent system with mock responses
✅ GOOD: Using only real database queries

## Project-Specific Lessons

### Data Validation
- URL query parameters are ALWAYS strings - use `.transform(Number)` in Zod
- Test API endpoints with curl before assuming they work
- Check server logs when endpoints hang/timeout

### Discovery System
- Multi-team posts need Dodgers-only extraction
- Deal discovery runs once per season, not continuously
- Sources: Reddit, Twitter, team sites, restaurant sites (comprehensive sweep)

### Common Mistakes to Avoid
- Don't create duplicate files without checking for existing ones (Info.plist incident)
- Don't create mock data that pretends to be real (fake agents, MCP servers)
- Don't add UI toggles without backend implementation (Precision Mode)
- Don't assume complex when simple works (inline regex vs service class)
- Don't guess what's on the page - check the actual code

### Tech Stack Patterns
- Database: Supabase (PostgreSQL) with Drizzle ORM
- Auth: Clerk (not Passport/Google OAuth)  
- Frontend: React + Vite (not Next.js)
- Validation: Zod with proper string transforms
- Storage: discoveredSites → clustering → promotions flow

### Testing Approach
- Always restart dev server after route changes
- Check actual API responses, not assumed structure
- Verify UI shows real data, not hardcoded counts

### Existing Code Patterns (Don't Reinvent)
- API Routes: All in `server/routes.ts` - DON'T create separate route files
- Services: Located in `server/services/` - reuse existing patterns
- Database queries: Use `storage.ts` methods when they exist
- UI Components: Shadcn/ui already installed - don't add new component libraries
- React Query for data fetching - don't use useState/useEffect for API calls

### Database Schema Rules
- Tables already defined in `shared/schema.ts` - check before adding
- Use existing tables: teams, restaurants, promotions, discoveredSites, dealPages
- Relationships: promotions link to teams + restaurants
- Don't add columns - use JSONB fields for flexible data

### API Endpoint Patterns
- Admin routes: `/api/admin/*` with `isAdmin` middleware
- Public routes: `/api/*` without auth
- Consistent response: `{ success: boolean, data?: any, error?: string }`
- Zod validation on all inputs with proper transforms

### Common Anti-patterns in Codebase
- Multiple discovery engines doing similar things (dealDiscoveryEngine, socialMediaDiscovery, enhancedDealDiscovery)
- Unused imports and dead code
- Services that import other services creating circular dependencies
- HTML responses when expecting JSON (missing /api prefix)

### File Organization
- ONE routes.ts file (1400+ lines) - work within it
- Services are standalone - don't interconnect unnecessarily  
- Client pages in `client/src/pages/`
- Shared types in `shared/schema.ts`

### Environment Setup
- Port 5001 for dev server (not 3000, not 8000)
- Vite for frontend (not webpack, not Next.js)
- Environment vars in .env (not .env.local)
- Supabase connection string includes pooler

## Remember:
The user values **working code** over comprehensive features. Every line should have a purpose. If you can delete code instead of adding it, do that.