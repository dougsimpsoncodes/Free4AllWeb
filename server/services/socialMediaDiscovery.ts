// Enhanced social media discovery engine for finding promotional deals
import { storage } from '../storage';

interface SocialMediaPost {
  id: string;
  platform: string;
  url: string;
  content: string;
  author: string;
  createdAt: Date;
  engagement: number;
  hashtags: string[];
  mentions: string[];
  urls: string[];
}

interface DiscoveryResult {
  url: string;
  title: string;
  content: string;
  confidence: number;
  source: string;
  platform: string;
  keywords: string[];
}

export class SocialMediaDiscoveryEngine {
  
  // Twitter/X API integration (requires API keys)
  async searchTwitter(query: string, maxResults: number = 20): Promise<DiscoveryResult[]> {
    console.log(`Searching Twitter for: ${query}`);
    
    try {
      // This would use Twitter API v2 with bearer token
      // For now, we'll simulate the search patterns you used manually
      const results: DiscoveryResult[] = [];
      
      // Simulate finding promotional tweets about Dodgers + restaurant deals
      const twitterSearchQueries = [
        `${query} promo`,
        `${query} deal`,
        `${query} free`,
        `${query} discount`,
        `${query} offer`,
        `${query} win`,
        `${query} home game`,
        `${query} promotion`
      ];
      
      // In a real implementation, this would make actual API calls
      // For now, return simulated high-quality results
      console.log(`Would search Twitter with queries: ${twitterSearchQueries.join(', ')}`);
      
      return results;
    } catch (error) {
      console.error('Error searching Twitter:', error);
      return [];
    }
  }

  // Enhanced Google search with social media focus - exactly like your manual X search
  async searchSocialMediaMentions(restaurantName: string, teamName: string = 'Dodgers'): Promise<DiscoveryResult[]> {
    console.log(`Searching for social media mentions: ${restaurantName} + ${teamName}`);
    
    const results: DiscoveryResult[] = [];
    
    // Generate targeted search queries exactly like you used manually: "dodgers panda express"
    const baseQuery = `${teamName.toLowerCase()} ${restaurantName.toLowerCase().replace(/[^a-z\s]/g, '')}`;
    
    const searchQueries = [
      // Your exact manual approach
      baseQuery, // "dodgers panda express" - the search that found the deal!
      `${baseQuery} promo`,
      `${baseQuery} deal`,
      `${baseQuery} free`,
      `${baseQuery} win`,
      `${baseQuery} promotion`,
      `${baseQuery} offer`,
      
      // Twitter/X focused searches (where you found the deal)
      `site:twitter.com ${baseQuery}`,
      `site:x.com ${baseQuery}`,
      `site:twitter.com "${restaurantName}" "${teamName}"`,
      `site:x.com "${restaurantName}" "${teamName}"`,
      
      // Direct promotional page searches
      `site:${this.getRestaurantDomain(restaurantName)} ${teamName}`,
      `"${restaurantName}/promo" ${teamName}`,
      `"${restaurantName}" promo code ${teamName}`,
      
      // Social media platform searches
      `site:facebook.com "${restaurantName}" "${teamName}"`,
      `site:instagram.com "${restaurantName}" "${teamName}"`,
      `site:reddit.com "${restaurantName}" "${teamName}" deal`,
      
      // Specific promotional language
      `"${restaurantName}" when ${teamName} win`,
      `"${restaurantName}" ${teamName} home game`,
      `"${restaurantName}" ${teamName} victory`,
    ];

    for (const query of searchQueries) {
      try {
        const searchResults = await this.performGoogleSearch(query, 10);
        results.push(...searchResults);
      } catch (error) {
        console.error(`Error searching for: ${query}`, error);
      }
    }

    return this.deduplicateAndRank(results);
  }

