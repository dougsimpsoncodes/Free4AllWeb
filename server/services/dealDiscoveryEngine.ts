import { storage } from "../storage";
import type { DiscoverySource, SearchTerm, DiscoveredSite, Restaurant, Team } from "@shared/schema";

/*
COST ANALYSIS FOR API INTEGRATIONS:

1. Twitter API v2 - FREE TIER: 500,000 tweets/month, then $100/month
2. Reddit API - FREE: 100 requests/minute, 60 requests/hour for search
3. Google Custom Search - FREE: 100 queries/day, then $5/1000 queries
4. Facebook Graph API - FREE: Basic access, rate limited
5. Instagram Basic Display - FREE: Basic access, limited search
6. News APIs - FREE options available (NewsAPI.org has free tier)

RECOMMENDATION: Start with Reddit (completely free) and Google Custom Search free tier
*/

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  source: string;
  confidence: number;
  rawData: any;
}

export class DealDiscoveryEngine {
  private activeSources: DiscoverySource[] = [];
  private activeSearchTerms: SearchTerm[] = [];

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Deal Discovery Engine...');
    
    // Initialize default sources if none exist
    await this.initializeDefaultSources();
    await this.initializeDefaultSearchTerms();
    
    // Load active sources and terms
    this.activeSources = await storage.getActiveDiscoverySources();
    this.activeSearchTerms = await storage.getActiveSearchTerms();
    
