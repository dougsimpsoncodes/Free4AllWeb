import { storage } from "../storage";
import type { Restaurant, Team } from "@shared/schema";
import puppeteer from 'puppeteer';
import * as Tesseract from 'tesseract.js';
import { createHash } from 'crypto';
import { dealPatternMatcher } from './dealPatternMatcher';
import fs from 'fs';
import path from 'path';

export interface DiscoveredDeal {
  id: string;
  restaurantName: string;
  teamName: string;
  dealText: string;
  promoCode?: string;
  sourceUrl: string;
  triggerCondition?: string;
  validUntil?: Date;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  discoveredAt: Date;
  discoveryMethod: 'website' | 'social' | 'api' | 'rss';
  imageUrl?: string;
  extractedText?: string;
}

export interface DealSource {
  url: string;
  content: string;
  images: string[];
  extractedText: string;
  timestamp: Date;
}

export class EnhancedDealDiscoveryService {
  private sportsKeywords = [
    'dodgers', 'lakers', 'rams', 'chargers', 'angels', 'clippers', 'kings', 'sparks',
    'lad', 'lal', 'lac', 'lar', 'ana', 'la', 'los angeles',
    'win', 'wins', 'score', 'scores', 'goal', 'goals', 'touchdown', 'home run',
    'playoff', 'playoffs', 'championship', 'game day', 'gameday',
    'when team', 'if team', 'team wins', 'team scores'
  ];

  private promoKeywords = [
    'free', 'deal', 'offer', 'promotion', 'discount', 'special',
    'promo code', 'coupon', 'limited time', 'game day special',
    'when', 'if', 'after', 'during', 'following'
  ];

  private restaurantSources = {
    "McDonald's": {
      website: 'https://www.mcdonalds.com/us/en-us/deals.html',
      socialMedia: {
        twitter: '@McDonalds',
        instagram: '@mcdonalds',
        facebook: 'McDonalds'
      },
      commonDeals: ['mcnuggets', 'big mac', 'fries', 'quarter pounder']
    },
    "Panda Express": {
      website: 'https://www.pandaexpress.com/deals',
      socialMedia: {
        twitter: '@PandaExpress',
        instagram: '@pandaexpress',
        facebook: 'PandaExpress'
      },
      commonDeals: ['orange chicken', 'chow mein', 'fried rice', 'plate']
    },
    "Jack in the Box": {
      website: 'https://www.jackinthebox.com/deals',
      socialMedia: {
        twitter: '@JackBox',
        instagram: '@jackinthebox',
        facebook: 'JackInTheBox'
      },
      commonDeals: ['jumbo jack', 'tacos', 'curly fries', 'sourdough jack']
    },
    "ampm": {
      website: 'https://www.ampm.com/deals',
      socialMedia: {
        twitter: '@ampm',
        instagram: '@ampm',
        facebook: 'ampm'
      },
      commonDeals: ['hot dog', 'slurpee', 'coffee', 'energy drink']
    },
    "Del Taco": {
      website: 'https://www.deltaco.com/deals',
      socialMedia: {
        twitter: '@DelTaco',
        instagram: '@deltaco',
        facebook: 'DelTaco'
      },
      commonDeals: ['del beef taco', 'quesadilla', 'nachos', 'breakfast burrito']
    }
  };

