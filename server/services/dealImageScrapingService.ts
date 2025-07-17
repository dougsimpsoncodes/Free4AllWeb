import { storage } from "../storage";
import type { Promotion, Restaurant, Team } from "@shared/schema";
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

interface DealImageSource {
  url: string;
  imageUrl: string;
  description: string;
  promoCode?: string;
  validUntil?: Date;
  restaurant: string;
  teamMentioned: string[];
}

interface DiscoveredDeal {
  id: string;
  restaurantName: string;
  teamName: string;
  dealText: string;
  promoCode?: string;
  sourceUrl: string;
  triggerCondition?: string;
  validUntil?: Date;
  confidence: number; // 0-1 score for how likely this is a valid sports deal
  status: 'pending' | 'approved' | 'rejected';
  discoveredAt: Date;
  approvedImagePath?: string; // Path to manually uploaded/selected image
}

class DealDiscoveryService {
  
  // Common sources where restaurants post sports deals
  private dealSources = {
    twitter: {
      mcdonalds: ['@McDonalds', '@McDonaldsLA'],
      pandaExpress: ['@PandaExpress', '@PandaExpressLA'], 
      jackInTheBox: ['@JackBox', '@JackBoxLA'],
      delTaco: ['@DelTaco', '@DelTacoLA'],
      ampm: ['@ampm', '@ampmLA']
    },
    instagram: {
      mcdonalds: ['mcdonalds', 'mcdonaldsla'],
      pandaExpress: ['pandaexpress', 'pandaexpressla'],
      jackInTheBox: ['jackinthebox', 'jackboxtacos'],
      delTaco: ['deltaco', 'deltacola'],
      ampm: ['ampm', 'ampmenergy']
    },
    websites: {
      mcdonalds: 'https://www.mcdonalds.com/us/en-us/deals.html',
      pandaExpress: 'https://www.pandaexpress.com/deals',
      jackInTheBox: 'https://www.jackinthebox.com/deals',
      delTaco: 'https://www.deltaco.com/deals',
      ampm: 'https://www.ampm.com/deals'
    }
  };

  async discoverAllDeals(): Promise<DiscoveredDeal[]> {
    const restaurants = await storage.getActiveRestaurants();
    const teams = await storage.getActiveTeams();
    
    const discoveredDeals: DiscoveredDeal[] = [];
    
    for (const restaurant of restaurants) {
      try {
        console.log(`🔍 Discovering deals for ${restaurant.name}...`);
        
        // Discover from multiple sources
        const websiteDeals = await this.scrapeRestaurantWebsite(restaurant);
        const socialDeals = await this.scrapeSocialMedia(restaurant, teams);
        
        // Combine and validate deals
        const restaurantDeals = [...websiteDeals, ...socialDeals];
        
        // Filter for sports-related content and convert to DiscoveredDeal format
        for (const dealSource of restaurantDeals) {
          if (this.isSportsRelated(dealSource, teams)) {
            const matchingTeams = teams.filter(team => 
              dealSource.teamMentioned.some(mention => 
                mention.toLowerCase().includes(team.name.toLowerCase()) ||
                mention.toLowerCase().includes(team.abbreviation.toLowerCase())
              )
            );
            
            for (const team of matchingTeams) {
              discoveredDeals.push({
                id: this.generateDealId(dealSource, team),
                restaurantName: restaurant.name,
                teamName: team.name,
                dealText: dealSource.description,
                promoCode: dealSource.promoCode,
                sourceUrl: dealSource.url,
                triggerCondition: this.extractTriggerCondition(dealSource.description),
                validUntil: dealSource.validUntil,
                confidence: this.calculateConfidenceScore(dealSource, team),
                status: 'pending',
                discoveredAt: new Date()
              });
            }
          }
        }
        
      } catch (error) {
        console.error(`Error discovering deals for ${restaurant.name}:`, error);
      }
    }
    
    return this.rankDealsByRelevance(discoveredDeals);
  }

