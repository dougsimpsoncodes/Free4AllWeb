import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
  decimal,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  city: varchar("city", { length: 100 }),
  zipCode: varchar("zip_code", { length: 10 }),
  phoneNumber: varchar("phone_number", { length: 20 }),
  role: varchar("role", { length: 20 }).default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sports leagues
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 10 }).notNull().unique(),
  apiProvider: varchar("api_provider", { length: 50 }),
  isActive: boolean("is_active").default(true),
});

// Teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
  city: varchar("city", { length: 100 }),
  leagueId: integer("league_id").references(() => leagues.id),
  externalId: varchar("external_id", { length: 50 }).unique(), // ID from sports API
  logoUrl: varchar("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  sport: varchar("sport", { length: 20 }).notNull(), // MLB, NBA, NFL, NHL
  conference: varchar("conference", { length: 50 }), // AL/NL, Eastern/Western, AFC/NFC
  division: varchar("division", { length: 50 }), // AL West, NFC South, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_teams_is_active").on(table.isActive),
  index("idx_teams_league_id").on(table.leagueId),
  index("idx_teams_sport").on(table.sport),
]);

// Restaurant partners
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  logoUrl: varchar("logo_url"),
  website: varchar("website"),
  appStoreUrl: varchar("app_store_url"),
  playStoreUrl: varchar("play_store_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_restaurants_is_active").on(table.isActive),
]);

// Individual deal pages created from approved discovered sites
export const dealPages = pgTable("deal_pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 200 }).unique().notNull(), // URL-friendly identifier
  title: varchar("title", { length: 300 }).notNull(),
  restaurant: varchar("restaurant", { length: 100 }).notNull(),
  offerDescription: text("offer_description").notNull(),
  triggerCondition: varchar("trigger_condition", { length: 200 }).notNull(),
  dealValue: varchar("deal_value", { length: 100 }), // "Free", "$5 off", "BOGO", etc.
  promoCode: varchar("promo_code", { length: 50 }),
  instructions: text("instructions"), // How to claim the deal
  terms: text("terms"), // Fine print, limitations
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  discoveredSiteId: integer("discovered_site_id").references(() => discoveredSites.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promotions
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id),
  restaurantId: integer("restaurant_id").references(() => restaurants.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  offerValue: varchar("offer_value", { length: 100 }),
  triggerCondition: varchar("trigger_condition", { length: 200 }).notNull(),
  redemptionInstructions: text("redemption_instructions"),
  promoCode: varchar("promo_code", { length: 50 }),
  // Force string-mode for DATE (expects 'YYYY-MM-DD')
  validUntil: date("valid_until", { mode: "string" }),
  isActive: boolean("is_active").default(true),
  isSeasonal: boolean("is_seasonal").default(false),
  // Deal source tracking
  source: varchar("source", { length: 50 }).default("manual"), // manual, discovered, imported
  discoveryData: jsonb("discovery_data"), // Store discovery metadata
  approvalStatus: varchar("approval_status", { length: 20 }).default("approved"), // pending, approved, rejected
  approvedBy: varchar("approved_by", { length: 100 }),
  // Force Date-mode for TIMESTAMP (expects JS Date)
  approvedAt: timestamp("approved_at", { mode: "date" }),
  // Force Date-mode for TIMESTAMP defaults too
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  
  // Production-grade enhancements
  state: varchar("state", { length: 20 }).default("approved"), // draft, approved, validating, validated, triggered, expired, archived
  sourceFingerprint: varchar("source_fingerprint", { length: 64 }).unique(), // sha256 hash for deduplication
  sourceUrl: text("source_url"),
  discoveredSiteId: integer("discovered_site_id").references(() => discoveredSites.id),
  
  // Structured trigger conditions (JSONB)
  triggerConditions: jsonb("trigger_conditions").$type<{
    type: "team_win" | "team_score" | "team_home_win";
    conditions: Array<{
      field: string;
      operator: "equals" | "gte" | "lte" | "in";
      value: string | number | string[];
    }>;
    logic: "AND" | "OR";
  }>(),
  
  // Structured redemption details (JSONB)
  redemptionDetails: jsonb("redemption_details").$type<{
    promoCode?: string;
    instructions: string;
    expirationHours: number;
    locations: string[];
    timezone: string;
    limits: {
      perUser?: number;
      total?: number;
      perDay?: number;
    };
  }>(),
  
  // Validation tracking
  validationStatus: varchar("validation_status", { length: 20 }).default("pending"), // pending, validated, failed
  validationData: jsonb("validation_data").$type<{
    mlbVerified?: boolean;
    espnVerified?: boolean;
    lastChecked?: string;
    nextCheck?: string;
    evidence?: any;
  }>(),
  
  // Notification tracking
  notificationData: jsonb("notification_data").$type<{
    sentCount: number;
    lastSent?: string;
    platforms: string[];
    targetUsers?: number[];
  }>(),
}, (table) => [
  index("idx_promotions_active").on(table.isActive),
  index("idx_promotions_state").on(table.state),
  index("idx_promotions_validation_status").on(table.validationStatus),
]);

