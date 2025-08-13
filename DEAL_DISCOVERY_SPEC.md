# Deal Discovery System: Feature Specification

## Overview
The Deal Discovery system is the core intelligence engine of Free4AllWeb that identifies and catalogs sports-based promotional offers from restaurants and businesses. The system operates on a pre-season discovery model, where comprehensive deal harvesting occurs before each sports season begins.

## Business Context
Sports promotions (e.g., "Free McNuggets when Dodgers score 6+ runs") are typically announced and finalized before the season starts. This creates a concentrated window where all relevant deals can be discovered, validated, and loaded into the system for the entire season.

## Process Flow

### Phase 1: Pre-Season Discovery Setup
**Admin Workflow:**
1. Admin selects sport (MLB, NBA, NFL, NHL)
2. Admin selects specific team(s) (e.g., Los Angeles Dodgers)
3. Admin initiates discovery: "Find New Deals" button
4. System begins systematic scraping across all configured sources

### Phase 2: Source Scraping & Lead Generation
**Target Sources (in priority order):**

**Tier 1 - Official Sources:**
- Team websites (dodgers.com/promotions, yankees.com/partnerships)
- Restaurant chain promotion pages (mcdonalds.com/promotions)
- League official partnerships (mlb.com/sponsors)

**Tier 2 - Social Aggregation:**
- Reddit: r/baseball, r/[teamname], r/[cityname], r/deals
- Twitter: Official team accounts, restaurant marketing accounts
- Facebook: Team pages, local restaurant pages

**Tier 3 - Deal Aggregation Sites:**
- Slickdeals, RetailMeNot, Groupon sports categories
- Local news sites and blogs
- Fan forums and community sites

### Phase 3: Result Processing & Deduplication
**System Intelligence:**
- Confidence scoring based on source reliability and content analysis
- URL normalization and duplicate detection
- Content hashing to identify same deals across multiple platforms
- Source consolidation (merge same deal from Twitter + Reddit)

**Output Format:**
```
High-Confidence Deal Sources:
- reddit.com/r/baseball/dodgers-2025-promotions (95% confidence)
- dodgers.com/partnerships (90% confidence)  
- twitter.com/@Dodgers/promo-announcement (85% confidence)
```

### Phase 4: Manual Deal Extraction
**Admin Workflow:**
1. Review each high-confidence source manually
2. Click through to source website/post
3. Identify legitimate promotional offers
4. Return to admin panel and manually enter deal details:
   - Restaurant/Business name
   - Team association
   - Trigger conditions (score thresholds, win conditions, etc.)
   - Reward details (free items, discounts, etc.)
   - Validity period
   - Geographic restrictions
   - Redemption requirements

### Phase 5: Deal Validation & Approval
**Quality Control:**
- Admin review of manually entered deals
- Verification against original sources
- Approval workflow (Approved/Needs Edit/Rejected)
- Integration into active promotion system

### Phase 6: Season Activation
**Operational Mode:**
- Approved deals become active for monitoring
- Real-time game data triggers deal activation
- User notifications sent when conditions are met
- No additional deal discovery needed during season

## Key Challenges

### 1. Source Reliability & Signal vs Noise
**Challenge:** Distinguishing legitimate promotions from speculation, expired deals, or fan wishful thinking.
**Impact:** False positives waste admin time; false negatives miss real opportunities.
**Mitigation:** Confidence scoring, source priority ranking, manual verification requirement.

### 2. Content Extraction Complexity
**Challenge:** Promotional information is embedded in unstructured content (social media posts, blog articles, forum discussions).
**Impact:** High manual effort required to extract actionable deal information.
**Current Approach:** Full manual extraction by admin.
**Future Enhancement:** AI-assisted parsing and semi-automated extraction tools.

### 3. Duplicate Detection Across Platforms
**Challenge:** Same deal appears on multiple sources (team Twitter, Reddit discussion, news article).
**Impact:** Admin sees redundant results, wastes time reviewing duplicates.
**Solution:** URL normalization, content hashing, source consolidation logic.

### 4. Deal Completeness & Accuracy
**Challenge:** Promotional announcements often lack complete details (exact trigger conditions, redemption process, geographic limitations).
**Impact:** Incomplete deals cannot be properly monitored or activated.
**Mitigation:** Admin verification against multiple sources, requirement for complete deal data.

### 5. Temporal Relevance
**Challenge:** Discovering current season deals while filtering out previous years' promotions.
**Impact:** Outdated information clutters results and wastes admin time.
**Solution:** Date-based filtering, seasonal keyword detection, source freshness scoring.

### 6. Geographic Scope Management
**Challenge:** National chains may have region-specific promotions, local businesses have limited geographic relevance.
**Impact:** Irrelevant deals for user base, complex geographic matching requirements.
**Approach:** Team-by-team discovery ensures geographic relevance.

### 7. Multi-Sport Complexity
**Challenge:** Different sports have different scoring systems, season schedules, and promotional patterns.
**Impact:** Complex trigger condition modeling, sport-specific keyword requirements.
**Approach:** One sport, one team at a time discovery process.

### 8. Scale vs Quality Trade-off
**Challenge:** Broad discovery captures more deals but increases noise; narrow discovery risks missing opportunities.
**Impact:** Resource allocation between comprehensive coverage and result quality.
**Strategy:** Tiered source approach with confidence-based prioritization.

## Technical Requirements

### Data Storage
- Discovered source tracking with deduplication
- Deal extraction and approval workflow
- Source reliability scoring and learning
- Seasonal campaign management

### Admin Interface
- Discovery initiation and progress tracking
- Source result review and navigation
- Manual deal entry forms with validation
- Approval workflow and bulk operations

### Integration Points
- Sports data APIs for trigger monitoring
- Notification systems for deal activation
- User preference and geographic targeting
- Analytics and performance tracking

## Success Metrics
- **Coverage:** Percentage of legitimate deals discovered vs total market
- **Efficiency:** Admin time per deal successfully entered and approved
- **Accuracy:** Percentage of approved deals that successfully activate during season
- **User Impact:** Deal activation rate and user engagement metrics

## Future Enhancements (Phase 2)
- AI-powered deal content extraction
- Browser extension for streamlined deal entry
- Historical pattern recognition for recurring promotions
- Automated source reliability learning
- Real-time deal verification against business APIs

---
*This specification represents the current manual-first approach, with planned evolution toward semi-automated and AI-assisted discovery in future phases.*