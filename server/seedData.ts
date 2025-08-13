import { db } from "./supabaseDb";
import { teams, restaurants, promotions, leagues } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedMLBData() {
  console.log("Seeding MLB teams and promotions...");

  try {
    // Create MLB league
    let mlbLeague;
    try {
      [mlbLeague] = await db.insert(leagues).values({
        name: "Major League Baseball",
        abbreviation: "MLB",
        apiProvider: "mlb-stats-api",
        isActive: true
      }).returning();
    } catch (error) {
      // League might already exist, get it
      [mlbLeague] = await db.select().from(leagues).where(eq(leagues.abbreviation, "MLB"));
      if (!mlbLeague) throw error;
    }

    // Seed Los Angeles Dodgers
    let dodgers;
    try {
      [dodgers] = await db.insert(teams).values({
        name: "Los Angeles Dodgers",
        abbreviation: "LAD",
        city: "Los Angeles",
        leagueId: mlbLeague.id,
        externalId: "119", // MLB API team ID
        logoUrl: "/logos/dodgers.png",
        primaryColor: "#005A9C",
        sport: "MLB",
        conference: "NL",
        division: "NL West",
        isActive: true
      }).returning();
    } catch (error) {
      // Team might already exist, get it
      [dodgers] = await db.select().from(teams).where(eq(teams.externalId, "119"));
      if (!dodgers) throw error;
    }

    // Seed restaurants
    const restaurants_data = [
      {
        name: "McDonald's",
        logoUrl: "/logos/mcdonalds.png",
        website: "https://www.mcdonalds.com",
        appStoreUrl: "https://apps.apple.com/us/app/mcdonalds/id922103212",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.mcdonalds.app",
        primaryColor: "#FFC72C",
        isActive: true
      },
      {
        name: "ampm",
        logoUrl: "/logos/ampm.svg",
        website: "https://www.ampm.com",
        appStoreUrl: "https://apps.apple.com/us/app/ampm/id1163472727",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.ampm.android",
        primaryColor: "#00B04F",
        isActive: true
      },
      {
        name: "Jack in the Box",
        logoUrl: "/logos/jackinthebox.png",
        website: "https://www.jackinthebox.com",
        appStoreUrl: "https://apps.apple.com/us/app/jack-in-the-box/id1025398179",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.jackinthebox.ordering",
        primaryColor: "#ED1C24",
        isActive: true
      },
      {
        name: "Panda Express",
        logoUrl: "/logos/panda-express-logo.svg",
        website: "https://www.pandaexpress.com",
        appStoreUrl: "https://apps.apple.com/us/app/panda-express/id1182575872",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.pandaexpress.android",
        primaryColor: "#D2232A",
        isActive: true
      }
    ];

    const insertedRestaurants = [];
    for (const restaurant of restaurants_data) {
      try {
        const [insertedRestaurant] = await db.insert(restaurants).values(restaurant).returning();
        insertedRestaurants.push(insertedRestaurant);
      } catch (error) {
        // Restaurant might already exist, get it
        const [existingRestaurant] = await db.select().from(restaurants).where(eq(restaurants.name, restaurant.name));
        if (existingRestaurant) {
          insertedRestaurants.push(existingRestaurant);
        } else {
          throw error;
        }
      }
    }

    // Seed promotions for Dodgers
    const promotions_data = [
      {
        teamId: dodgers.id,
        restaurantId: insertedRestaurants.find(r => r.name === "McDonald's")!.id,
        title: "Free Big Mac on Dodgers Home Win",
        description: "Get a free Big Mac when the Dodgers win at home and score 6+ runs",
        offerValue: "Free Big Mac",
        triggerCondition: "home win and 6+ runs scored",
        redemptionInstructions: "Show this offer in the McDonald's app within 24 hours of the game ending",
        promoCode: null,
        validUntil: new Date("2025-10-31"), // End of season
        isActive: true,
        isSeasonal: true
      },
      {
        teamId: dodgers.id,
        restaurantId: insertedRestaurants.find(r => r.name === "ampm")!.id,
        title: "Free Coffee on Dodgers Win",
        description: "Get a free medium coffee when the Dodgers win any home game",
        offerValue: "Free Medium Coffee",
        triggerCondition: "home win",
        redemptionInstructions: "Show this notification at any ampm location. Valid until midnight the day after the game.",
        promoCode: "DODGERS2025",
        validUntil: new Date("2025-10-31"),
        isActive: true,
        isSeasonal: true
      },
      {
        teamId: dodgers.id,
        restaurantId: insertedRestaurants.find(r => r.name === "Jack in the Box")!.id,
        title: "Free Curly Fries on 7+ Strikeouts",
        description: "Get free curly fries when Dodgers pitchers record 7+ strikeouts in a home game",
        offerValue: "Free Curly Fries",
        triggerCondition: "home game and 7+ strikeouts",
        redemptionInstructions: "Use the Jack in the Box app with code STRIKEOUT. Valid next day only.",
        promoCode: "STRIKEOUT",
        validUntil: new Date("2025-10-31"),
        isActive: true,
        isSeasonal: true
      }
    ];

    for (const promotion of promotions_data) {
      await db.insert(promotions).values(promotion)
        .onConflictDoNothing();
    }

    console.log("✅ MLB data seeded successfully!");
    console.log(`- Seeded ${insertedRestaurants.length} restaurants`);
    console.log(`- Seeded ${promotions_data.length} promotions for Dodgers`);
    
    return {
      success: true,
      teams: 1,
      restaurants: insertedRestaurants.length,
      promotions: promotions_data.length
    };

  } catch (error) {
    console.error("Error seeding MLB data:", error);
    throw error;
  }
}

// Legacy function - keep for backward compatibility
export const seedSportsData = seedMLBData;