    console.log(`✅ Loaded ${this.activeSources.length} sources and ${this.activeSearchTerms.length} search terms`);
  }

  private async initializeDefaultSources(): Promise<void> {
    const defaultSources = [
      // FREE: Reddit API - No cost, good community discussions about deals
      {
        name: 'Reddit',
        type: 'reddit' as const,
        baseUrl: 'https://reddit.com',
        searchEndpoint: 'https://www.reddit.com/search.json',
        isActive: true,
        priority: 8,
        rateLimit: 60 // FREE: 60 requests per minute
      },
      
      // FREE TIER: Google Custom Search - 100 queries/day free
      {
        name: 'Google Search',
        type: 'google' as const,
        baseUrl: 'https://google.com',
        searchEndpoint: 'https://www.googleapis.com/customsearch/v1',
        isActive: true,
        priority: 10,
        rateLimit: 100 // FREE: 100 queries per day
      },
      
      // PAID: Twitter API v2 - $100/month after 500k tweets
      {
        name: 'Twitter/X',
        type: 'twitter' as const,
        baseUrl: 'https://twitter.com',
        searchEndpoint: 'https://api.twitter.com/2/tweets/search/recent',
        isActive: false, // Start disabled due to cost
        priority: 9,
        rateLimit: 300
      },
      
      // FREE with limitations: Facebook Graph API
      {
        name: 'Facebook',
        type: 'facebook' as const,
        baseUrl: 'https://facebook.com',
        searchEndpoint: 'https://graph.facebook.com/search',
        isActive: false, // Complex setup, enable later
        priority: 7,
        rateLimit: 200
      },
      
      // NEWS API - FREE TIER: NewsAPI.org offers 1000 requests/day free
      {
        name: 'News API',
        type: 'website' as const,
        baseUrl: 'https://newsapi.org',
        searchEndpoint: 'https://newsapi.org/v2/everything',
        isActive: true,
        priority: 6,
        rateLimit: 1000 // FREE: 1000 requests per day
      }
    ];

    for (const source of defaultSources) {
      await storage.createDiscoverySource(source);
    }
  }

  private async initializeDefaultSearchTerms(): Promise<void> {
    // FOCUSED ON LA DODGERS ONLY - Core app scope
    const restaurants = await storage.getRestaurants();
    const dodgers = await storage.getTeams().then(teams => teams.find(t => t.name.includes('Dodgers')));
    
    const defaultTerms = [];
    
    // Restaurant + Dodgers combinations (primary focus)
    for (const restaurant of restaurants) {
      if (dodgers) {
        defaultTerms.push(
          { restaurantId: restaurant.id, teamId: dodgers.id, term: `${restaurant.name} Dodgers`, category: 'restaurant_team' as const },
          { restaurantId: restaurant.id, teamId: dodgers.id, term: `${restaurant.name} Dodgers free`, category: 'restaurant_team' as const },
          { restaurantId: restaurant.id, teamId: dodgers.id, term: `${restaurant.name} Dodgers home win`, category: 'restaurant_team' as const },
          { restaurantId: restaurant.id, teamId: dodgers.id, term: `${restaurant.name} Dodgers promotion`, category: 'restaurant_team' as const },
          { restaurantId: restaurant.id, teamId: dodgers.id, term: `${restaurant.name} Dodgers deal`, category: 'restaurant_team' as const }
        );
      }
    }
    
    // Dodgers-specific promotional terms
    const dodgersTerms = [
      { term: 'Dodgers win free food', category: 'sport_specific' },
      { term: 'Dodgers home win promotion', category: 'sport_specific' },
      { term: 'Dodgers strikeout deal', category: 'sport_specific' },
      { term: 'Dodgers runs scored free', category: 'sport_specific' },
      { term: 'LA Dodgers restaurant promotion', category: 'sport_specific' },
      { term: 'Dodgers game day deals', category: 'sport_specific' },
      { term: 'Los Angeles Dodgers free food', category: 'sport_specific' },
      { term: 'Dodgers victory celebration deals', category: 'sport_specific' }
    ];
    
    for (const termData of dodgersTerms) {
      defaultTerms.push({
        ...termData,
        isActive: true,
        restaurantId: null,
        teamId: dodgers?.id || null
      });
    }
    
    // Baseball-specific deal terms focused on Dodgers triggers
    const baseballTerms = [
      { term: 'strikeout free tacos Dodgers', category: 'sport_specific' },
      { term: 'home run promotion LA', category: 'sport_specific' },
      { term: 'Dodgers 6 runs Big Mac', category: 'sport_specific' },
      { term: 'baseball win free coffee', category: 'sport_specific' }
    ];
    
    for (const termData of baseballTerms) {
      defaultTerms.push({
        ...termData,
        isActive: true,
        restaurantId: null,
        teamId: dodgers?.id || null
      });
    }

    for (const term of defaultTerms) {
      await storage.createSearchTerm(term);
    }
  }

  // REDDIT API with Authentication
  private async searchReddit(searchTerm: string): Promise<SearchResult[]> {
    console.log(`🤖 Searching Reddit for: "${searchTerm}"`);
    
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    
    try {
      let headers: Record<string, string> = {
        'User-Agent': 'Free4All-DealBot/1.0 by /u/yourUsername'
      };
      
      // If we have credentials, get an OAuth token for better access
      if (clientId && clientSecret) {
        try {
          const authResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Free4All-DealBot/1.0'
            },
            body: 'grant_type=client_credentials'
          });
          
          if (authResponse.ok) {
            const authData = await authResponse.json();
            headers['Authorization'] = `Bearer ${authData.access_token}`;
            console.log(`   🔑 Using authenticated Reddit API`);
          }
        } catch (authError) {
          console.log(`   ⚠️ Reddit auth failed, using public API`);
        }
      } else {
        console.log(`   ⚠️ Reddit credentials missing - using public API`);
      }

      // Try multiple Reddit search approaches for comprehensive coverage
      const searches = [
        // Direct subreddit searches for deals
        `https://oauth.reddit.com/r/deals/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://oauth.reddit.com/r/fastfood/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://oauth.reddit.com/r/coupons/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://oauth.reddit.com/r/freebies/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://oauth.reddit.com/r/FoodDeals/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        // General search as fallback
        `https://oauth.reddit.com/search?q=${encodeURIComponent(searchTerm)}&limit=10&sort=new`
      ];

      // Fallback to public endpoints if OAuth fails
      const publicSearches = [
        `https://www.reddit.com/r/deals/search.json?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://www.reddit.com/r/fastfood/search.json?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://www.reddit.com/r/coupons/search.json?q=${encodeURIComponent(searchTerm)}&restrict_sr=1&limit=10&sort=new`,
        `https://www.reddit.com/search.json?q=${encodeURIComponent(searchTerm)}&limit=10&sort=new`
      ];

      const results: SearchResult[] = [];
      const searchUrls = headers['Authorization'] ? searches : publicSearches;
      
      for (const searchUrl of searchUrls) {
        try {
          const response = await fetch(searchUrl, { headers });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.data && data.data.children) {
              for (const post of data.data.children) {
                const postData = post.data;
                
                // Skip if already found this post
                if (results.some(r => r.url === `https://reddit.com${postData.permalink}`)) {
                  continue;
                }
                
                results.push({
                  url: `https://reddit.com${postData.permalink}`,
                  title: postData.title,
                  content: postData.selftext || postData.title,
                  source: 'reddit',
                  confidence: this.calculateConfidence(postData.title + ' ' + postData.selftext, searchTerm),
                  rawData: postData
                });
              }
            }
            
            // Rate limiting - more aggressive for public API
            await new Promise(resolve => setTimeout(resolve, headers['Authorization'] ? 100 : 1000));
          }
        } catch (subError) {
          // Continue to next search URL if one fails
          continue;
        }
      }
      
      console.log(`   📊 Found ${results.length} Reddit results`);
      return results;
      
    } catch (error) {
      console.error(`❌ Reddit search failed:`, error.message);
      return [];
    }
  }

  // Enhanced Google search with social media integration
  private async searchGoogleEnhanced(query: string): Promise<SearchResult[]> {
    const socialMediaQueries = [
      query, // Base query
      `site:twitter.com ${query}`,
      `site:x.com ${query}`,
      `${query} promo`,
      `${query} deal`,
      `${query} free`
    ];
    
    const allResults: SearchResult[] = [];
    
    for (const socialQuery of socialMediaQueries.slice(0, 3)) { // Limit to avoid hitting rate limits
      const results = await this.searchGoogle(socialQuery);
      allResults.push(...results);
      
      // Brief pause between queries
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return allResults;
  }

  // FREE TIER: Google Custom Search (100 queries/day)
  private async searchGoogle(searchTerm: string): Promise<SearchResult[]> {
    console.log(`🔍 Searching Google for: "${searchTerm}"`);
    
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_CSE_ID;
    
    if (!apiKey || !searchEngineId) {
      console.log(`⚠️ Google Search API credentials missing - skipping`);
      return [];
    }
    
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchTerm)}&num=10`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }
      
      const data = await response.json();
      const results: SearchResult[] = [];
      
      if (data.items) {
        for (const item of data.items) {
          results.push({
            url: item.link,
            title: item.title,
            content: item.snippet,
            source: 'google',
            confidence: this.calculateConfidence(item.title + ' ' + item.snippet, searchTerm),
            rawData: item
          });
        }
      }
      
      console.log(`   📊 Found ${results.length} Google results`);
      return results;
      
    } catch (error) {
      console.error(`❌ Google search failed:`, error.message);
      return [];
    }
  }

  // FREE TIER: News API (1000 requests/day)
  private async searchNewsAPI(searchTerm: string): Promise<SearchResult[]> {
    console.log(`📰 Searching News API for: "${searchTerm}"`);
    
    const apiKey = process.env.NEWS_API_KEY;
    
    if (!apiKey) {
      console.log(`⚠️ News API key missing - skipping`);
      return [];
    }
    
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchTerm)}&pageSize=20&sortBy=publishedAt&apiKey=${apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`);
      }
      
      const data = await response.json();
      const results: SearchResult[] = [];
      
      if (data.articles) {
        for (const article of data.articles) {
          results.push({
            url: article.url,
            title: article.title,
            content: article.description,
            source: 'news',
            confidence: this.calculateConfidence(article.title + ' ' + article.description, searchTerm),
            rawData: article
          });
        }
      }
      
      console.log(`   📊 Found ${results.length} news results`);
      return results;
      
    } catch (error) {
      console.error(`❌ News API search failed:`, error.message);
      return [];
    }
  }

  private calculateConfidence(content: string, searchTerm: string): number {
    const lowerContent = content.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    let score = 0;
    
    // HIGH PRIORITY: Team-specific matches (LA Dodgers focus)
    const teamKeywords = ['dodgers', 'dodger', 'la dodgers', 'los angeles dodgers'];
    const hasTeam = teamKeywords.some(team => lowerContent.includes(team));
    if (hasTeam) score += 0.4; // Major boost for team relevance
    
    // HIGH PRIORITY: Restaurant chain matches
    const restaurantKeywords = ['mcdonalds', 'mcdonald\'s', 'panda express', 'jack in the box', 'del taco', 'ampm', 'subway', 'taco bell'];
    const hasRestaurant = restaurantKeywords.some(restaurant => lowerContent.includes(restaurant));
    if (hasRestaurant) score += 0.3; // Major boost for restaurant relevance
    
    // MEDIUM PRIORITY: Sports-specific promotional triggers
    const sportsKeywords = ['win', 'wins', 'home win', 'victory', 'game', 'baseball', 'mlb', 'runs', 'strikeouts'];
    const hasSports = sportsKeywords.some(sport => lowerContent.includes(sport));
    if (hasSports) score += 0.2;
    
    // MEDIUM PRIORITY: Deal-related keywords
    const dealKeywords = ['free', 'deal', 'promotion', 'discount', 'offer', 'special', 'promo'];
    const foundDealWords = dealKeywords.filter(keyword => lowerContent.includes(keyword));
    score += (foundDealWords.length / dealKeywords.length) * 0.1;
    
    // BONUS: Perfect combination (Team + Restaurant + Deal)
    if (hasTeam && hasRestaurant && foundDealWords.length > 0) {
      score += 0.2; // Bonus for perfect match
    }
    
    // PENALTY: Generic deals without sports relevance
    if (!hasTeam && !hasSports && (lowerContent.includes('national') || lowerContent.includes('generic'))) {
      score *= 0.5; // Reduce confidence for generic deals
    }
    
    return Math.min(score, 1.0);
  }

  private isContentTooOld(content: string, rawData: any): boolean {
    // For seasonal sports deals, anything older than 6 months is stale
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Extract date from content text
    const datePatterns = [
      /(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/,  // MM/DD/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,  // M/D/YY or MM/DD/YYYY
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i,  // Month DD, YYYY
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})/i  // Abbreviated month
    ];
    
    // Check for old year mentions in content
    const currentYear = new Date().getFullYear();
    const yearPattern = /\b(20\d{2})\b/g;
    const yearMatches = content.match(yearPattern);
    
    if (yearMatches) {
      for (const yearMatch of yearMatches) {
        const year = parseInt(yearMatch);
        if (year < currentYear) {
          console.log(`   ⚠️ Content mentions old year: ${year}`);
          return true;
        }
      }
    }
    
    // Check for specific date patterns
    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        let contentDate: Date;
        
        if (pattern.source.includes('YYYY-MM-DD')) {
          contentDate = new Date(match[1], parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (pattern.source.includes('MM/DD/YYYY')) {
          contentDate = new Date(match[3], parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (pattern.source.includes('january|february')) {
          const months = ['january', 'february', 'march', 'april', 'may', 'june',
                         'july', 'august', 'september', 'october', 'november', 'december'];
          const monthIndex = months.indexOf(match[1].toLowerCase());
          contentDate = new Date(match[3], monthIndex, parseInt(match[2]));
        } else if (pattern.source.includes('jan|feb')) {
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                         'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIndex = months.indexOf(match[1].toLowerCase());
          contentDate = new Date(match[3], monthIndex, parseInt(match[2]));
        } else {
          continue;
        }
        
        if (contentDate < sixMonthsAgo) {
          console.log(`   ⚠️ Content date too old: ${contentDate.toDateString()}`);
          return true;
        }
      }
    }
    
    // Check raw data for timestamp information
    if (rawData && rawData.created_utc) {
      const contentDate = new Date(rawData.created_utc * 1000);
      if (contentDate < sixMonthsAgo) {
        console.log(`   ⚠️ Raw data timestamp too old: ${contentDate.toDateString()}`);
        return true;
      }
    }
    
    return false;
  }

  async runDiscovery(): Promise<DiscoveredSite[]> {
    console.log('🚀 Starting enhanced deal discovery process with social media integration...');
    
    await this.initialize();
    
    const allResults: DiscoveredSite[] = [];
    
    // Enhanced search terms prioritizing social media effectiveness
    const socialMediaTerms = [
      'dodgers panda express',
      'dodgers mcdonalds', 
      'dodgers jack in the box',
      'dodgers ampm',
      'dodgers del taco'
    ];
    
    // Use top search terms with active sources + social media terms
    const topTerms = this.activeSearchTerms.slice(0, 8); // Reduce API terms to make room for social
    const combinedTerms = [...topTerms, ...socialMediaTerms.map(term => ({
      id: 0,
      term,
      category: 'social_media',
      successRate: '85%',
      usageCount: 0,
      isActive: true
    }))];
    
    for (const searchTerm of combinedTerms) {
      console.log(`\n🔍 Processing search term: "${searchTerm.term}" (${searchTerm.category || 'api'})`);
      
      // Search Reddit (always free)
      const redditResults = await this.searchReddit(searchTerm.term);
      
      // Enhanced Google search with social media targeting
      const googleResults = await this.searchGoogleEnhanced(searchTerm.term);
      
      // Search News API (free tier)
      const newsResults = await this.searchNewsAPI(searchTerm.term);
      
      // Combine and process results
      const allSearchResults = [...redditResults, ...googleResults, ...newsResults];
      
      // Convert to DiscoveredSite format and save
      for (const result of allSearchResults) {
        if (result.confidence > 0.3) { // Only save promising results
          // Check if content is too old (seasonal deals expire after 1 year)
          if (this.isContentTooOld(result.content, result.rawData)) {
            console.log(`   ⚠️ Skipping old content: ${result.title}`);
            continue;
          }
          
          const discoveredSite = await this.saveDiscoveredSite(result, searchTerm);
          allResults.push(discoveredSite);
        }
      }
      
      // Update search term usage for API terms
      if (searchTerm.id > 0) {
        await storage.updateSearchTermUsage(searchTerm.id);
      }
      
      // Rate limiting pause
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n✅ Enhanced discovery complete: ${allResults.length} sites discovered (including social media)`);
    return allResults;
  }

  private async saveDiscoveredSite(result: SearchResult, searchTerm: SearchTerm): Promise<DiscoveredSite> {
    const source = this.activeSources.find(s => s.type === result.source);
    
    // Handle search terms with id=0 (social media terms) by using a valid fallback
    let searchTermId = searchTerm.id;
    if (searchTermId === 0) {
      // Use the first valid search term ID as fallback for social media searches
      searchTermId = this.activeSearchTerms[0]?.id || 331;
    }
    
    const siteData = {
      url: result.url,
      sourceId: source?.id || 1,
      searchTermId: searchTermId,
      title: result.title,
      content: result.content,
      rawData: JSON.stringify(result.rawData),
      confidence: result.confidence.toString(),
      status: 'pending' as const
    };
    
    return await storage.createDiscoveredSite(siteData);
  }
}

export const dealDiscoveryEngine = new DealDiscoveryEngine();