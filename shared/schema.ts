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
});

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
  validUntil: date("valid_until"),
  isActive: boolean("is_active").default(true),
  isSeasonal: boolean("is_seasonal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

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
});

// Triggered deals (when promotions are activated)
export const triggeredDeals = pgTable("triggered_deals", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").references(() => promotions.id),
  gameId: integer("game_id").references(() => games.id),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
});

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