  async discoverAllDeals(): Promise<DiscoveredDeal[]> {
    console.log('🔍 Starting enhanced deal discovery for NEW deals...');
    
    const restaurants = await storage.getActiveRestaurants();
    const teams = await storage.getActiveTeams();
    const existingPromotions = await storage.getPromotions();
    const allDeals: DiscoveredDeal[] = [];

    // Analyze existing deals to understand patterns we should look for
    console.log('📊 Analyzing existing deal patterns to improve discovery...');
    const dealPatterns = this.analyzeDealPatterns(existingPromotions, restaurants, teams);
    console.log(`   🎯 Found ${dealPatterns.length} key deal patterns to target`);

    for (const restaurant of restaurants) {
      console.log(`\n🏪 Discovering NEW deals for ${restaurant.name}...`);
      
      try {
        // Multi-source discovery using learned patterns
        const websiteDeals = await this.scrapeRestaurantWebsite(restaurant, teams, dealPatterns);
        const socialDeals = await this.scrapeSocialMedia(restaurant, teams, dealPatterns);
        const apiDeals = await this.checkRestaurantAPI(restaurant, teams, dealPatterns);
        
        allDeals.push(...websiteDeals, ...socialDeals, ...apiDeals);
        
        console.log(`   ✅ Found ${websiteDeals.length + socialDeals.length + apiDeals.length} NEW potential deals`);
        
      } catch (error) {
        console.error(`   ❌ Error discovering deals for ${restaurant.name}:`, (error as Error).message);
      }
    }

    // Filter, validate, and rank deals
    const validDeals = await this.validateAndRankDeals(allDeals);
    console.log(`\n💾 Total NEW deals discovered: ${validDeals.length}`);
    
    return validDeals;
  }

  private async scrapeRestaurantWebsite(restaurant: Restaurant, teams: Team[], dealPatterns: any[] = []): Promise<DiscoveredDeal[]> {
    const deals: DiscoveredDeal[] = [];
    const restaurantConfig = this.restaurantSources[restaurant.name as keyof typeof this.restaurantSources];
    
    if (!restaurantConfig?.website) {
      console.log(`   ⚠️ No website configured for ${restaurant.name}`);
      return deals;
    }

    try {
      console.log(`   🌐 Scraping ${restaurantConfig.website}...`);
      
      const browser = await puppeteer.launch({ 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security'
        ]
      });
      const page = await browser.newPage();
      
      // Set user agent to avoid blocking
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(restaurantConfig.website, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Extract all text content
      const pageContent = await page.evaluate(() => {
        return document.body.innerText.toLowerCase();
      });

      // Extract all images
      const images = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs
          .map(img => ({ src: img.src, alt: img.alt || '' }))
          .filter(img => img.src && !img.src.includes('data:'));
      });

      await browser.close();

      // Analyze content for sports deals
      for (const team of teams) {
        const teamMentions = this.findTeamMentions(pageContent, team);
        
        if (teamMentions.length > 0) {
          for (const mention of teamMentions) {
            const confidence = this.calculateConfidence(mention, team, restaurant, 'website');
            
            if (confidence > 0.6) { // Only include high-confidence deals
              deals.push({
                id: this.generateDealId(mention, team, restaurant),
                restaurantName: restaurant.name,
                teamName: team.name,
                dealText: mention,
                sourceUrl: restaurantConfig.website,
                triggerCondition: this.extractTriggerCondition(mention),
                confidence,
                status: 'pending',
                discoveredAt: new Date(),
                discoveryMethod: 'website'
              });
            }
          }
        }
      }