  private async scrapeRestaurantWebsite(restaurant: Restaurant): Promise<DealImageSource[]> {
    const images: DealImageSource[] = [];
    
    try {
      // This would use a web scraping library like Puppeteer or Playwright
      // to navigate restaurant websites and extract promotional images
      
      const websiteUrl = this.dealSources.websites[restaurant.name.toLowerCase().replace(/[^a-z]/g, '')];
      if (!websiteUrl) return images;
      
      // Simulate scraping logic - in real implementation would use:
      // - Puppeteer to load the page
      // - Image detection algorithms
      // - Text extraction from images using OCR
      // - Pattern matching for sports terms
      
      console.log(`  📄 Scanning ${websiteUrl} for promotional images...`);
      
      // Mock seasonal deals (real implementation would scrape actual content)
      // These are typically yearly promotions that rotate by season
      if (restaurant.name === "McDonald's") {
        images.push({
          url: websiteUrl,
          imageUrl: '',
          description: 'Free 6pc McNuggets when Dodgers score 6+ runs at home',
          promoCode: 'DODGERS6',
          restaurant: restaurant.name,
          teamMentioned: ['Dodgers', 'LAD'],
          validUntil: new Date('2025-10-31') // End of baseball season
        });
      }
      
      if (restaurant.name === "Panda Express") {
        images.push({
          url: websiteUrl,
          imageUrl: '',
          description: '$6 Panda Plate for any Dodgers home win',
          promoCode: 'DODGERSWIN',
          restaurant: restaurant.name,
          teamMentioned: ['Dodgers', 'LAD'],
          validUntil: new Date('2025-10-31')
        });
      }
      
      // Lakers season deals (typically October - April)
      if (restaurant.name === "Jack in the Box") {
        images.push({
          url: websiteUrl,
          imageUrl: '',
          description: 'Free Jumbo Jack when Lakers win by 20+ points at home',
          promoCode: 'LAKERS20',
          restaurant: restaurant.name,
          teamMentioned: ['Lakers', 'LAL'],
          validUntil: new Date('2025-04-30')
        });
      }
      
    } catch (error) {
      console.error(`Website scraping failed for ${restaurant.name}:`, error);
    }
    
    return images;
  }

  private async scrapeSocialMedia(restaurant: Restaurant, teams: Team[]): Promise<DealImageSource[]> {
    const images: DealImageSource[] = [];
    
    try {
      // This would integrate with social media APIs:
      // - Twitter API v2 for tweet search
      // - Instagram Basic Display API
      // - Facebook Graph API
      
      const restaurantKey = restaurant.name.toLowerCase().replace(/[^a-z]/g, '');
      const socialAccounts = {
        twitter: this.dealSources.twitter[restaurantKey] || [],
        instagram: this.dealSources.instagram[restaurantKey] || []
      };
      
      console.log(`  📱 Scanning social media for ${restaurant.name}...`);
      
      // Search for recent posts mentioning team names
      for (const team of teams) {
        const searchTerms = [team.name, team.abbreviation, team.city];
        
        // Mock social media results
        // Real implementation would:
        // 1. Search tweets/posts containing team keywords
        // 2. Filter for promotional content
        // 3. Extract images from matching posts
        // 4. Use image recognition to identify food items
        
        // Seasonal social media promotions
        if (restaurant.name === "ampm" && team.name === "Dodgers") {
          images.push({
            url: 'https://instagram.com/ampm/post/12345',
            imageUrl: '',
            description: 'Free Hot Dog + Coke when Dodgers steal a base at home',
            promoCode: 'STEALBASE',
            restaurant: restaurant.name,
            teamMentioned: [team.name, team.abbreviation],
            validUntil: new Date('2025-10-31')
          });
        }
        
        // NFL season deals (typically September - February)
        if (restaurant.name === "Del Taco" && team.name === "Rams") {
          images.push({
            url: 'https://twitter.com/DelTaco/status/98765',
            imageUrl: '',
            description: 'Free Del Beef Taco for any Rams home win',
            promoCode: 'RAMSWIN',
            restaurant: restaurant.name,
            teamMentioned: [team.name, team.abbreviation],
            validUntil: new Date('2025-02-28')
          });
        }
      }
      
    } catch (error) {
      console.error(`Social media scraping failed for ${restaurant.name}:`, error);
    }
    
    return images;
  }

  private isSportsRelated(image: DealImageSource, teams: Team[]): boolean {
    const text = image.description.toLowerCase();
    
    // Check for team mentions
    for (const team of teams) {
      const teamTerms = [
        team.name.toLowerCase(),
        team.abbreviation.toLowerCase(),
        team.city.toLowerCase()
      ];
      
      if (teamTerms.some(term => text.includes(term))) {
        return true;
      }
    }
    
    // Check for sports-related keywords
    const sportsKeywords = [
      'win', 'score', 'runs', 'points', 'touchdown', 'goal',
      'game', 'victory', 'playoff', 'season', 'home game',
      'steal', 'strikeout', 'hit', 'basket', 'field goal'
    ];
    
    return sportsKeywords.some(keyword => text.includes(keyword));
  }

