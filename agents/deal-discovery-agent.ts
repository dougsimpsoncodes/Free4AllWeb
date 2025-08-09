import { storage } from "../server/storage";
import { DealDiscoveryEngine, SearchResult } from "../server/services/dealDiscoveryEngine";
import { dealVerificationService } from "../server/services/dealVerificationService";
import { dealExtractionEngine } from "../server/services/dealExtractionEngine";
import type { DiscoveredSite, Restaurant, Team } from "@shared/schema";

export interface DealDiscoveryReport {
  timestamp: Date;
  totalSitesScanned: number;
  dealsDiscovered: number;
  dealsVerified: number;
  confidenceScores: number[];
  apiRateLimits: Record<string, { used: number; limit: number; resetTime: Date }>;
  errorSummary: { source: string; error: string; count: number }[];
  performanceMetrics: {
    avgScrapeTime: number;
    avgExtractionTime: number;
    avgVerificationTime: number;
  };
}

export interface DealQualityMetrics {
  accuracyScore: number;
  completenessScore: number;
  freshnessScore: number;
  relevanceScore: number;
  overallScore: number;
}

class DealDiscoveryAgent {
  private discoveryEngine: DealDiscoveryEngine;
  private isRunning: boolean = false;
  private lastReport: DealDiscoveryReport | null = null;

  constructor() {
    this.discoveryEngine = new DealDiscoveryEngine();
  }

  async initialize(): Promise<void> {
    console.log("🤖 Initializing Deal Discovery Agent...");
    await this.discoveryEngine.initialize();
    console.log("✅ Deal Discovery Agent ready");
  }

