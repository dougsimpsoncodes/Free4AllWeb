// Test the enhanced promotion creation
import { DatabaseStorage } from './server/storage.js';

const storage = new DatabaseStorage();

async function testPromotionCreation() {
  try {
    console.log("=== Testing Enhanced Promotion Creation ===");
    
    const dealDetails = {
      title: "Free Orange Chicken When Dodgers Win",
      description: "Get free Orange Chicken at Panda Express when the Los Angeles Dodgers win their game",
      restaurant: "Panda Express",
      team: "Los Angeles Dodgers",
      triggerType: "team_win",
      triggerCondition: "Dodgers win any game",
      triggerConditions: [
        {
          field: "result",
          operator: "equals",
          value: "win"
        }
      ],
      triggerLogic: "AND",
      offerValue: "Free",
      promoCode: null,
      instructions: "Show this notification to cashier when Dodgers win",
      expirationHours: 24,
      locations: ["all"],
      perUserLimit: 1,
      totalLimit: null,
      perDayLimit: 1
    };
    
    console.log("Deal details:", JSON.stringify(dealDetails, null, 2));
    
    // Test idempotent creation
    console.log("\n=== First Creation ===");
    const promotion1 = await storage.createPromotionFromDiscoveredSite(408, dealDetails, 'test-admin');
    console.log("Created promotion:", {
      id: promotion1.id,
      title: promotion1.title,
      state: promotion1.state,
      validationStatus: promotion1.validationStatus,
      sourceFingerprint: promotion1.sourceFingerprint
    });
    
    console.log("\n=== Second Creation (should be idempotent) ===");
    const promotion2 = await storage.createPromotionFromDiscoveredSite(408, dealDetails, 'test-admin');
    console.log("Second creation result:", {
      id: promotion2.id,
      sameAsFirst: promotion1.id === promotion2.id,
      sourceFingerprint: promotion2.sourceFingerprint
    });
    
    console.log("\n=== Test Complete ===");
    
  } catch (error) {
    console.error("Error:", error.message);
    console.error(error.stack);
  }
}

testPromotionCreation();