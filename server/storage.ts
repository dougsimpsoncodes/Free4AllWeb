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
  discoverySources,
  searchTerms,
  discoveredSites,
  dealPages,
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
  type DiscoverySource,
  type InsertDiscoverySource,
  type SearchTerm,
  type InsertSearchTerm,
  type DiscoveredSite,
  type InsertDiscoveredSite,
  type DealPage,
  type InsertDealPage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte } from "drizzle-orm";

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

  // Discovery Source operations
  createDiscoverySource(source: InsertDiscoverySource): Promise<DiscoverySource>;
  getDiscoverySources(): Promise<DiscoverySource[]>;
  getActiveDiscoverySources(): Promise<DiscoverySource[]>;
  updateDiscoverySource(id: number, updates: Partial<InsertDiscoverySource>): Promise<DiscoverySource>;

  // Search Term operations
  createSearchTerm(term: InsertSearchTerm): Promise<SearchTerm>;
  getSearchTerms(): Promise<SearchTerm[]>;
  getActiveSearchTerms(): Promise<SearchTerm[]>;
  updateSearchTermUsage(id: number): Promise<SearchTerm>;

  // Discovered Site operations
  createDiscoveredSite(site: InsertDiscoveredSite): Promise<DiscoveredSite>;
  getDiscoveredSites(): Promise<DiscoveredSite[]>;
  getPendingDiscoveredSites(): Promise<DiscoveredSite[]>;
  updateDiscoveredSite(id: number, updates: Partial<InsertDiscoveredSite>): Promise<DiscoveredSite>;

  // Deal Page operations
  createDealPage(dealPage: InsertDealPage): Promise<DealPage>;
  getDealPage(slug: string): Promise<DealPage | undefined>;
  getDealPageById(id: number): Promise<DealPage | undefined>;
  getAllDealPages(): Promise<DealPage[]>;
  getActiveDealPages(): Promise<DealPage[]>;
  updateDealPage(id: number, updates: Partial<InsertDealPage>): Promise<DealPage>;
  deleteDealPage(id: number): Promise<void>;
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

  async getAlertHistory(userId: string): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId))
      .orderBy(desc(alertHistory.sentAt))
      .limit(50);
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    // For now, return 0 - can be enhanced with read status tracking
    return 0;
  }

  async getUserAlertHistory(userId: string): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId))
      .orderBy(desc(alertHistory.sentAt));
  }

  // Discovery Source operations
  async createDiscoverySource(source: InsertDiscoverySource): Promise<DiscoverySource> {
    const [newSource] = await db.insert(discoverySources).values(source).returning();
    return newSource;
  }

  async getDiscoverySources(): Promise<DiscoverySource[]> {
    return await db.select().from(discoverySources).orderBy(desc(discoverySources.priority));
  }

  async getActiveDiscoverySources(): Promise<DiscoverySource[]> {
    return await db
      .select()
      .from(discoverySources)
      .where(eq(discoverySources.isActive, true))
      .orderBy(desc(discoverySources.priority));
  }

  async updateDiscoverySource(id: number, updates: Partial<InsertDiscoverySource>): Promise<DiscoverySource> {
    const [updated] = await db
      .update(discoverySources)
      .set(updates)
      .where(eq(discoverySources.id, id))
      .returning();
    return updated;
  }

  // Search Term operations
  async createSearchTerm(term: InsertSearchTerm): Promise<SearchTerm> {
    const [newTerm] = await db.insert(searchTerms).values(term).returning();
    return newTerm;
  }

  async getSearchTerms(): Promise<SearchTerm[]> {
    return await db.select().from(searchTerms).orderBy(desc(searchTerms.successRate));
  }

  async getActiveSearchTerms(): Promise<SearchTerm[]> {
    return await db
      .select()
      .from(searchTerms)
      .where(eq(searchTerms.isActive, true))
      .orderBy(desc(searchTerms.successRate));
  }

  async updateSearchTermUsage(id: number): Promise<SearchTerm> {
    // First get the current usage count
    const [currentTerm] = await db
      .select()
      .from(searchTerms)
      .where(eq(searchTerms.id, id));
    
    const [updated] = await db
      .update(searchTerms)
      .set({
        usageCount: (currentTerm?.usageCount || 0) + 1,
        lastUsed: new Date()
      })
      .where(eq(searchTerms.id, id))
      .returning();
    return updated;
  }

  // Discovered Site operations
  async createDiscoveredSite(site: InsertDiscoveredSite): Promise<DiscoveredSite> {
    const [newSite] = await db.insert(discoveredSites).values(site).returning();
    return newSite;
  }

  async getDiscoveredSites(): Promise<DiscoveredSite[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return await db
      .select()
      .from(discoveredSites)
      .where(gte(discoveredSites.foundAt, sixMonthsAgo))
      .orderBy(desc(discoveredSites.foundAt));
  }

  async getPendingDiscoveredSites(): Promise<DiscoveredSite[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return await db
      .select()
      .from(discoveredSites)
      .where(
        and(
          eq(discoveredSites.status, 'pending'),
          gte(discoveredSites.foundAt, sixMonthsAgo)
        )
      )
      .orderBy(desc(discoveredSites.confidence));
  }

  async updateDiscoveredSite(id: number, updates: Partial<InsertDiscoveredSite>): Promise<DiscoveredSite> {
    const [updated] = await db
      .update(discoveredSites)
      .set(updates)
      .where(eq(discoveredSites.id, id))
      .returning();
    return updated;
  }

  // Deal Page operations
  async createDealPage(dealPage: InsertDealPage): Promise<DealPage> {
    const [newDealPage] = await db.insert(dealPages).values(dealPage).returning();
    return newDealPage;
  }

  async getDealPage(slug: string): Promise<DealPage | undefined> {
    const [dealPage] = await db.select().from(dealPages).where(eq(dealPages.slug, slug));
    return dealPage;
  }

  async getDealPageById(id: number): Promise<DealPage | undefined> {
    const [dealPage] = await db.select().from(dealPages).where(eq(dealPages.id, id));
    return dealPage;
  }

  async getAllDealPages(): Promise<DealPage[]> {
    return await db.select().from(dealPages).orderBy(desc(dealPages.createdAt));
  }

  async getActiveDealPages(): Promise<DealPage[]> {
    return await db
      .select()
      .from(dealPages)
      .where(eq(dealPages.isActive, true))
      .orderBy(desc(dealPages.createdAt));
  }

  async updateDealPage(id: number, updates: Partial<InsertDealPage>): Promise<DealPage> {
    const [updated] = await db
      .update(dealPages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dealPages.id, id))
      .returning();
    return updated;
  }

  async deleteDealPage(id: number): Promise<void> {
    await db.delete(dealPages).where(eq(dealPages.id, id));
  }

  async getDiscoveredSite(id: number): Promise<DiscoveredSite | undefined> {
    const [site] = await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.id, id));
    return site;
  }

  async getPendingDiscoveredSites(limit: number = 10): Promise<DiscoveredSite[]> {
    return await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.status, 'pending'))
      .limit(limit);
  }

  async getDiscoveredSitesByUrl(url: string): Promise<DiscoveredSite[]> {
    return await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.url, url));
  }

  async getUsersByTeamSubscription(teamId: number): Promise<User[]> {
    // For now, return all users - can be enhanced with team subscription table
    return await db.select().from(users);
  }

  async getPromotionsByTeam(teamId: number): Promise<any[]> {
    return await db.select().from(promotions).where(eq(promotions.teamId, teamId));
  }

  async getUpcomingGames(days: number): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db.select()
      .from(games)
      .where(and(
        gte(games.gameDate, new Date()),
        lte(games.gameDate, futureDate)
      ))
      .orderBy(asc(games.gameDate));
  }

  async storeAlertHistory(alertData: any): Promise<void> {
    await db.insert(alertHistory).values({
      userId: alertData.userId,
      gameId: alertData.gameId,
      alertType: alertData.alertType as 'email' | 'sms',
      status: alertData.status as 'sent' | 'failed',
      sentAt: alertData.sentAt || new Date(),
    });
  }

  async storeTriggeredDeal(dealData: any): Promise<void> {
    await db.insert(triggeredDeals).values({
      promotionId: dealData.promotionId,
      gameId: dealData.gameId,
      teamId: dealData.teamId,
      triggerCondition: dealData.triggerCondition,
      actualResult: dealData.actualResult,
      isActive: dealData.isActive,
      triggeredAt: dealData.triggeredAt,
      expiresAt: dealData.expiresAt,
    });
  }
}

export const storage = new DatabaseStorage();