  // Perform actual Google Custom Search API call
  private async performGoogleSearch(query: string, maxResults: number = 10): Promise<DiscoveryResult[]> {
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) {
      console.log('Google API credentials not available');
      return [];
    }

    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=${maxResults}`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (!data.items) {
        return [];
      }

      return data.items.map((item: any) => ({
        url: item.link,
        title: item.title,
        content: item.snippet || '',
        confidence: this.calculateSocialMediaConfidence(item, query),
        source: 'Google Custom Search',
        platform: this.detectPlatform(item.link),
        keywords: this.extractKeywords(item.title + ' ' + item.snippet)
      }));

    } catch (error) {
      console.error('Error performing Google search:', error);
      return [];
    }
  }

  // Calculate confidence score for social media results
  private calculateSocialMediaConfidence(item: any, query: string): number {
    let confidence = 0.3; // Base confidence

    const titleLower = (item.title || '').toLowerCase();
    const snippetLower = (item.snippet || '').toLowerCase();
    const urlLower = (item.link || '').toLowerCase();
    const combinedText = titleLower + ' ' + snippetLower + ' ' + urlLower;

    // Higher confidence for official restaurant domains
    if (urlLower.includes('pandaexpress.com') || 
        urlLower.includes('mcdonalds.com') || 
        urlLower.includes('jackinthebox.com')) {
      confidence += 0.4;
    }

    // Higher confidence for promo/deal pages
    if (urlLower.includes('/promo') || urlLower.includes('/deal') || urlLower.includes('/offer')) {
      confidence += 0.3;
    }

    // Promotional keywords
    const promoKeywords = ['promo', 'deal', 'free', 'discount', 'offer', 'special', 'win', 'game'];
    const foundKeywords = promoKeywords.filter(keyword => combinedText.includes(keyword));
    confidence += foundKeywords.length * 0.05;

    // Team-specific keywords
    if (combinedText.includes('dodgers') || combinedText.includes('la dodgers')) {
      confidence += 0.15;
    }

    // Social media engagement indicators
    if (combinedText.includes('retweet') || combinedText.includes('share') || combinedText.includes('follow')) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  // Detect social media platform from URL
  private detectPlatform(url: string): string {
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
    if (url.includes('facebook.com')) return 'Facebook';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('tiktok.com')) return 'TikTok';
    return 'Website';
  }

  // Extract relevant keywords from content
  private extractKeywords(text: string): string[] {
    const keywords = text.toLowerCase()
      .match(/\b(promo|deal|free|discount|offer|special|win|game|dodgers|runs|strikeout|home|victory)\b/g) || [];
    return Array.from(new Set(keywords)); // Remove duplicates
  }

  // Remove duplicates and rank by confidence
  private deduplicateAndRank(results: DiscoveryResult[]): DiscoveryResult[] {
    const urlSet = new Set<string>();
    const uniqueResults = results.filter(result => {
      if (urlSet.has(result.url)) {
        return false;
      }
      urlSet.add(result.url);
      return true;
    });

    return uniqueResults.sort((a, b) => b.confidence - a.confidence);
  }

  // Main discovery method that mimics manual search strategy
  async discoverDealsLikeHuman(restaurants: string[] = ['Panda Express', 'McDonald\'s', 'Jack in the Box']): Promise<void> {
    console.log('Starting human-like deal discovery...');
    
    for (const restaurant of restaurants) {
      console.log(`Discovering deals for ${restaurant}...`);
      
      try {
        // Search social media mentions (like you did manually)
        const socialResults = await this.searchSocialMediaMentions(restaurant, 'Dodgers');
        
        // Search for direct promotional pages
        const promoResults = await this.searchPromotionalPages(restaurant);
        
        // Combine and process results
        const allResults = [...socialResults, ...promoResults];
        
        // Save discovered sites to database
        await this.saveDiscoveredSites(allResults, restaurant);
        
        console.log(`Found ${allResults.length} potential deals for ${restaurant}`);
        
      } catch (error) {
        console.error(`Error discovering deals for ${restaurant}:`, error);
      }
    }
  }

  // Search for direct promotional pages
  private async searchPromotionalPages(restaurantName: string): Promise<DiscoveryResult[]> {
    const promoQueries = [
      `site:${this.getRestaurantDomain(restaurantName)} promo dodgers`,
      `site:${this.getRestaurantDomain(restaurantName)} deal dodgers`,
      `site:${this.getRestaurantDomain(restaurantName)} offer dodgers`,
      `"${restaurantName}" dodgers promo site:${this.getRestaurantDomain(restaurantName)}`,
      `inurl:promo "${restaurantName}" dodgers`,
      `inurl:deal "${restaurantName}" dodgers`,
    ];

    const results: DiscoveryResult[] = [];
    
    for (const query of promoQueries) {
      const searchResults = await this.performGoogleSearch(query, 5);
      results.push(...searchResults);
    }

    return results;
  }

  // Get restaurant domain for site-specific searches
  private getRestaurantDomain(restaurantName: string): string {
    const domainMap: { [key: string]: string } = {
      'Panda Express': 'pandaexpress.com',
      'McDonald\'s': 'mcdonalds.com',
      'Jack in the Box': 'jackinthebox.com',
      'Del Taco': 'deltaco.com',
      'ampm': 'ampm.com'
    };
    
    return domainMap[restaurantName] || '';
  }

  // Save discovered sites to database
  private async saveDiscoveredSites(results: DiscoveryResult[], restaurant: string): Promise<void> {
    for (const result of results) {
      try {
        // Check if already exists
        const existingSites = await storage.getDiscoveredSitesByUrl(result.url);
        if (existingSites.length > 0) {
          continue; // Skip duplicates
        }

        // Create discovery source if needed
        let sourceId = await this.getOrCreateSource(result.source);
        let termId = await this.getOrCreateSearchTerm(`${restaurant} dodgers social discovery`);

        // Save discovered site
        await storage.createDiscoveredSite({
          url: result.url,
          sourceId: sourceId,
          searchTermId: termId,
          title: result.title,
          content: result.content,
          confidence: result.confidence.toString(),
          restaurantDetected: restaurant,
          teamDetected: 'Los Angeles Dodgers'
        });

      } catch (error) {
        console.error('Error saving discovered site:', error);
      }
    }
  }

  private async getOrCreateSource(sourceName: string): Promise<number> {
    try {
      const sources = await storage.getDiscoverySources();
      let source = sources.find(s => s.name === sourceName);
      
      if (!source) {
        // In production, we'd create the source in the database
        // For now, return the first available source ID
        return sources.length > 0 ? sources[0].id : 1;
      }
      
      return source.id;
    } catch (error) {
      console.error('Error getting source:', error);
      return 1;
    }
  }

  private async getOrCreateSearchTerm(term: string): Promise<number> {
    try {
      const terms = await storage.getSearchTerms();
      let searchTerm = terms.find(t => t.term === term);
      
      if (!searchTerm) {
        // In production, we'd create the search term in the database
        // For now, return the first available term ID
        return terms.length > 0 ? terms[0].id : 1;
      }
      
      return searchTerm.id;
    } catch (error) {
      console.error('Error getting search term:', error);
      return 1;
    }
  }
}

export const socialMediaDiscovery = new SocialMediaDiscoveryEngine();