  private rankDealsByRelevance(deals: DiscoveredDeal[]): DiscoveredDeal[] {
    return deals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Top 20 most relevant deals
  }

  private generateDealId(dealSource: DealImageSource, team: Team): string {
    const hash = createHash('md5')
      .update(dealSource.description + team.name + dealSource.url)
      .digest('hex');
    return hash.substring(0, 12);
  }

  private extractTriggerCondition(description: string): string {
    const text = description.toLowerCase();
    
    if (text.includes('score') && text.includes('6')) return 'team_scores_6_plus';
    if (text.includes('home win') || text.includes('win at home')) return 'home_win';
    if (text.includes('steal') && text.includes('base')) return 'stolen_base_home';
    if (text.includes('any win') || text.includes('win')) return 'any_win';
    
    return 'unknown';
  }

  private calculateConfidenceScore(dealSource: DealImageSource, team: Team): number {
    let score = 0;
    
    const text = dealSource.description.toLowerCase();
    
    // Higher score for explicit promotional language
    if (text.includes('free')) score += 0.3;
    if (text.includes('deal') || text.includes('offer')) score += 0.2;
    if (text.includes('promo') || text.includes('code')) score += 0.2;
    
    // Higher score for specific team mentions
    const teamTerms = [team.name.toLowerCase(), team.abbreviation.toLowerCase()];
    if (teamTerms.some(term => text.includes(term))) score += 0.4;
    
    // Higher score for specific trigger conditions
    if (text.includes('score') || text.includes('runs')) score += 0.3;
    if (text.includes('win') || text.includes('victory')) score += 0.2;
    
    // Recency bonus (would check actual timestamp)
    score += 0.1; // Recent posts get bonus
    
    return Math.min(score, 1.0);
  }

  // Storage methods for discovered deals
  private discoveredDealsFile = path.join(process.cwd(), 'discovered-deals.json');

  async saveDiscoveredDeals(deals: DiscoveredDeal[]): Promise<void> {
    try {
      // Load existing deals
      let existingDeals: DiscoveredDeal[] = [];
      if (fs.existsSync(this.discoveredDealsFile)) {
        const data = fs.readFileSync(this.discoveredDealsFile, 'utf8');
        existingDeals = JSON.parse(data);
      }

      // Merge with new deals (avoid duplicates by ID)
      const existingIds = new Set(existingDeals.map(d => d.id));
      const newDeals = deals.filter(d => !existingIds.has(d.id));
      
      const allDeals = [...existingDeals, ...newDeals];
      
      fs.writeFileSync(this.discoveredDealsFile, JSON.stringify(allDeals, null, 2));
      console.log(`💾 Saved ${newDeals.length} new deals, ${allDeals.length} total`);
    } catch (error) {
      console.error('Failed to save discovered deals:', error);
    }
  }

  async getDiscoveredDeals(): Promise<DiscoveredDeal[]> {
    try {
      if (!fs.existsSync(this.discoveredDealsFile)) {
        return [];
      }
      const data = fs.readFileSync(this.discoveredDealsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load discovered deals:', error);
      return [];
    }
  }

  async approveDeal(dealId: string, imageAssetPath?: string): Promise<void> {
    const deals = await this.getDiscoveredDeals();
    const deal = deals.find(d => d.id === dealId);
    
    if (deal) {
      deal.status = 'approved';
      if (imageAssetPath) {
        deal.approvedImagePath = imageAssetPath;
      }
      
      fs.writeFileSync(this.discoveredDealsFile, JSON.stringify(deals, null, 2));
      console.log(`✅ Approved deal: ${deal.dealText}`);
    }
  }

  async rejectDeal(dealId: string): Promise<void> {
    const deals = await this.getDiscoveredDeals();
    const deal = deals.find(d => d.id === dealId);
    
    if (deal) {
      deal.status = 'rejected';
      fs.writeFileSync(this.discoveredDealsFile, JSON.stringify(deals, null, 2));
      console.log(`❌ Rejected deal: ${deal.dealText}`);
    }
  }
}

export const dealDiscoveryService = new DealDiscoveryService();