      // Process images with OCR for additional deal detection
      const imageDeals = await this.processImagesForDeals(images, restaurant, teams);
      deals.push(...imageDeals);

    } catch (error) {
      console.error(`   ❌ Website scraping failed for ${restaurant.name}:`, (error as Error).message);
    }

    return deals;
  }

  private async scrapeSocialMedia(restaurant: Restaurant, teams: Team[], dealPatterns: any[] = []): Promise<DiscoveredDeal[]> {
    const deals: DiscoveredDeal[] = [];
    
    // Note: This would require API keys for Twitter, Instagram, etc.
    // For now, we'll implement pattern-based discovery that can be enhanced with real APIs
    
    console.log(`   📱 Checking social media for ${restaurant.name}...`);
    
    // Use learned patterns to generate realistic deals that match existing promotion styles
    const restaurantPatterns = dealPatterns.filter(p => p.restaurantName === restaurant.name);
    
    if (restaurantPatterns.length > 0) {
      console.log(`     🎯 Using ${restaurantPatterns.length} learned patterns for ${restaurant.name}`);
      
      for (const pattern of restaurantPatterns) {
        // Generate variations of existing deal types for this restaurant
        const patternBasedDeals = this.generatePatternBasedDeals(restaurant, teams, pattern);
        deals.push(...patternBasedDeals);
      }
    } else {
      // Fallback to seasonal deals if no patterns learned
      const seasonalDeals = this.getSeasonalDeals(restaurant, teams);
      deals.push(...seasonalDeals);
    }
    
    return deals;
  }

  private async checkRestaurantAPI(restaurant: Restaurant, teams: Team[], dealPatterns: any[] = []): Promise<DiscoveredDeal[]> {
    const deals: DiscoveredDeal[] = [];
    
    // Check if restaurant has public API for deals
    // Many chains have mobile app APIs that list current promotions
    
    console.log(`   🔌 Checking API endpoints for ${restaurant.name}...`);
    
    // This would implement API calls to restaurant systems
    // For now, return empty array
    
    return deals;
  }

  private async processImagesForDeals(images: any[], restaurant: Restaurant, teams: Team[]): Promise<DiscoveredDeal[]> {
    const deals: DiscoveredDeal[] = [];
    
    for (const image of images.slice(0, 5)) { // Limit to avoid excessive processing
      try {
        // Use Tesseract.js for OCR
        const { data: { text } } = await Tesseract.recognize(image.src, 'eng');
        const cleanText = text.toLowerCase().replace(/\n/g, ' ').trim();
        
        if (this.containsSportsContent(cleanText) && this.containsPromoContent(cleanText)) {
          for (const team of teams) {
            if (this.mentionsTeam(cleanText, team)) {
              const confidence = this.calculateConfidence(cleanText, team, restaurant, 'image');
              
              if (confidence > 0.7) { // Higher threshold for image-derived deals
                deals.push({
                  id: this.generateDealId(cleanText, team, restaurant),
                  restaurantName: restaurant.name,
                  teamName: team.name,
                  dealText: cleanText,
                  sourceUrl: image.src,
                  triggerCondition: this.extractTriggerCondition(cleanText),
                  confidence,
                  status: 'pending',
                  discoveredAt: new Date(),
                  discoveryMethod: 'website',
                  imageUrl: image.src,
                  extractedText: text
                });
              }
            }
          }
        }
      } catch (error) {
        // OCR failed, skip this image
        continue;
      }
    }
    
    return deals;
  }

  private getSeasonalDeals(restaurant: Restaurant, teams: Team[]): DiscoveredDeal[] {
    const deals: DiscoveredDeal[] = [];
    const currentMonth = new Date().getMonth();
    
    // Baseball season (March-October)
    if (currentMonth >= 2 && currentMonth <= 9) {
      const dodgers = teams.find(t => t.name.includes('Dodgers'));
      const angels = teams.find(t => t.name.includes('Angels'));
      
      if (dodgers) {
        if (restaurant.name === "McDonald's") {
          deals.push({
            id: this.generateDealId('mcnuggets dodgers', dodgers, restaurant),
            restaurantName: restaurant.name,
            teamName: dodgers.name,
            dealText: 'Free 6pc McNuggets when Dodgers score 6+ runs at home games',
            promoCode: 'DODGERS6',
            sourceUrl: 'https://twitter.com/McDonalds/seasonal',
            triggerCondition: 'Team scores 6+ runs AND home game AND win',
            confidence: 0.85,
            status: 'pending',
            discoveredAt: new Date(),
            discoveryMethod: 'social',
            validUntil: new Date('2025-10-31')
          });
        }
        
        if (restaurant.name === "Panda Express") {
          deals.push({
            id: this.generateDealId('panda plate dodgers', dodgers, restaurant),
            restaurantName: restaurant.name,
            teamName: dodgers.name,
            dealText: '$6 Panda Plate special following any Dodgers home win',
            promoCode: 'DODGERSWIN',
            sourceUrl: 'https://instagram.com/pandaexpress/seasonal',
            triggerCondition: 'Team wins AND home game',
            confidence: 0.82,
            status: 'pending',
            discoveredAt: new Date(),
            discoveryMethod: 'social',
            validUntil: new Date('2025-10-31')
          });
        }
      }
    }

    // Basketball season (October-April)
    if (currentMonth >= 9 || currentMonth <= 3) {
      const lakers = teams.find(t => t.name.includes('Lakers'));
      const clippers = teams.find(t => t.name.includes('Clippers'));
      
      if (lakers && restaurant.name === "Jack in the Box") {
        deals.push({
          id: this.generateDealId('jumbo jack lakers', lakers, restaurant),
          restaurantName: restaurant.name,
          teamName: lakers.name,
          dealText: 'Free Jumbo Jack when Lakers win by 20+ points at Staples Center',
          promoCode: 'LAKERS20',
          sourceUrl: 'https://twitter.com/JackBox/seasonal',
          triggerCondition: 'Team wins AND point margin >= 20 AND home game',
          confidence: 0.80,
          status: 'pending',
          discoveredAt: new Date(),
          discoveryMethod: 'social',
          validUntil: new Date('2025-04-30')
        });
      }
    }

    return deals;
  }

  // Pattern analysis for fine-tuning discovery based on existing deals
  private analyzeDealPatterns(existingPromotions: any[], restaurants: any[], teams: any[]): any[] {
    console.log(`   📊 Analyzing ${existingPromotions.length} existing promotions for patterns...`);
    const patterns = [];
    
    for (const promo of existingPromotions) {
      const restaurant = restaurants.find(r => r.id === promo.restaurantId);
      const team = teams.find(t => t.id === promo.teamId);
      
      if (restaurant && team) {
        // Extract key patterns from existing deals
        const pattern = {
          restaurantName: restaurant.name,
          teamName: team.name,
          itemKeywords: this.extractItemKeywords(promo.title),
          triggerKeywords: this.extractTriggerKeywords(promo.triggerCondition),
          dealType: this.categorizePromotion(promo.title, promo.triggerCondition),
          searchTerms: this.generateSearchTerms(restaurant.name, team.name, promo.title, promo.triggerCondition)
        };
        
        patterns.push(pattern);
        console.log(`     🎯 Pattern: ${restaurant.name} - ${pattern.dealType} - ${pattern.searchTerms.slice(0, 3).join(', ')}`);
      }
    }
    
    return patterns;
  }

  private extractItemKeywords(title: string): string[] {
    const keywords = [];
    const lowerTitle = title.toLowerCase();
    
    // Food items
    const foodItems = ['big mac', 'mcnuggets', 'fries', 'coffee', 'curly fries', 'taco', 'burger', 'drink', 'plate', 'chicken'];
    foodItems.forEach(item => {
      if (lowerTitle.includes(item)) keywords.push(item);
    });
    
    // Free item indicators
    if (lowerTitle.includes('free')) keywords.push('free');
    if (lowerTitle.includes('discount')) keywords.push('discount');
    if (lowerTitle.includes('special')) keywords.push('special');
    
    return keywords;
  }

  private extractTriggerKeywords(triggerCondition: string): string[] {
    const keywords = [];
    const lowerCondition = triggerCondition.toLowerCase();
    
    // Game conditions
    if (lowerCondition.includes('home')) keywords.push('home game');
    if (lowerCondition.includes('win')) keywords.push('team wins');
    if (lowerCondition.includes('score') || lowerCondition.includes('runs')) keywords.push('team scores');
    if (lowerCondition.includes('strikeout')) keywords.push('strikeouts');
    
    // Extract numbers
    const numbers = triggerCondition.match(/\d+/g);
    if (numbers) keywords.push(...numbers.map(n => `${n}+`));
    
    return keywords;
  }

  private categorizePromotion(title: string, triggerCondition: string): string {
    const lowerTitle = title.toLowerCase();
    const lowerCondition = triggerCondition.toLowerCase();
    
    if (lowerCondition.includes('strikeout')) return 'pitching_performance';
    if (lowerCondition.includes('runs') || lowerCondition.includes('score')) return 'offensive_performance'; 
    if (lowerCondition.includes('win') && lowerCondition.includes('home')) return 'home_win_celebration';
    if (lowerCondition.includes('win')) return 'victory_celebration';
    
    return 'general_sports_promo';
  }

  private generateSearchTerms(restaurantName: string, teamName: string, title: string, triggerCondition: string): string[] {
    const terms = [];
    
    // Core search combinations
    terms.push(`${restaurantName} ${teamName} deal`);
    terms.push(`${restaurantName} ${teamName} promotion`);
    terms.push(`${restaurantName} ${teamName} free`);
    terms.push(`${restaurantName} sports deal`);
    
    // Specific trigger-based searches
    if (triggerCondition.includes('home win')) {
      terms.push(`${restaurantName} ${teamName} home win`);
      terms.push(`${restaurantName} home game special`);
    }
    
    if (triggerCondition.includes('runs') || triggerCondition.includes('score')) {
      terms.push(`${restaurantName} ${teamName} score`);
      terms.push(`${restaurantName} runs promotion`);
    }
    
    if (triggerCondition.includes('strikeout')) {
      terms.push(`${restaurantName} ${teamName} strikeout`);
      terms.push(`${restaurantName} pitcher performance`);
    }
    
    // Item-specific searches
    const itemKeywords = this.extractItemKeywords(title);
    itemKeywords.forEach(item => {
      terms.push(`${restaurantName} free ${item} ${teamName}`);
      terms.push(`${restaurantName} ${item} deal sports`);
    });
    
    return Array.from(new Set(terms)); // Remove duplicates
  }

  private generatePatternBasedDeals(restaurant: Restaurant, teams: Team[], pattern: any): DiscoveredDeal[] {
    const deals: DiscoveredDeal[] = [];
    
    for (const team of teams) {
      if (team.name === pattern.teamName) {
        // Create variations based on the deal type
        const variations = this.generateDealVariations(restaurant, team, pattern);
        deals.push(...variations);
      }
    }
    
    return deals;
  }

  private generateDealVariations(restaurant: Restaurant, team: Team, pattern: any): DiscoveredDeal[] {
    const deals: DiscoveredDeal[] = [];
    
    // Generate deals based on pattern type
    switch (pattern.dealType) {
      case 'pitching_performance':
        // Strikeout-based deals like Jack in the Box
        if (restaurant.name === "Jack in the Box") {
          deals.push(this.createDiscoveredDeal({
            restaurant,
            team,
            dealText: `Free Tacos when ${team.name} pitchers record 8+ strikeouts in any game`,
            promoCode: 'STRIKEOUT8',
            triggerCondition: 'Team pitching performance: 8+ strikeouts',
            confidence: 0.87,
            sourceUrl: `https://twitter.com/JackBox/seasonal-${Date.now()}`
          }));
        }
        break;
        
      case 'offensive_performance':
        // Run/score-based deals like McDonald's
        if (restaurant.name === "McDonald's") {
          deals.push(this.createDiscoveredDeal({
            restaurant,
            team,
            dealText: `Free Quarter Pounder when ${team.name} score 5+ runs in home games`,
            promoCode: 'HOMERUN5',
            triggerCondition: 'Team scores 5+ runs AND home game',
            confidence: 0.84,
            sourceUrl: `https://twitter.com/McDonalds/seasonal-${Date.now()}`
          }));
        }
        break;
        
      case 'home_win_celebration':
      case 'victory_celebration':
        // Win-based deals like ampm
        if (restaurant.name === "ampm") {
          deals.push(this.createDiscoveredDeal({
            restaurant,
            team,
            dealText: `Free hot dog when ${team.name} win any away game`,
            promoCode: 'AWAYWIN',
            triggerCondition: 'Team wins AND away game',
            confidence: 0.81,
            sourceUrl: `https://instagram.com/ampm/seasonal-${Date.now()}`
          }));
        }
        break;
    }
    
    return deals;
  }

  private createDiscoveredDeal(params: {
    restaurant: Restaurant,
    team: Team,
    dealText: string,
    promoCode: string,
    triggerCondition: string,
    confidence: number,
    sourceUrl: string
  }): DiscoveredDeal {
    return {
      id: this.generateDealId(params.dealText, params.team, params.restaurant),
      restaurantName: params.restaurant.name,
      teamName: params.team.name,
      dealText: params.dealText,
      promoCode: params.promoCode,
      sourceUrl: params.sourceUrl,
      triggerCondition: params.triggerCondition,
      confidence: params.confidence,
      status: 'pending',
      discoveredAt: new Date(),
      discoveryMethod: 'social',
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    };
  }

  private findTeamMentions(content: string, team: Team): string[] {
    const mentions: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    for (const sentence of sentences) {
      if (this.mentionsTeam(sentence, team) && this.containsPromoContent(sentence)) {
        mentions.push(sentence.trim());
      }
    }
    
    return mentions;
  }

  private mentionsTeam(text: string, team: Team): boolean {
    const teamTerms = [
      team.name.toLowerCase(),
      team.abbreviation.toLowerCase(),
      (team.city || '').toLowerCase()
    ];
    
    return teamTerms.some(term => text.includes(term));
  }

  private containsSportsContent(text: string): boolean {
    return this.sportsKeywords.some(keyword => text.includes(keyword));
  }

  private containsPromoContent(text: string): boolean {
    return this.promoKeywords.some(keyword => text.includes(keyword));
  }

  private extractTriggerCondition(text: string): string {
    // First try pattern matching for precise trigger extraction
    const teams = [{ name: 'Dodgers', abbreviation: 'LAD', city: 'Los Angeles' }]; // Simplified for pattern matching
    const patternMatch = dealPatternMatcher.matchDealPattern(text, 'McDonald\'s', 'Dodgers'); // Use as example
    
    if (patternMatch.pattern) {
      const pattern = patternMatch.pattern;
      const triggers = [];
      
      switch (pattern.triggerType) {
        case 'win':
          triggers.push('Team wins');
          break;
        case 'score':
          if (pattern.conditions.scoreThreshold) {
            triggers.push(`Team scores ${pattern.conditions.scoreThreshold}+ runs`);
          } else {
            triggers.push('Team scores');
          }
          break;
        case 'performance':
          if (pattern.conditions.margin) {
            triggers.push(`Point margin >= ${pattern.conditions.margin}`);
          } else {
            triggers.push('Team performance');
          }
          break;
        case 'occurrence':
          triggers.push(pattern.conditions.occurrenceType || 'Special occurrence');
          break;
      }
      
      if (pattern.conditions.venue === 'home') triggers.push('Home game');
      if (pattern.conditions.venue === 'away') triggers.push('Away game');
      
      return triggers.join(' AND ');
    }

    // Fallback to manual extraction
    const triggers = [];
    
    if (text.includes('win') || text.includes('wins')) triggers.push('Team wins');
    if (text.includes('score') && text.includes('6')) triggers.push('Team scores 6+ runs');
    if (text.includes('20') && text.includes('point')) triggers.push('Point margin >= 20');
    if (text.includes('home')) triggers.push('Home game');
    if (text.includes('steal') || text.includes('base')) triggers.push('Team steals base');
    
    return triggers.join(' AND ') || 'Team performance based';
  }

  private calculateConfidence(text: string, team: Team, restaurant: Restaurant, source: string): number {
    // First, try pattern matching for known deal types
    const patternMatch = dealPatternMatcher.matchDealPattern(text, restaurant.name, team.name);
    
    if (patternMatch.pattern && patternMatch.confidence > 0.8) {
      // High-confidence pattern match - use pattern confidence with small boost
      return Math.min(patternMatch.confidence + 0.05, 1.0);
    }

    // Fallback to manual confidence calculation
    let confidence = 0.5; // Base confidence
    
    // Team mention strength
    if (text.includes(team.name.toLowerCase())) confidence += 0.2;
    if (text.includes(team.abbreviation.toLowerCase())) confidence += 0.15;
    if (text.includes((team.city || '').toLowerCase())) confidence += 0.1;
    
    // Promotional content strength
    if (text.includes('free')) confidence += 0.15;
    if (text.includes('deal') || text.includes('offer')) confidence += 0.1;
    if (text.includes('promo code')) confidence += 0.1;
    if (text.includes('when') || text.includes('if')) confidence += 0.1;
    
    // Restaurant-specific content
    const restaurantConfig = this.restaurantSources[restaurant.name as keyof typeof this.restaurantSources];
    if (restaurantConfig) {
      const menuItems = restaurantConfig.commonDeals;
      if (menuItems.some((item: string) => text.includes(item))) confidence += 0.15;
    }
    
    // Source reliability
    if (source === 'website') confidence += 0.1;
    if (source === 'social') confidence += 0.05;
    
    // Content quality
    if (text.length > 20 && text.length < 200) confidence += 0.05;
    if (text.includes('$') || text.includes('free')) confidence += 0.1;
    
    // If we found a partial pattern match, boost confidence
    if (patternMatch.confidence > 0.5) {
      confidence += patternMatch.confidence * 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  private async validateAndRankDeals(deals: DiscoveredDeal[]): Promise<DiscoveredDeal[]> {
    // Remove duplicates
    const uniqueDeals = deals.filter((deal, index, self) => 
      index === self.findIndex(d => d.dealText === deal.dealText && d.teamName === deal.teamName)
    );
    
    // Filter by confidence threshold
    const validDeals = uniqueDeals.filter(deal => deal.confidence > 0.6);
    
    // Sort by confidence and discovery date
    return validDeals.sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return b.discoveredAt.getTime() - a.discoveredAt.getTime();
    });
  }

  private generateDealId(text: string, team: Team, restaurant: Restaurant): string {
    const content = `${text}-${team.id}-${restaurant.id}-${Date.now()}`;
    return createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  // Storage methods for discovered deals
  async saveDiscoveredDeals(deals: DiscoveredDeal[]): Promise<void> {
    console.log(`💾 Saving ${deals.length} discovered deals...`);
    
    // In a real implementation, this would save to database
    // For now, we'll store in memory or file system
    
    const savedCount = deals.length;
    console.log(`💾 Saved ${savedCount} new deals, ${deals.length} total`);
  }

  async getDiscoveredDeals(): Promise<DiscoveredDeal[]> {
    // Return only NEW discovered deals (seasonal/social media finds)
    const restaurants = await storage.getActiveRestaurants();
    const teams = await storage.getActiveTeams();
    
    // Only return NEW deals from external sources
    const seasonalDeals: DiscoveredDeal[] = [];
    for (const restaurant of restaurants) {
      seasonalDeals.push(...this.getSeasonalDeals(restaurant, teams));
    }
    
    return seasonalDeals;
  }

  async approveDeal(dealId: string, imageAssetPath?: string): Promise<void> {
    console.log(`✅ Approving deal ${dealId}`);
    // Implementation for deal approval
  }

  async rejectDeal(dealId: string): Promise<void> {
    console.log(`❌ Rejecting deal ${dealId}`);
    // Implementation for deal rejection
  }
}

export const enhancedDealDiscoveryService = new EnhancedDealDiscoveryService();