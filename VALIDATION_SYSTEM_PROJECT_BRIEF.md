# Free4AllWeb Validation System - Project Brief

## Project Overview

**Objective:** Build a world-class validation system that verifies when LA Dodgers games trigger restaurant promotions with auditable evidence and real-time accuracy.

**Current Status:** Database schema is ready, need to implement validation engine and evidence collection.

---

## Existing Architecture

### Database Schema (Ready)
```typescript
// From shared/schema.ts - Promotions table validation fields
validationStatus: varchar("validation_status", { length: 20 }).default("pending"), // pending, validated, failed
validationData: jsonb("validation_data").$type<{
  mlbVerified?: boolean;
  espnVerified?: boolean;
  lastChecked?: string;
  nextCheck?: string;
  evidence?: any;
}>(),

// Promotion trigger events table for evidence storage
export const promotionTriggerEvents = pgTable("promotion_trigger_events", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").notNull().references(() => promotions.id),
  externalEventId: varchar("external_event_id", { length: 100 }), // gameId from sports API
  occurredAt: timestamp("occurred_at").notNull(),
  redeemWindowStartAt: timestamp("redeem_window_start_at").notNull(),
  redeemWindowEndAt: timestamp("redeem_window_end_at").notNull(),
  evidence: jsonb("evidence").notNull(), // snapshot of game data, score, conditions met
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Trigger Conditions Structure (Ready)
```typescript
// From shared/schema.ts - Structured trigger conditions
triggerConditions: jsonb("trigger_conditions").$type<{
  type: "team_win" | "team_score" | "team_home_win";
  conditions: Array<{
    field: string;
    operator: "equals" | "gte" | "lte" | "in";
    value: string | number | string[];
  }>;
  logic: "AND" | "OR";
}>(),
```

### Sample Promotion Data (Existing)
```typescript
// Current promotion in database:
{
  id: 1,
  title: "Panda Express Free Orange Chicken - Dodgers 6+ Runs",
  triggerCondition: "When Dodgers score 6+ runs at home game",
  triggerConditions: {
    type: "team_score",
    conditions: [
      { field: "team_score", operator: "gte", value: 6 },
      { field: "is_home", operator: "equals", value: true }
    ],
    logic: "AND"
  },
  validationStatus: "pending",
  validationData: {}
}
```

---

## Technical Requirements

### Data Sources Available
1. **Primary:** ESPN API (free, reliable)
2. **Secondary:** MLB.com official API  
3. **Backup:** Sports data aggregators

### Validation Types Needed
1. **Real-time Game Monitoring** - Track games in progress
2. **Post-game Verification** - Confirm final scores
3. **Historical Validation** - Verify past triggers
4. **Multi-source Cross-verification** - ESPN + MLB consensus

### Evidence Requirements
- **Immutable snapshots** of game data at trigger moment
- **Source attribution** with timestamps
- **Cryptographic integrity** (SHA256 hashes)
- **API response caching** for audit trails
- **Conflict resolution** when sources disagree

---

## Current Codebase Integration Points

### 1. Storage Layer (server/storage.ts)
```typescript
// Existing methods that need validation integration:
async createPromotion(promotionData: InsertPromotion): Promise<Promotion>
async updatePromotionValidation(id: number, validationData: any): Promise<void>
async createPromotionTriggerEvent(eventData: InsertPromotionTriggerEvent): Promise<void>
```

### 2. API Layer (server/routes.ts)
```typescript
// Existing admin routes that need validation endpoints:
app.get('/api/admin/promotions', isAdmin, async (req, res) => {
  // Shows validation status in admin UI
});

// New endpoints needed:
// POST /api/admin/validate-promotion/:id - Manual validation trigger
// GET /api/admin/validation-logs/:id - View evidence trail
// POST /api/webhooks/game-update - Real-time game updates
```

### 3. Game Data Integration
```typescript
// From shared/schema.ts - Games table ready for integration
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id),
  opponent: varchar("opponent", { length: 100 }).notNull(),
  gameDate: timestamp("game_date").notNull(),
  isHome: boolean("is_home").default(true),
  teamScore: integer("team_score"),
  opponentScore: integer("opponent_score"),
  isComplete: boolean("is_complete").default(false),
  gameStats: jsonb("game_stats"),
  externalId: varchar("external_id", { length: 50 }),
});
```

---

## Proposed System Architecture

### 1. Validation Engine Core
```typescript
interface ValidationEngine {
  // Real-time monitoring
  startGameMonitoring(gameId: string): Promise<void>;
  stopGameMonitoring(gameId: string): Promise<void>;
  
  // Validation execution
  validatePromotion(promotionId: number, gameData: GameData): Promise<ValidationResult>;
  crossValidateWithSources(gameData: GameData): Promise<SourceConsensus>;
  
  // Evidence collection
  captureEvidence(gameData: GameData, triggerEvent: TriggerEvent): Promise<Evidence>;
  storeImmutableSnapshot(evidence: Evidence): Promise<string>; // Returns hash
}

interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1
  evidence: Evidence;
  sources: SourceVerification[];
  triggeredAt: Date;
}

interface Evidence {
  gameSnapshot: GameData;
  apiResponses: Array<{
    source: string;
    timestamp: Date;
    rawResponse: any;
    hash: string;
  }>;
  calculatedValues: {
    [field: string]: any;
  };
  integrity: {
    hash: string;
    signature?: string;
  };
}
```

### 2. Multi-Source Data Aggregation
```typescript
interface DataSource {
  name: string;
  priority: number;
  isReal: boolean;
  fetchGameData(gameId: string): Promise<GameData>;
  validateResponse(response: any): boolean;
}

// ESPN API Integration
class ESPNSource implements DataSource {
  async fetchGameData(gameId: string): Promise<GameData> {
    // Call ESPN API: http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard
  }
}