// Games
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id),
  opponent: varchar("opponent", { length: 100 }).notNull(),
  gameDate: timestamp("game_date").notNull(),
  isHome: boolean("is_home").default(true),
  teamScore: integer("team_score"),
  opponentScore: integer("opponent_score"),
  isComplete: boolean("is_complete").default(false),
  gameStats: jsonb("game_stats"), // Store additional stats like strikeouts, steals, etc.
  externalId: varchar("external_id", { length: 50 }),
}, (table) => [
  index("idx_games_team_id").on(table.teamId),
  index("idx_games_game_date").on(table.gameDate),
  index("idx_games_is_complete").on(table.isComplete),
  index("idx_games_team_date").on(table.teamId, table.gameDate),
]);

// Triggered deals (when promotions are activated)
export const triggeredDeals = pgTable("triggered_deals", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").references(() => promotions.id),
  dealPageId: integer("deal_page_id").references(() => dealPages.id), // For discovered deals
  gameId: integer("game_id").references(() => games.id),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_triggered_deals_is_active").on(table.isActive),
  index("idx_triggered_deals_triggered_at").on(table.triggeredAt),
  index("idx_triggered_deals_promotion_id").on(table.promotionId),
  index("idx_triggered_deals_game_id").on(table.gameId),
  index("idx_triggered_deals_active_triggered").on(table.isActive, table.triggeredAt),
]);

// User alert preferences
export const alertPreferences = pgTable("alert_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  teamId: integer("team_id").references(() => teams.id),
  restaurantId: integer("restaurant_id").references(() => restaurants.id),
  emailAlerts: boolean("email_alerts").default(true),
  smsAlerts: boolean("sms_alerts").default(false),
  alertTiming: varchar("alert_timing", { length: 50 }).default("immediate"), // immediate, morning, both
  isActive: boolean("is_active").default(true),
});

// Alert history
export const alertHistory = pgTable("alert_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  triggeredDealId: integer("triggered_deal_id").references(() => triggeredDeals.id),
  alertType: varchar("alert_type", { length: 20 }).notNull(), // email, sms
  sentAt: timestamp("sent_at").defaultNow(),
  status: varchar("status", { length: 20 }).default("sent"), // sent, failed, pending
});

// Discovery Sources - where we search for deals
export const discoverySources = pgTable("discovery_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // twitter, facebook, instagram, reddit, google, website
  baseUrl: varchar("base_url", { length: 200 }).notNull(),
  searchEndpoint: varchar("search_endpoint", { length: 200 }),
  apiKey: varchar("api_key", { length: 200 }), // encrypted API key
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(5), // 1-10, higher = more important
  rateLimit: integer("rate_limit").default(100), // requests per hour
  lastChecked: timestamp("last_checked"),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Search Terms - what we search for
export const searchTerms = pgTable("search_terms", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurants.id),
  teamId: integer("team_id").references(() => teams.id),
  term: varchar("term", { length: 200 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // restaurant_team, general_promo, sport_specific, food_item
  isActive: boolean("is_active").default(true),
  successRate: decimal("success_rate", { precision: 3, scale: 2 }).default("0.00"), // 0-1, tracks how often this term finds deals
  usageCount: integer("usage_count").default(0),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Discovered Sites - results from our searches
export const discoveredSites = pgTable("discovered_sites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(), // Changed from varchar(500) to text for long URLs
  sourceId: integer("source_id").references(() => discoverySources.id),
  searchTermId: integer("search_term_id").references(() => searchTerms.id),
  title: text("title"), // Changed from varchar(300) to text for long titles
  content: text("content"),
  rawData: text("raw_data"), // full JSON response from API
  foundAt: timestamp("found_at").defaultNow(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending, reviewed, approved, rejected
  dealExtracted: text("deal_extracted"), // JSON string of extracted deal details
  restaurantDetected: varchar("restaurant_detected", { length: 100 }),
  teamDetected: varchar("team_detected", { length: 100 }),
  triggerDetected: varchar("trigger_detected", { length: 200 }),
  promoCodeDetected: varchar("promo_code_detected", { length: 50 }),
  imageExtracted: text("image_extracted"), // URL of extracted promotional image
  expirationDetected: timestamp("expiration_detected"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  notes: text("notes"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  alertPreferences: many(alertPreferences),
  alertHistory: many(alertHistory),
}));

export const leaguesRelations = relations(leagues, ({ many }) => ({
  teams: many(teams),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, {
    fields: [teams.leagueId],
    references: [leagues.id],
  }),
  promotions: many(promotions),
  games: many(games),
  alertPreferences: many(alertPreferences),
}));

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  promotions: many(promotions),
  alertPreferences: many(alertPreferences),
}));

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  team: one(teams, {
    fields: [promotions.teamId],
    references: [teams.id],
  }),
  restaurant: one(restaurants, {
    fields: [promotions.restaurantId],
    references: [restaurants.id],
  }),
  triggeredDeals: many(triggeredDeals),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  team: one(teams, {
    fields: [games.teamId],
    references: [teams.id],
  }),
  triggeredDeals: many(triggeredDeals),
}));

