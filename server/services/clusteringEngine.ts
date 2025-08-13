import { db } from "../supabaseDb";
import { discoveredSites, discoverySources } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

export interface ClusterResult {
  clusterId: string;
  sites: Array<{
    id: number;
    url: string;
    title: string;
    contentHash: string;
    confidence: number;
    source: string;
  }>;
  combinedConfidence: number;
  evidenceCount: number;
}

export class ClusteringEngine {
  
  /**
   * Group discovered sites by content similarity and merge duplicates
   */
  async clusterDiscoveries(teamName: string, sport: string): Promise<ClusterResult[]> {
    console.log(`🔍 Starting clustering for ${teamName} ${sport} discoveries...`);
    
    // Get all pending discovered sites for the team/sport
    const sites = await db
      .select()
      .from(discoveredSites)
      .where(
        and(
          eq(discoveredSites.teamDetected, teamName),
          eq(discoveredSites.sport, sport),
          eq(discoveredSites.status, "pending")
        )
      );

    if (sites.length === 0) {
      console.log("No pending sites found for clustering");
      return [];
    }

    console.log(`Found ${sites.length} sites to cluster`);

    // Group by content similarity
    const clusters = this.groupByContentSimilarity(sites);
    
    // Calculate combined confidence for each cluster
    const clusterResults: ClusterResult[] = clusters.map(cluster => {
      const combinedConfidence = this.calculateClusterConfidence(cluster);
      
      return {
        clusterId: this.generateClusterId(cluster),
        sites: cluster.map(site => ({
          id: site.id,
          url: site.url,
          title: site.title || "Untitled",
          contentHash: this.generateContentHash(site.title, site.description),
          confidence: site.confidenceScore || 0,
          source: this.extractDomain(site.url)
        })),
        combinedConfidence,
        evidenceCount: cluster.length
      };
    });

    // Sort by combined confidence (highest first)
    clusterResults.sort((a, b) => b.combinedConfidence - a.combinedConfidence);

    console.log(`✅ Created ${clusterResults.length} clusters from ${sites.length} sites`);
    return clusterResults;
  }

  /**
   * Detect and merge duplicate discoveries across sources
   */
  async detectDuplicates(siteIds: number[]): Promise<{
    duplicateGroups: number[][];
    mergeRecommendations: Array<{
      primarySiteId: number;
      duplicateIds: number[];
      reason: string;
    }>;
  }> {
    console.log(`🔍 Detecting duplicates among ${siteIds.length} sites...`);

    const sites = await db
      .select()
      .from(discoveredSites)
      .where(sql`${discoveredSites.id} = ANY(${siteIds})`);

    const duplicateGroups: number[][] = [];
    const mergeRecommendations = [];
    const processed = new Set<number>();

    for (const site of sites) {
      if (processed.has(site.id)) continue;

      const duplicates = sites.filter(other => 
        other.id !== site.id && 
        !processed.has(other.id) &&
        this.areDuplicates(site, other)
      );

      if (duplicates.length > 0) {
        const group = [site.id, ...duplicates.map(d => d.id)];
        duplicateGroups.push(group);
        
        // Mark all as processed
        group.forEach(id => processed.add(id));

        // Recommend merge (highest confidence becomes primary)
        const allSites = [site, ...duplicates];
        const primary = allSites.reduce((best, current) => 
          (current.confidenceScore || 0) > (best.confidenceScore || 0) ? current : best
        );
        
        mergeRecommendations.push({
          primarySiteId: primary.id,
          duplicateIds: group.filter(id => id !== primary.id),
          reason: this.getDuplicationReason(site, duplicates[0])
        });
      }
    }

    console.log(`✅ Found ${duplicateGroups.length} duplicate groups`);
    return { duplicateGroups, mergeRecommendations };
  }

