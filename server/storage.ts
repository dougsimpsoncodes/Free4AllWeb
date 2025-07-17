import {
  users,
  teams,
  restaurants,
  promotions,
  games,
  triggeredDeals,
  alertPreferences,
  alertHistory,
  leagues,
  type User,
  type UpsertUser,
  type Team,
  type InsertTeam,
  type Restaurant,
  type InsertRestaurant,
  type Promotion,
  type InsertPromotion,
  type Game,
  type InsertGame,
  type TriggeredDeal,
  type InsertTriggeredDeal,
  type AlertPreference,
  type InsertAlertPreference,
  type AlertHistory,
  type InsertAlertHistory,
  type League,
  type InsertLeague,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // League operations
  getLeagues(): Promise<League[]>;
  createLeague(league: InsertLeague): Promise<League>;

  // Team operations
  getTeams(): Promise<Team[]>;
  getActiveTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team>;

  // Restaurant operations
  getRestaurants(): Promise<Restaurant[]>;
  getActiveRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: number): Promise<Restaurant | undefined>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;

  // Promotion operations
  getPromotions(): Promise<Promotion[]>;
  getActivePromotions(): Promise<Promotion[]>;
  getPromotionsByTeam(teamId: number): Promise<Promotion[]>;
  getPromotion(id: number): Promise<Promotion | undefined>;
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: number, promotion: Partial<InsertPromotion>): Promise<Promotion>;

  // Game operations
  getGames(): Promise<Game[]>;
  getRecentGames(teamId: number, limit?: number): Promise<Game[]>;
  getGame(id: number): Promise<Game | undefined>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: number, game: Partial<InsertGame>): Promise<Game>;

  // Triggered deal operations
  getTriggeredDeals(): Promise<TriggeredDeal[]>;
  getActiveTriggeredDeals(): Promise<TriggeredDeal[]>;
  getTriggeredDealsByGame(gameId: number): Promise<TriggeredDeal[]>;
  createTriggeredDeal(deal: InsertTriggeredDeal): Promise<TriggeredDeal>;

  // Alert preference operations
  getUserAlertPreferences(userId: string): Promise<AlertPreference[]>;
  getUsersByTeamPreference(teamId: number): Promise<string[]>;
  createAlertPreference(preference: InsertAlertPreference): Promise<AlertPreference>;
  updateAlertPreference(id: number, preference: Partial<InsertAlertPreference>): Promise<AlertPreference>;
  deleteAlertPreference(id: number): Promise<void>;

  // Alert history operations
  createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory>;
  getUserAlertHistory(userId: string): Promise<AlertHistory[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // League operations
  async getLeagues(): Promise<League[]> {
    return await db.select().from(leagues).orderBy(asc(leagues.name));
  }

  async createLeague(league: InsertLeague): Promise<League> {
    const [newLeague] = await db.insert(leagues).values(league).returning();
    return newLeague;
  }

  // Team operations
  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(asc(teams.name));
  }

  async getActiveTeams(): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.isActive, true)).orderBy(asc(teams.name));
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team> {
    const [updatedTeam] = await db
      .update(teams)
      .set(team)
      .where(eq(teams.id, id))
      .returning();
    return updatedTeam;
  }

  // Restaurant operations
  async getRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants).orderBy(asc(restaurants.name));
  }

  async getActiveRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants).where(eq(restaurants.isActive, true)).orderBy(asc(restaurants.name));
  }

  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const [newRestaurant] = await db.insert(restaurants).values(restaurant).returning();
    return newRestaurant;
  }

  // Promotion operations
  async getPromotions(): Promise<Promotion[]> {
    return await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  }

  async getActivePromotions(): Promise<Promotion[]> {
    return await db
      .select()
      .from(promotions)
      .where(eq(promotions.isActive, true))
      .orderBy(desc(promotions.createdAt));
  }

  async getPromotionsByTeam(teamId: number): Promise<Promotion[]> {
    return await db
      .select()
      .from(promotions)
      .where(and(eq(promotions.teamId, teamId), eq(promotions.isActive, true)))
      .orderBy(desc(promotions.createdAt));
  }

  async getPromotion(id: number): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion;
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [newPromotion] = await db.insert(promotions).values(promotion).returning();
    return newPromotion;
  }

  async updatePromotion(id: number, promotion: Partial<InsertPromotion>): Promise<Promotion> {
    const [updatedPromotion] = await db
      .update(promotions)
      .set(promotion)
      .where(eq(promotions.id, id))
      .returning();
    return updatedPromotion;
  }

  // Game operations
  async getGames(): Promise<Game[]> {
    return await db.select().from(games).orderBy(desc(games.gameDate));
  }

  async getRecentGames(teamId: number, limit: number = 10): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(eq(games.teamId, teamId))
      .orderBy(desc(games.gameDate))
      .limit(limit);
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  }

  async updateGame(id: number, game: Partial<InsertGame>): Promise<Game> {
    const [updatedGame] = await db
      .update(games)
      .set(game)
      .where(eq(games.id, id))
      .returning();
    return updatedGame;
  }

  // Triggered deal operations
  async getTriggeredDeals(): Promise<TriggeredDeal[]> {
    return await db.select().from(triggeredDeals).orderBy(desc(triggeredDeals.triggeredAt));
  }

  async getActiveTriggeredDeals(): Promise<TriggeredDeal[]> {
    return await db
      .select()
      .from(triggeredDeals)
      .where(eq(triggeredDeals.isActive, true))
      .orderBy(desc(triggeredDeals.triggeredAt));
  }

  async getTriggeredDealsByGame(gameId: number): Promise<TriggeredDeal[]> {
    return await db
      .select()
      .from(triggeredDeals)
      .where(eq(triggeredDeals.gameId, gameId))
      .orderBy(desc(triggeredDeals.triggeredAt));
  }

  async createTriggeredDeal(deal: InsertTriggeredDeal): Promise<TriggeredDeal> {
    const [newDeal] = await db.insert(triggeredDeals).values(deal).returning();
    return newDeal;
  }

  // Alert preference operations
  async getUserAlertPreferences(userId: string): Promise<AlertPreference[]> {
    return await db
      .select()
      .from(alertPreferences)
      .where(and(eq(alertPreferences.userId, userId), eq(alertPreferences.isActive, true)));
  }

  async getUsersByTeamPreference(teamId: number): Promise<string[]> {
    const results = await db
      .select({ userId: alertPreferences.userId })
      .from(alertPreferences)
      .where(
        and(
          eq(alertPreferences.teamId, teamId),
          eq(alertPreferences.isActive, true),
          eq(alertPreferences.emailAlerts, true)
        )
      );
    return results.map(r => r.userId).filter((id): id is string => id !== null);
  }

  async createAlertPreference(preference: InsertAlertPreference): Promise<AlertPreference> {
    const [newPreference] = await db.insert(alertPreferences).values(preference).returning();
    return newPreference;
  }

  async updateAlertPreference(id: number, preference: Partial<InsertAlertPreference>): Promise<AlertPreference> {
    const [updatedPreference] = await db
      .update(alertPreferences)
      .set(preference)
      .where(eq(alertPreferences.id, id))
      .returning();
    return updatedPreference;
  }

  async deleteAlertPreference(id: number): Promise<void> {
    await db.delete(alertPreferences).where(eq(alertPreferences.id, id));
  }

  // Alert history operations
  async createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory> {
    const [newHistory] = await db.insert(alertHistory).values(history).returning();
    return newHistory;
  }

  async getUserAlertHistory(userId: string): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId))
      .orderBy(desc(alertHistory.sentAt));
  }
}

export const storage = new DatabaseStorage();
