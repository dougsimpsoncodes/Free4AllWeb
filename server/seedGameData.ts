import { db } from "./db";
import { games, teams, triggeredDeals, promotions } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDemoGameData() {
  console.log("Seeding demo game data for analytics...");

  try {
    // Get the Dodgers team
    const [dodgers] = await db.select().from(teams).where(eq(teams.externalId, "119"));
    if (!dodgers) {
      console.log("Dodgers team not found, skipping game data seeding");
      return;
    }

    // Sample recent games for the Dodgers
    const demoGames = [
      // Recent wins with trigger conditions
      {
        teamId: dodgers.id,
        opponent: "San Francisco Giants",
        gameDate: new Date("2025-07-15T19:10:00Z"),
        isHome: true,
        teamScore: 8,
        opponentScore: 4,
        isComplete: true,
        gameStats: { runs: 8, hits: 12, strikeOuts: 8, stolenBases: 2, won: true },
        externalId: "demo-game-1"
      },
      {
        teamId: dodgers.id,
        opponent: "San Diego Padres",
        gameDate: new Date("2025-07-13T19:10:00Z"),
        isHome: true,
        teamScore: 6,
        opponentScore: 2,
        isComplete: true,
        gameStats: { runs: 6, hits: 10, strikeOuts: 7, stolenBases: 1, won: true },
        externalId: "demo-game-2"
      },
      {
        teamId: dodgers.id,
        opponent: "Colorado Rockies",
        gameDate: new Date("2025-07-11T19:10:00Z"),
        isHome: true,
        teamScore: 4,
        opponentScore: 3,
        isComplete: true,
        gameStats: { runs: 4, hits: 8, strikeOuts: 6, stolenBases: 0, won: true },
        externalId: "demo-game-3"
      },
      // Some losses
      {
        teamId: dodgers.id,
        opponent: "Arizona Diamondbacks",
        gameDate: new Date("2025-07-09T19:10:00Z"),
        isHome: true,
        teamScore: 2,
        opponentScore: 5,
        isComplete: true,
        gameStats: { runs: 2, hits: 6, strikeOuts: 5, stolenBases: 0, won: false },
        externalId: "demo-game-4"
      },
      {
        teamId: dodgers.id,
        opponent: "Seattle Mariners",
        gameDate: new Date("2025-07-07T19:10:00Z"),
        isHome: false,
        teamScore: 3,
        opponentScore: 7,
        isComplete: true,
        gameStats: { runs: 3, hits: 7, strikeOuts: 4, stolenBases: 1, won: false },
        externalId: "demo-game-5"
      },
      // More recent games for analytics
      {
        teamId: dodgers.id,
        opponent: "Oakland Athletics",
        gameDate: new Date("2025-07-05T19:10:00Z"),
        isHome: true,
        teamScore: 9,
        opponentScore: 1,
        isComplete: true,
        gameStats: { runs: 9, hits: 14, strikeOuts: 10, stolenBases: 3, won: true },
        externalId: "demo-game-6"
      },
      {
        teamId: dodgers.id,
        opponent: "Los Angeles Angels",
        gameDate: new Date("2025-07-03T19:10:00Z"),
        isHome: true,
        teamScore: 7,
        opponentScore: 5,
        isComplete: true,
        gameStats: { runs: 7, hits: 11, strikeOuts: 9, stolenBases: 2, won: true },
        externalId: "demo-game-7"
      },
      {
        teamId: dodgers.id,
        opponent: "Houston Astros",
        gameDate: new Date("2025-07-01T19:10:00Z"),
        isHome: false,
        teamScore: 1,
        opponentScore: 4,
        isComplete: true,
        gameStats: { runs: 1, hits: 4, strikeOuts: 3, stolenBases: 0, won: false },
        externalId: "demo-game-8"
      },
      {
        teamId: dodgers.id,
        opponent: "Texas Rangers",
        gameDate: new Date("2025-06-29T19:10:00Z"),
        isHome: false,
        teamScore: 5,
        opponentScore: 8,
        isComplete: true,
        gameStats: { runs: 5, hits: 9, strikeOuts: 6, stolenBases: 1, won: false },
        externalId: "demo-game-9"
      },
      {
        teamId: dodgers.id,
        opponent: "Chicago Cubs",
        gameDate: new Date("2025-06-27T19:10:00Z"),
        isHome: true,
        teamScore: 6,
        opponentScore: 3,
        isComplete: true,
        gameStats: { runs: 6, hits: 10, strikeOuts: 8, stolenBases: 1, won: true },
        externalId: "demo-game-10"
      }
    ];

    // Insert demo games
    for (const gameData of demoGames) {
      try {
        const [insertedGame] = await db.insert(games).values(gameData).returning();
        console.log(`Inserted demo game: ${gameData.opponent} (${gameData.teamScore}-${gameData.opponentScore})`);

        // Check if this game should trigger any deals
        const activePromotions = await db.select().from(promotions).where(
          eq(promotions.teamId, dodgers.id)
        );

        for (const promotion of activePromotions) {
          let shouldTrigger = false;

          // Evaluate trigger conditions
          const condition = promotion.triggerCondition.toLowerCase();
          if (condition.includes("home") && !gameData.isHome) continue;
          
          if (condition.includes("win") && !gameData.gameStats.won) continue;
          
          if (condition.includes("6+ runs") && gameData.teamScore < 6) continue;
          
          if (condition.includes("7+ strikeouts") && gameData.gameStats.strikeOuts < 7) continue;

          shouldTrigger = true;

          if (shouldTrigger) {
            // Create triggered deal
            const expiresAt = new Date(gameData.gameDate);
            expiresAt.setHours(23, 59, 59, 999); // End of game day

            await db.insert(triggeredDeals).values({
              promotionId: promotion.id,
              gameId: insertedGame.id,
              expiresAt,
              isActive: new Date() < expiresAt
            });

            console.log(`Triggered deal: ${promotion.title}`);
          }
        }
      } catch (error) {
        // Game might already exist, skip
        console.log(`Demo game already exists: ${gameData.opponent}`);
      }
    }

    console.log("✅ Demo game data seeded successfully!");
    return { success: true, games: demoGames.length };

  } catch (error) {
    console.error("Error seeding demo game data:", error);
    throw error;
  }
}