export const triggeredDealsRelations = relations(triggeredDeals, ({ one, many }) => ({
  promotion: one(promotions, {
    fields: [triggeredDeals.promotionId],
    references: [promotions.id],
  }),
  game: one(games, {
    fields: [triggeredDeals.gameId],
    references: [games.id],
  }),
  alertHistory: many(alertHistory),
}));

export const alertPreferencesRelations = relations(alertPreferences, ({ one }) => ({
  user: one(users, {
    fields: [alertPreferences.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [alertPreferences.teamId],
    references: [teams.id],
  }),
  restaurant: one(restaurants, {
    fields: [alertPreferences.restaurantId],
    references: [restaurants.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
});

export const insertTriggeredDealSchema = createInsertSchema(triggeredDeals).omit({
  id: true,
  triggeredAt: true,
});

export const insertAlertPreferenceSchema = createInsertSchema(alertPreferences).omit({
  id: true,
});

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  sentAt: true,
});

export const insertDiscoverySourceSchema = createInsertSchema(discoverySources).omit({
  id: true,
  createdAt: true,
});

export const insertSearchTermSchema = createInsertSchema(searchTerms).omit({
  id: true,
  createdAt: true,
});

export const insertDiscoveredSiteSchema = createInsertSchema(discoveredSites).omit({
  id: true,
  foundAt: true,
});

export const insertDealPageSchema = createInsertSchema(dealPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type TriggeredDeal = typeof triggeredDeals.$inferSelect;
export type InsertTriggeredDeal = z.infer<typeof insertTriggeredDealSchema>;
export type AlertPreference = typeof alertPreferences.$inferSelect;
export type InsertAlertPreference = z.infer<typeof insertAlertPreferenceSchema>;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;
export type DiscoverySource = typeof discoverySources.$inferSelect;
export type InsertDiscoverySource = z.infer<typeof insertDiscoverySourceSchema>;
export type SearchTerm = typeof searchTerms.$inferSelect;
export type InsertSearchTerm = z.infer<typeof insertSearchTermSchema>;
export type DiscoveredSite = typeof discoveredSites.$inferSelect;
export type InsertDiscoveredSite = z.infer<typeof insertDiscoveredSiteSchema>;
export type DealPage = typeof dealPages.$inferSelect;
export type InsertDealPage = z.infer<typeof insertDealPageSchema>;

// Promotion Trigger Events - tracks when deals actually fire
export const promotionTriggerEvents = pgTable("promotion_trigger_events", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").notNull().references(() => promotions.id),
  externalEventId: varchar("external_event_id", { length: 100 }), // gameId, eventId from sports API
  occurredAt: timestamp("occurred_at").notNull(),
  redeemWindowStartAt: timestamp("redeem_window_start_at").notNull(),
  redeemWindowEndAt: timestamp("redeem_window_end_at").notNull(),
  evidence: jsonb("evidence").notNull(), // snapshot of game data, score, conditions met
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_trigger_events_promotion").on(table.promotionId),
  index("idx_trigger_events_window").on(table.redeemWindowEndAt),
  index("idx_trigger_events_external").on(table.externalEventId),
  // Prevent duplicate events for same promotion + external event
  index("idx_trigger_events_unique").on(table.promotionId, table.externalEventId),
]);

// Device Tokens for Push Notifications
export const deviceTokens = pgTable("device_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  deviceToken: varchar("device_token", { length: 200 }).notNull().unique(),
  platform: varchar("platform", { length: 10 }).notNull(), // 'ios', 'android', 'web'
  deviceInfo: jsonb("device_info").$type<{
    model?: string;
    osVersion?: string;
    appVersion?: string;
  }>(),
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_device_tokens_user").on(table.userId),
  index("idx_device_tokens_active").on(table.isActive),
  index("idx_device_tokens_platform").on(table.platform),
]);

export const insertDeviceTokenSchema = createInsertSchema(deviceTokens);
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = z.infer<typeof insertDeviceTokenSchema>;

export const insertPromotionTriggerEventSchema = createInsertSchema(promotionTriggerEvents);
export type PromotionTriggerEvent = typeof promotionTriggerEvents.$inferSelect;
export type InsertPromotionTriggerEvent = z.infer<typeof insertPromotionTriggerEventSchema>;

// Immutable evidence storage for audit trails
export const immutableEvidence = pgTable("immutable_evidence", {
  id: serial("id").primaryKey(),
  evidenceHash: varchar("evidence_hash", { length: 64 }).notNull().unique(),
  storageUri: varchar("storage_uri", { length: 500 }).notNull(),
  canonicalForm: text("canonical_form").notNull(),
  storedAt: timestamp("stored_at").defaultNow().notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  isLocked: boolean("is_locked").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_immutable_evidence_hash").on(table.evidenceHash),
  index("idx_immutable_evidence_stored_at").on(table.storedAt),
]);

export const insertImmutableEvidenceSchema = createInsertSchema(immutableEvidence);
export type ImmutableEvidence = typeof immutableEvidence.$inferSelect;
export type InsertImmutableEvidence = z.infer<typeof insertImmutableEvidenceSchema>;
