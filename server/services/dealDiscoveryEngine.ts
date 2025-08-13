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
  
  // Fine-tuning parameters for precision control - ADMIN REVIEW ONLY
  private readonly CONFIDENCE_THRESHOLDS = {
    MINIMUM_SAVE: 0.9,      // Only save deals with 90%+ confidence - admin review ready
    HIGH_QUALITY: 0.95,     // High quality at 95%+  
    PERFECT_MATCH: 1.0      // Perfect matches at 100%
  };
  
  private readonly DISCOVERY_LIMITS = {
    MAX_RESULTS_PER_TERM: 5,    // Limit to top 5 per search term
    MAX_DAILY_DEALS: 20,        // Maximum 20 deals per day (realistic for LA)
    SEARCH_TERMS_ACTIVE: 8      // Use only top 8 most successful terms
  };

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
      
      // Twitter API v2 - We have credentials now
      {
        name: 'Twitter/X',
        type: 'twitter' as const,
        baseUrl: 'https://twitter.com',
        searchEndpoint: 'https://api.twitter.com/2/tweets/search/recent',
        isActive: true, // Enable since we have Bearer Token
        priority: 9,
        rateLimit: 300
      },
      
      // Facebook - Disabled (complex setup, not needed for sports deals)
      {
        name: 'Facebook',
        type: 'facebook' as const,
        baseUrl: 'https://facebook.com',
        searchEndpoint: 'https://graph.facebook.com/search',
        isActive: false,
        priority: 7,
        rateLimit: 200
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
    
    console.log(`   🔧 Google API Key: ${apiKey ? 'Available' : 'Missing'}`);
    console.log(`   🔧 Google CSE ID: ${searchEngineId ? 'Available' : 'Missing'}`);
    
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

  // Twitter/X API v2 Search
  private async searchTwitter(searchTerm: string): Promise<SearchResult[]> {
    console.log(`🐦 Searching Twitter/X for: "${searchTerm}"`);
    
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    console.log(`   🔧 Twitter Bearer Token: ${bearerToken ? 'Available' : 'Missing'}`);
    
    if (!bearerToken) {
      console.log(`⚠️ Twitter Bearer Token missing - skipping`);
      return [];
    }
    
    try {
      const query = `${searchTerm} -is:retweet lang:en`;
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=50&tweet.fields=created_at,author_id,public_metrics,text`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: SearchResult[] = [];
      
      if (data.data) {
        for (const tweet of data.data) {
          results.push({
            url: `https://twitter.com/i/status/${tweet.id}`,
            title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
            content: tweet.text,
            source: 'twitter',
            confidence: this.calculateConfidence(tweet.text, searchTerm),
            rawData: tweet
          });
        }
      }
      
      console.log(`   📊 Found ${results.length} Twitter results`);
      return results;
      
    } catch (error) {
      console.error(`❌ Twitter search failed:`, error.message);
      return [];
    }
  }

  // Search official team and restaurant websites
  private async searchOfficialWebsites(searchTerm: string): Promise<SearchResult[]> {
    console.log(`🏢 Searching official websites for: "${searchTerm}"`);
    
    // Official website URLs for LA teams and major restaurants
    const officialSites = [
      // LA Dodgers
      'site:mlb.com/dodgers',
      'site:dodgers.com',
      
      // Major restaurant chains in LA
      'site:mcdonalds.com',
      'site:pandaexpress.com', 
      'site:jackinthebox.com',
      'site:deltaco.com',
      'site:ampm.com',
      'site:subway.com',
      'site:tacobell.com'
    ];
    
    const allResults: SearchResult[] = [];
    
    // Use Google to search each official site
    for (const siteQuery of officialSites.slice(0, 3)) { // Limit to avoid hitting API limits
      const fullQuery = `${siteQuery} ${searchTerm} promotion OR deal OR free`;
      const results = await this.searchGoogle(fullQuery);
      
      // Mark these as higher confidence since they're from official sources
      const boostedResults = results.map(result => ({
        ...result,
        source: 'official_website',
        confidence: Math.min(result.confidence + 0.1, 1.0) // Boost confidence by 10%
      }));
      
      allResults.push(...boostedResults);
      
      // Rate limiting pause
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`   📊 Found ${allResults.length} official website results`);
    return allResults;
  }


  private calculateConfidence(content: string, searchTerm: string): number {
    const lowerContent = content.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    const originalContent = content;
    
    // STRICT FILTERING: Start with 0, must earn confidence through specific patterns
    let score = 0;
    
    // === LOCATION FILTERING: Must be LA/California focused ===
    const wrongLocationPatterns = [
      /houston/i,
      /texas/i,
      /dallas/i,
      /austin/i,
      /san antonio/i,
      /astros/i,
      /rangers/i,
      /cowboys/i,
      /\btx\b/i,
      /new york/i,
      /chicago/i,
      /boston/i,
      /philadelphia/i,
      /miami/i,
      /atlanta/i,
      /detroit/i,
      /seattle/i
    ];
    
    // IMMEDIATE REJECTION for wrong geographic areas
    if (wrongLocationPatterns.some(pattern => pattern.test(lowerContent))) {
      console.log(`   ❌ REJECTED: Wrong geographic location detected`);
      return 0;
    }
    
    // BOOST for LA/California content
    const laLocationPatterns = [
      /los angeles/i,
      /\bla\b/i,
      /california/i,
      /\bca\b/i,
      /southern california/i,
      /socal/i,
      /west coast/i,
      /dodgers/i,
      /angels/i
    ];
    
    const hasLALocation = laLocationPatterns.some(pattern => pattern.test(lowerContent));
    
    // === TIER 1: PERFECT MATCHES (90-100% confidence) ===
    
    // Pattern 1: Daily deal roundups (highest quality)
    const dailyDealPatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}\s+mlb\s+free\s+food\s+deals/i,
      /today's\s+sports.*food\s+deals/i,
      /psa.*sports.*food.*deals/i,
      /daily\s+(sports|mlb|baseball).*deals/i
    ];
    if (dailyDealPatterns.some(pattern => pattern.test(originalContent))) {
      score = 1.0; // Perfect confidence for curated deal lists
      console.log(`   🎯 TIER 1: Daily deal roundup detected - 100% confidence`);
      return score;
    }
    
    // Pattern 2: Specific team + restaurant + sports trigger
    const teamKeywords = ['dodgers', 'dodger', 'la dodgers', 'los angeles dodgers', 'angels', 'la angels'];
    const restaurantKeywords = ['mcdonalds', 'mcdonald\'s', 'panda express', 'jack in the box', 'del taco', 'ampm', 'subway', 'taco bell'];
    const sportsTriggersExact = ['score', 'scores', 'runs', 'home run', 'strikeout', 'strikeouts', 'win', 'wins', 'victory'];
    
    const hasTeam = teamKeywords.some(team => lowerContent.includes(team));
    const hasRestaurant = restaurantKeywords.some(restaurant => lowerContent.includes(restaurant));
    const hasSportsTrigger = sportsTriggersExact.some(trigger => lowerContent.includes(trigger));
    const hasFreeWord = lowerContent.includes('free');
    
    // Perfect combination: Team + Restaurant + Sports Trigger + Free + LA Location
    if (hasTeam && hasRestaurant && hasSportsTrigger && hasFreeWord && hasLALocation) {
      score = 0.95; // Near-perfect for specific LA deals
      console.log(`   🎯 TIER 1: Perfect LA sports deal combo detected - 95% confidence`);
      return score;
    }
    
    // === TIER 2: ADMIN REVIEW READY (90%+ confidence) ===
    
    // Pattern 3: Team + Restaurant + Promotional details + LA Location required
    if (hasTeam && hasRestaurant && (hasFreeWord || lowerContent.includes('deal'))) {
      // MUST have LA location context for restaurant deals to avoid other cities
      if (!hasLALocation) {
        console.log(`   ❌ REJECTED: Team/restaurant deal without LA location context`);
        return 0;
      }
      
      // Additional validation for genuine promotional content
      const promotionalIndicators = [
        /with\s+purchase/i,
        /minimum\s+purchase/i,
        /\$\d+\s+minimum/i,
        /code\s+[A-Z0-9]+/i,
        /valid\s+(today|through|until)/i,
        /app\s+only/i,
        /mobile\s+offer/i,
        /free\s+[a-z\s]+\s+from\s+[a-z\s]+/i
      ];
      
      if (promotionalIndicators.some(pattern => pattern.test(originalContent))) {
        score = 0.95;
        console.log(`   🎯 TIER 2: Complete LA promotional deal - 95% confidence`);
        return score;
      }
      
      // Must have team AND restaurant AND LA location to get 90%
      score = 0.90;
      console.log(`   🎯 TIER 2: LA team restaurant combination - 90% confidence`);
      return score;
    }
    
    // === STRICT REJECTION FILTERS ===
    
    // REJECT: Personal posts, requests for help
    const personalPostPatterns = [
      /i\s+(need|want|am|work)/i,
      /anyone\s+(have|know)/i,
      /looking\s+for/i,
      /can\s+someone/i,
      /help\s+me/i,
      /\d+\s+(male|female|f|m)\b/i,
      /trying\s+to\s+meet/i,
      /pm\s+me/i,
      /chat\s+with/i
    ];
    
    if (personalPostPatterns.some(pattern => pattern.test(originalContent))) {
      console.log(`   ❌ REJECTED: Personal post detected`);
      return 0;
    }
    
    // REJECT: Generic restaurant deals without sports context
    if (hasRestaurant && !hasTeam && !hasSportsTrigger) {
      console.log(`   ❌ REJECTED: Generic restaurant deal without sports context`);
      return 0;
    }
    
    // REJECT: Irrelevant food discussions
    const irrelevantPatterns = [
      /i\s+can't\s+eat/i,
      /accidentally\s+ordered/i,
      /celebrates.*anniversary/i,
      /sauce.*goes.*well/i,
      /recipe/i,
      /ingredients/i,
      /nutrition/i,
      /calories/i,
      /taste/i,
      /flavor/i
    ];
    
    if (irrelevantPatterns.some(pattern => pattern.test(originalContent))) {
      console.log(`   ❌ REJECTED: Irrelevant food discussion`);
      return 0;
    }
    
    // REJECT: Old deals (anything mentioning past years)
    const currentYear = new Date().getFullYear();
    const yearMentions = originalContent.match(/\b20\d{2}\b/g);
    if (yearMentions) {
      for (const yearStr of yearMentions) {
        const year = parseInt(yearStr);
        if (year < currentYear) {
          console.log(`   ❌ REJECTED: Old deal from ${year}`);
          return 0;
        }
      }
    }
    
    // If we get here, it doesn't match our criteria
    console.log(`   ❌ REJECTED: No qualifying patterns found`);
    return 0;
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
    
    // Enhanced search terms prioritizing LA geographic targeting
    const socialMediaTerms = [
      'los angeles dodgers panda express',
      'la dodgers mcdonalds', 
      'dodgers jack in the box california',
      'dodgers ampm los angeles',
      'dodgers del taco la'
    ];
    
    // Use only the most effective search terms for precision
    const topTerms = this.activeSearchTerms.slice(0, this.DISCOVERY_LIMITS.SEARCH_TERMS_ACTIVE);
    const precisionSocialTerms = [
      'los angeles dodgers panda express free',
      'la dodgers mcdonalds deal',
      'dodgers home run free food california',
      'la dodgers win promotion los angeles',
      'dodgers stadium area food deals',
      'echo park dodgers restaurant promotions'
    ];
    
    const combinedTerms = [...topTerms, ...precisionSocialTerms.map(term => ({
      id: 0,
      term,
      category: 'precision_social',
      successRate: '95%',
      usageCount: 0,
      isActive: true
    }))];
    
    for (const searchTerm of combinedTerms) {
      console.log(`\n🔍 Processing search term: "${searchTerm.term}" (${searchTerm.category || 'api'})`);
      
      // Search Reddit (always free)
      const redditResults = await this.searchReddit(searchTerm.term);
      
      // Enhanced Google search with social media targeting
      const googleResults = await this.searchGoogleEnhanced(searchTerm.term);
      
      // Search Twitter/X API
      const twitterResults = await this.searchTwitter(searchTerm.term);
      
      // Search official team/restaurant websites
      const websiteResults = await this.searchOfficialWebsites(searchTerm.term);
      
      // Combine and process results with quality filtering
      const allSearchResults = [...redditResults, ...googleResults, ...twitterResults, ...websiteResults];
      
      // Sort by confidence (highest first) and limit results per term
      const qualityResults = allSearchResults
        .filter(result => result.confidence >= this.CONFIDENCE_THRESHOLDS.MINIMUM_SAVE)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.DISCOVERY_LIMITS.MAX_RESULTS_PER_TERM);
      
      console.log(`   📊 Found ${allSearchResults.length} total results, saving top ${qualityResults.length} with ≥${this.CONFIDENCE_THRESHOLDS.MINIMUM_SAVE * 100}% confidence`);
      
      // Convert to DiscoveredSite format and save
      for (const result of qualityResults) {
        // Check if content is too old (seasonal deals expire after 1 year)
        if (this.isContentTooOld(result.content, result.rawData)) {
          console.log(`   ⚠️ Skipping old content: ${result.title}`);
          continue;
        }
        
        // Check for duplicates by URL
        const existingSite = allResults.find(existing => existing.url === result.url);
        if (existingSite) {
          console.log(`   🔄 Skipping duplicate: ${result.title}`);
          continue;
        }
        
        const discoveredSite = await this.saveDiscoveredSite(result, searchTerm);
        allResults.push(discoveredSite);
        
        // Log the quality tier for this result
        if (result.confidence >= this.CONFIDENCE_THRESHOLDS.PERFECT_MATCH) {
          console.log(`   🏆 PERFECT MATCH saved: ${result.title} (${(result.confidence * 100).toFixed(0)}%)`);
        } else if (result.confidence >= this.CONFIDENCE_THRESHOLDS.HIGH_QUALITY) {
          console.log(`   ⭐ HIGH QUALITY saved: ${result.title} (${(result.confidence * 100).toFixed(0)}%)`);
        } else {
          console.log(`   ✓ QUALITY saved: ${result.title} (${(result.confidence * 100).toFixed(0)}%)`);
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