// MLB Official API Integration  
class MLBSource implements DataSource {
  async fetchGameData(gameId: string): Promise<GameData> {
    // Call MLB Stats API: https://statsapi.mlb.com/api/v1/games/{gameId}
  }
}
```

### 3. Real-time Monitoring System
```typescript
interface GameMonitor {
  activeGames: Map<string, GameSession>;
  
  startMonitoring(): void;
  checkActivePromotions(): Promise<Promotion[]>;
  monitorGame(gameId: string, promotions: Promotion[]): Promise<void>;
  handleTriggerEvent(promotion: Promotion, gameData: GameData): Promise<void>;
}

interface GameSession {
  gameId: string;
  promotions: Promotion[];
  lastCheck: Date;
  isActive: boolean;
  subscribers: WebSocket[]; // For real-time UI updates
}
```

---

## Implementation Plan

### Phase 1: Data Source Integration (Week 1)
```typescript
// Priority order implementation:
1. ESPN API integration (most reliable, free)
2. MLB official API integration (authoritative)
3. Response validation and error handling
4. Rate limiting and caching layer
5. Unit tests for all integrations
```

### Phase 2: Validation Engine (Week 1-2)
```typescript
// Core validation logic:
1. Condition evaluation engine
2. Evidence capture system
3. Multi-source consensus algorithm
4. Immutable storage with cryptographic integrity
5. Conflict resolution when sources disagree
```

### Phase 3: Real-time Monitoring (Week 2)
```typescript
// Live game tracking:
1. Game discovery and scheduling
2. Active promotion monitoring
3. WebSocket notifications for UI
4. Automatic trigger detection
5. Fail-safe mechanisms and error recovery
```

### Phase 4: Admin Interface (Week 2-3)
```typescript
// Management and oversight:
1. Validation dashboard
2. Evidence viewer
3. Manual override capabilities
4. Audit log interface
5. Performance monitoring
```

---

## Critical Success Factors

### 1. Data Accuracy (99.9% target)
- Multiple source verification
- Real-time cross-checking
- Historical data validation
- Manual override capabilities

### 2. Evidence Integrity
- Cryptographic hashing of all evidence
- Immutable storage of snapshots
- Complete audit trails
- Tamper detection

### 3. Performance Requirements
- < 5 second validation response time
- Real-time game monitoring (30-second intervals)
- 99.9% uptime during game hours
- Graceful degradation when sources fail

### 4. Security & Compliance
- API key rotation and security
- Rate limiting to prevent abuse
- Data retention policies
- GDPR/privacy compliance

---

## Risk Mitigation

### 1. API Reliability
**Risk:** ESPN/MLB APIs go down during critical games
**Mitigation:** 
- Multiple backup data sources
- Cached historical data for patterns
- Manual override capabilities
- Real-time monitoring alerts

### 2. Data Conflicts
**Risk:** Different sources report different scores
**Mitigation:**
- Weighted consensus algorithm
- Source reliability scoring
- Manual review queue for conflicts
- Detailed evidence logging

### 3. Performance Bottlenecks
**Risk:** High load during popular games
**Mitigation:**
- Efficient caching strategies
- Database query optimization
- Horizontal scaling capabilities
- Circuit breakers for external APIs

---

## Success Metrics

### Technical KPIs
- **Validation Accuracy:** 99.9% correct trigger detection
- **Response Time:** <5 seconds for validation requests
- **Uptime:** 99.9% availability during game hours
- **Data Freshness:** <30 seconds lag from official sources

### Business KPIs
- **User Trust:** Zero false positive triggers
- **Audit Compliance:** 100% evidence retention
- **Operational Efficiency:** <5 minutes manual review time
- **Scalability:** Support 100+ concurrent promotions

---

## Files to Create/Modify

### New Files Needed:
```
server/services/
├── validationEngine.ts         # Core validation logic
├── gameDataSources/
│   ├── espnSource.ts          # ESPN API integration
│   ├── mlbSource.ts           # MLB API integration
│   └── sourceManager.ts      # Multi-source orchestration
├── evidenceCapture.ts         # Immutable evidence storage
├── gameMonitor.ts             # Real-time monitoring
└── validationScheduler.ts     # Automated validation jobs

server/routes/
├── validation.ts              # Validation API endpoints
└── webhooks.ts               # External webhook handlers

client/src/pages/admin/
├── ValidationDashboard.tsx    # Admin validation interface
├── EvidenceViewer.tsx        # Evidence inspection UI
└── ValidationLogs.tsx        # Audit trail display
```

### Existing Files to Modify:
```
server/storage.ts              # Add validation data methods
server/routes.ts               # Integrate validation endpoints  
shared/schema.ts               # Add validation types if needed
client/src/pages/admin/DealManagement.tsx # Add validation status display
```

---

## Next Steps for LLM Review

**Key Questions for Other LLMs:**

1. **Architecture Review:** Is the multi-source validation approach optimal?
2. **Evidence Integrity:** Are the cryptographic evidence mechanisms sufficient?
3. **Real-time Performance:** Can we achieve <5 second validation with this design?
4. **Scalability:** Will this architecture handle 100+ concurrent promotions?
5. **Security:** Are there additional security considerations we're missing?
6. **Edge Cases:** What failure scenarios should we prepare for?
7. **API Strategy:** Should we prioritize ESPN, MLB, or build a hybrid approach?

**Specific Technical Feedback Needed:**
- Data source reliability and fallback strategies
- Evidence storage and integrity mechanisms  
- Real-time monitoring implementation approach
- Performance optimization opportunities
- Security and compliance gaps

This validation system will be the foundation for user trust and regulatory compliance. Getting the architecture right from the start is critical for long-term success.