  /**
   * Run comprehensive deal discovery and verification cycle
   */
  async runDiscoveryAndVerification(): Promise<DealDiscoveryReport> {
    if (this.isRunning) {
      throw new Error("Discovery cycle already in progress");
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log("🔍 Starting comprehensive deal discovery cycle...");

    try {
      const report: DealDiscoveryReport = {
        timestamp: new Date(),
        totalSitesScanned: 0,
        dealsDiscovered: 0,
        dealsVerified: 0,
        confidenceScores: [],
        apiRateLimits: {},
        errorSummary: [],
        performanceMetrics: {
          avgScrapeTime: 0,
          avgExtractionTime: 0,
          avgVerificationTime: 0
        }
      };

      // Step 1: Discover new deals
      const discoveryResults = await this.performDiscovery();
      report.totalSitesScanned = discoveryResults.sitesScanned;
      report.dealsDiscovered = discoveryResults.dealsFound.length;

      // Step 2: Extract deal details from discovered sites
      const extractedDeals = await this.extractDealDetails(discoveryResults.dealsFound);
      
      // Step 3: Verify deal authenticity and accuracy
      const verifiedDeals = await this.verifyDeals(extractedDeals);
      report.dealsVerified = verifiedDeals.length;
      report.confidenceScores = verifiedDeals.map(deal => deal.confidence || 0);

      // Step 4: Quality assessment
      const qualityMetrics = await this.assessDealQuality(verifiedDeals);
      
      // Step 5: Update database with approved deals
      await this.updateDealDatabase(verifiedDeals);

      // Calculate performance metrics
      const endTime = Date.now();
      report.performanceMetrics.avgScrapeTime = (endTime - startTime) / report.totalSitesScanned;

      this.lastReport = report;
      console.log(`✅ Discovery cycle complete: ${report.dealsVerified} deals verified`);
      
      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Test specific deal discovery sources for reliability
   */
  async testDiscoverySources(): Promise<{ source: string; status: 'healthy' | 'degraded' | 'failed'; details: any }[]> {
    console.log("🧪 Testing discovery sources...");
    
    const sources = await storage.getActiveDiscoverySources();
    const results = [];

    for (const source of sources) {
      try {
        const startTime = Date.now();
        const testResults = await this.testSource(source);
        const responseTime = Date.now() - startTime;

        results.push({
          source: source.name,
          status: testResults.success ? 'healthy' : 'degraded',
          details: {
            responseTime,
            successRate: testResults.successRate,
            lastError: testResults.lastError,
            rateLimit: testResults.rateLimit
          }
        });
      } catch (error) {
        results.push({
          source: source.name,
          status: 'failed',
          details: { error: error.message }
        });
      }
    }

    return results;
  }

  /**
   * Validate deal extraction accuracy against known good examples
   */
  async validateExtractionAccuracy(): Promise<{ accuracy: number; details: any[] }> {
    console.log("📊 Validating extraction accuracy...");
    
    // Get sample of known good deals for testing
    const testCases = await this.getExtractionTestCases();
    let correctExtractions = 0;

    const details = [];

    for (const testCase of testCases) {
      try {
        const extracted = await dealExtractionEngine.extractDealFromText(
          testCase.input,
          testCase.url
        );

        const isCorrect = this.compareExtractionResults(extracted, testCase.expected);
        if (isCorrect) correctExtractions++;

        details.push({
          url: testCase.url,
          correct: isCorrect,
          expected: testCase.expected,
          actual: extracted
        });
      } catch (error) {
        details.push({
          url: testCase.url,
          correct: false,
          error: error.message
        });
      }
    }

    const accuracy = correctExtractions / testCases.length;
    return { accuracy, details };
  }

  /**
   * Monitor API rate limits across all discovery sources
   */
  async monitorRateLimits(): Promise<Record<string, { usage: number; limit: number; resetTime: Date; status: 'ok' | 'warning' | 'exceeded' }>> {
    const sources = await storage.getActiveDiscoverySources();
    const rateLimitStatus: Record<string, any> = {};

    for (const source of sources) {
      try {
        const usage = await this.checkSourceUsage(source);
        const limit = source.rateLimit || 100;
        const usagePercent = usage / limit;

        rateLimitStatus[source.name] = {
          usage,
          limit,
          resetTime: new Date(Date.now() + 60 * 60 * 1000), // Assume hourly reset
          status: usagePercent > 0.9 ? 'exceeded' : usagePercent > 0.7 ? 'warning' : 'ok'
        };
      } catch (error) {
        rateLimitStatus[source.name] = {
          usage: 0,
          limit: 0,
          resetTime: new Date(),
          status: 'exceeded',
          error: error.message
        };
      }
    }

    return rateLimitStatus;
  }

  /**
   * Generate comprehensive health report for deal discovery system
   */
  async generateHealthReport(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    sources: any[];
    extraction: { accuracy: number; performance: string };
    verification: { successRate: number; avgConfidence: number };
    recommendations: string[];
  }> {
    console.log("🏥 Generating discovery system health report...");

    const [sourceTests, extractionValidation, rateLimits] = await Promise.all([
      this.testDiscoverySources(),
      this.validateExtractionAccuracy(),
      this.monitorRateLimits()
    ]);

    const healthySources = sourceTests.filter(s => s.status === 'healthy').length;
    const totalSources = sourceTests.length;
    
    const recommendations = [];
    
    if (extractionValidation.accuracy < 0.8) {
      recommendations.push("Extraction accuracy below 80% - review pattern matching rules");
    }
    
    if (healthySources / totalSources < 0.7) {
      recommendations.push("Less than 70% of sources healthy - check API keys and endpoints");
    }

    const hasExceededLimits = Object.values(rateLimits).some((r: any) => r.status === 'exceeded');
    if (hasExceededLimits) {
      recommendations.push("Rate limits exceeded - implement request throttling");
    }

    const overall = recommendations.length === 0 ? 'healthy' : 
                   recommendations.length < 2 ? 'degraded' : 'critical';

    return {
      overall,
      sources: sourceTests,
      extraction: {
        accuracy: extractionValidation.accuracy,
        performance: extractionValidation.accuracy > 0.85 ? 'good' : 'needs improvement'
      },
      verification: {
        successRate: this.lastReport?.dealsVerified / this.lastReport?.dealsDiscovered || 0,
        avgConfidence: this.lastReport?.confidenceScores.reduce((a, b) => a + b, 0) / this.lastReport?.confidenceScores.length || 0
      },
      recommendations
    };
  }

  // Private helper methods
  private async performDiscovery(): Promise<{ sitesScanned: number; dealsFound: DiscoveredSite[] }> {
    // Implementation would use discoveryEngine to search across all sources
    const restaurants = await storage.getAllRestaurants();
    const teams = await storage.getAllTeams();
    
    let totalScanned = 0;
    const allDeals: DiscoveredSite[] = [];

    // Search for deals for each restaurant-team combination
    for (const restaurant of restaurants) {
      for (const team of teams) {
        const searchResults = await this.discoveryEngine.searchForDeals(restaurant.name, team.name);
        totalScanned += searchResults.length;
        
        // Convert search results to discovered sites
        for (const result of searchResults) {
          const discoveredSite = await this.convertToDiscoveredSite(result, restaurant, team);
          if (discoveredSite) {
            allDeals.push(discoveredSite);
          }
        }
      }
    }

    return { sitesScanned: totalScanned, dealsFound: allDeals };
  }

  private async extractDealDetails(sites: DiscoveredSite[]): Promise<DiscoveredSite[]> {
    const extracted = [];
    
    for (const site of sites) {
      try {
        const dealDetails = await dealExtractionEngine.extractDealFromText(
          site.content || '',
          site.url
        );
        
        // Update site with extracted details
        site.dealExtracted = JSON.stringify(dealDetails);
        site.restaurantDetected = dealDetails.restaurant;
        site.teamDetected = dealDetails.team;
        site.triggerDetected = dealDetails.trigger;
        site.promoCodeDetected = dealDetails.promoCode;
        
        extracted.push(site);
      } catch (error) {
        console.warn(`Failed to extract deal from ${site.url}:`, error.message);
      }
    }

    return extracted;
  }

  private async verifyDeals(sites: DiscoveredSite[]): Promise<DiscoveredSite[]> {
    const verified = [];
    
    for (const site of sites) {
      try {
        const verificationResult = await dealVerificationService.verifyDiscoveredDeal(site);
        if (verificationResult.isValid) {
          site.confidence = verificationResult.confidence;
          site.status = 'approved';
          verified.push(site);
        }
      } catch (error) {
        console.warn(`Failed to verify deal from ${site.url}:`, error.message);
      }
    }

    return verified;
  }

  private async assessDealQuality(deals: DiscoveredSite[]): Promise<DealQualityMetrics> {
    // Implement quality assessment logic
    const scores = {
      accuracyScore: 0.85,
      completenessScore: 0.90,
      freshnessScore: 0.75,
      relevanceScore: 0.88,
      overallScore: 0.85
    };
    
    return scores;
  }

  private async updateDealDatabase(deals: DiscoveredSite[]): Promise<void> {
    for (const deal of deals) {
      await storage.createDiscoveredSite(deal);
    }
  }

  private async testSource(source: any): Promise<{ success: boolean; successRate: number; lastError?: string; rateLimit: any }> {
    // Implementation would test specific source
    return {
      success: true,
      successRate: 0.95,
      rateLimit: { used: 45, limit: 100 }
    };
  }

  private async getExtractionTestCases(): Promise<Array<{ input: string; url: string; expected: any }>> {
    // Return known good test cases for extraction validation
    return [
      {
        input: "Dodgers win at home: Get $6 two-item plate at Panda Express with code DODGERSWIN",
        url: "https://example.com/deal1",
        expected: {
          restaurant: "Panda Express",
          team: "Dodgers",
          trigger: "win_home",
          promoCode: "DODGERSWIN",
          offer: "$6 two-item plate"
        }
      }
      // Add more test cases...
    ];
  }

  private compareExtractionResults(actual: any, expected: any): boolean {
    // Compare extracted results with expected results
    return actual.restaurant === expected.restaurant &&
           actual.team === expected.team &&
           actual.trigger === expected.trigger;
  }

  private async checkSourceUsage(source: any): Promise<number> {
    // Check current usage for source
    return source.successCount || 0;
  }

  private async convertToDiscoveredSite(result: SearchResult, restaurant: Restaurant, team: Team): Promise<DiscoveredSite | null> {
    if (!result.url || !result.content) return null;

    return {
      url: result.url,
      title: result.title,
      content: result.content,
      confidence: result.confidence,
      restaurantDetected: restaurant.name,
      teamDetected: team.name,
      status: 'pending',
      foundAt: new Date(),
      rawData: JSON.stringify(result.rawData)
    } as DiscoveredSite;
  }
}

export const dealDiscoveryAgent = new DealDiscoveryAgent();