  /**
   * Apply confidence scoring formula
   */
  calculateConfidenceScore(site: {
    url: string;
    title?: string | null;
    description?: string | null;
    discoveredAt: Date | null;
  }): number {
    const domain = this.extractDomain(site.url);
    
    // Source authority (50%)
    const sourceAuthority = this.getSourceAuthority(domain);
    
    // Season freshness (20%) - within last 6 months = 1.0
    const seasonFreshness = site.discoveredAt ? 
      Math.max(0, 1 - (Date.now() - site.discoveredAt.getTime()) / (180 * 24 * 60 * 60 * 1000)) : 0.5;
    
    // Text certainty (20%) - presence of trigger words and numbers
    const textCertainty = this.calculateTextCertainty(site.title, site.description);
    
    // Cross-source agreement (10%) - will be calculated later when clustering
    const crossSourceAgreement = 0.5; // Default, updated during clustering
    
    const confidence = (
      sourceAuthority * 0.5 +
      seasonFreshness * 0.2 +
      textCertainty * 0.2 +
      crossSourceAgreement * 0.1
    );

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  private groupByContentSimilarity(sites: any[]): any[][] {
    const clusters: any[][] = [];
    const processed = new Set<number>();

    for (const site of sites) {
      if (processed.has(site.id)) continue;

      const cluster = [site];
      processed.add(site.id);

      // Find similar sites
      for (const other of sites) {
        if (other.id !== site.id && !processed.has(other.id)) {
          if (this.areContentSimilar(site, other)) {
            cluster.push(other);
            processed.add(other.id);
          }
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private areContentSimilar(site1: any, site2: any): boolean {
    const hash1 = this.generateContentHash(site1.title, site1.description);
    const hash2 = this.generateContentHash(site2.title, site2.description);
    
    // Use Hamming distance for similarity (for demonstration - could use more sophisticated similarity)
    const similarity = this.calculateHashSimilarity(hash1, hash2);
    return similarity > 0.8; // 80% similarity threshold
  }

  private areDuplicates(site1: any, site2: any): boolean {
    // Same URL (normalized)
    if (this.normalizeURL(site1.url) === this.normalizeURL(site2.url)) {
      return true;
    }

    // Very similar content
    const contentSimilarity = this.areContentSimilar(site1, site2);
    const sameDomain = this.extractDomain(site1.url) === this.extractDomain(site2.url);
    
    return contentSimilarity && sameDomain;
  }

  private calculateClusterConfidence(cluster: any[]): number {
    if (cluster.length === 1) {
      return this.calculateConfidenceScore(cluster[0]);
    }

    // Average confidence with cross-source agreement boost
    const avgConfidence = cluster.reduce((sum, site) => 
      sum + this.calculateConfidenceScore(site), 0) / cluster.length;
    
    // Boost for multiple sources (up to 20% boost)
    const crossSourceBoost = Math.min(0.2, (cluster.length - 1) * 0.05);
    
    return Math.min(1.0, avgConfidence + crossSourceBoost);
  }

  private generateContentHash(title?: string | null, description?: string | null): string {
    const content = `${title || ""} ${description || ""}`
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .replace(/\s+/g, " ")    // Normalize whitespace
      .trim();
    
    return crypto.createHash("md5").update(content).digest("hex");
  }

  private generateClusterId(cluster: any[]): string {
    const urls = cluster.map(site => site.url).sort();
    const combinedUrl = urls.join("|");
    return crypto.createHash("md5").update(combinedUrl).digest("hex").substring(0, 8);
  }

  private normalizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove common tracking parameters
      const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "ref", "src"];
      paramsToRemove.forEach(param => parsed.searchParams.delete(param));
      
      return parsed.origin + parsed.pathname + (parsed.search || "");
    } catch {
      return url.toLowerCase().trim();
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "unknown";
    }
  }

  private getSourceAuthority(domain: string): number {
    const DOMAIN_AUTHORITY: Record<string, number> = {
      // Tier 1 - Official (0.9-1.0)
      "dodgers.com": 1.0,
      "mcdonalds.com": 1.0,
      "mlb.com": 0.9,
      
      // Tier 2 - Social (0.5-0.7)
      "reddit.com": 0.6,
      "x.com": 0.5,
      "twitter.com": 0.5,
      "facebook.com": 0.5,
      
      // Tier 3 - Deal Aggregators (0.4-0.6)
      "slickdeals.net": 0.6,
      "retailmenot.com": 0.5,
      "groupon.com": 0.4,
      "yelp.com": 0.4,
      
      // Tier 4 - News/Community (0.3-0.5)
      "latimes.com": 0.5,
      "espn.com": 0.5
    };

    return DOMAIN_AUTHORITY[domain] || 0.3; // Default for unknown domains
  }

  private calculateTextCertainty(title?: string | null, description?: string | null): number {
    const text = `${title || ""} ${description || ""}`.toLowerCase();
    
    let score = 0;
    
    // Trigger words (40%)
    const triggerWords = ["free", "promotion", "deal", "discount", "runs", "score", "win", "home run"];
    const foundTriggers = triggerWords.filter(word => text.includes(word)).length;
    score += (foundTriggers / triggerWords.length) * 0.4;
    
    // Numbers/thresholds (30%)
    const hasNumbers = /\d+/.test(text);
    const hasOperators = /(\+|>=|≥|or more|at least)/.test(text);
    if (hasNumbers) score += 0.2;
    if (hasOperators) score += 0.1;
    
    // Restaurant mentions (20%)
    const restaurants = ["mcdonald", "taco bell", "pizza", "burger", "subway"];
    const hasRestaurant = restaurants.some(restaurant => text.includes(restaurant));
    if (hasRestaurant) score += 0.2;
    
    // Team mentions (10%)
    const teams = ["dodgers", "angels", "lakers", "clippers"];
    const hasTeam = teams.some(team => text.includes(team));
    if (hasTeam) score += 0.1;
    
    return Math.min(1.0, score);
  }

  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 0;
    
    let matches = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    
    return matches / hash1.length;
  }

  private getDuplicationReason(site1: any, site2: any): string {
    if (this.normalizeURL(site1.url) === this.normalizeURL(site2.url)) {
      return "Identical URL";
    }
    
    if (this.extractDomain(site1.url) === this.extractDomain(site2.url)) {
      return "Same domain, similar content";
    }
    
    return "Similar content across sources";
  }
}