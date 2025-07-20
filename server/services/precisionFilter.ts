// Precision filtering system to identify only authentic, active Dodgers deals
import { storage } from '../storage';

export class PrecisionFilter {
  // Known authentic deal patterns for 2024-2025 Dodgers promotions
  private authenticDealPatterns = [
    {
      restaurant: 'Panda Express',
      triggers: ['dodgers win', 'dodgerswin'],
      offers: ['$6 plate', '$6 panda plate', '$6 two-item'],
      codes: ['DODGERSWIN'],
      confidence: 0.95
    },
    {
      restaurant: 'Jack in the Box',
      triggers: ['7+ strikeouts', '7 strikeouts', 'strikeout'],
      offers: ['free jumbo jack', 'jumbo jack'],
      confidence: 0.9
    },
    {
      restaurant: 'McDonald\'s',
      triggers: ['6+ runs', '6 runs', 'home win'],
      offers: ['free big mac', 'big mac'],
      confidence: 0.9
    },
    {
      restaurant: 'ampm',
      triggers: ['home win', 'dodgers win'],
      offers: ['free coffee', 'free drink'],
      confidence: 0.85
    },
    {
      restaurant: 'Del Taco',
      triggers: ['home win', 'dodgers win'],
      offers: ['free taco', 'taco'],
      confidence: 0.8
    }
  ];

  // High-quality source domains that are likely to have authentic deals
  private trustedSources = [
    // Official restaurant domains
    'pandaexpress.com',
    'mcdonalds.com',
    'jackinthebox.com',
    'ampm.com',
    'deltaco.com',
    
    // Major news outlets
    'latimes.com',
    'abc7.com',
    'nbclosangeles.com',
    'cbsla.com',
    'fox11la.com',
    
    // Sports news
    'espn.com',
    'mlb.com',
    'dodgers.com',
    'theathletic.com',
    'bleacherreport.com',
    
    // Local news
    'sbsun.com',
    'dailynews.com',
    'pasadenastarnews.com',
    'sgvtribune.com',
    
    // Dodgers-focused sites
    'dodgersnation.com',
    'truebluela.com',
    'dodgersway.com',
    'thinkbluela.com'
  ];

  // Keywords that indicate spam or low-quality content
  private spamKeywords = [
    'click here',
    'limited time',
    'act now',
    'exclusive offer',
    'sign up now',
    'free trial',
    'download app',
    'register now',
    'claim your',
    'don\'t miss out'
  ];

  async filterDiscoveredSites(): Promise<any[]> {
    const allSites = await storage.getDiscoveredSites();
    console.log(`Starting precision filter on ${allSites.length} discovered sites`);
    
    const precisionFiltered = allSites
      .map(site => this.scoreSiteAuthenticity(site))
      .filter(site => site.authenticityScore >= 0.5) // Lower threshold initially
      .sort((a, b) => b.authenticityScore - a.authenticityScore)
      .slice(0, 15); // Take top 15 most authentic sites
    
    console.log(`Precision filter reduced to ${precisionFiltered.length} high-quality sites`);
    console.log('Top 5 authentic sites:');
    precisionFiltered.slice(0, 5).forEach((site, index) => {
      console.log(`${index + 1}. ${site.title} - Score: ${site.authenticityScore.toFixed(2)}`);
    });
    
    return precisionFiltered;
  }

  private scoreSiteAuthenticity(site: any): any {
    let score = 0;
    const lowerUrl = site.url.toLowerCase();
    const lowerTitle = site.title ? site.title.toLowerCase() : '';
    const lowerContent = site.content ? site.content.toLowerCase() : '';
    
    // Trust score based on source domain
    const trustScore = this.calculateTrustScore(lowerUrl);
    score += trustScore * 0.4; // 40% weight for source trust
    
    // Authenticity score based on deal pattern matching
    const dealScore = this.calculateDealScore(lowerTitle, lowerContent);
    score += dealScore * 0.4; // 40% weight for authentic deal patterns
    
    // Recency score (prefer recent content)
    const recencyScore = this.calculateRecencyScore(site);
    score += recencyScore * 0.1; // 10% weight for recency
    
    // Spam penalty
    const spamPenalty = this.calculateSpamPenalty(lowerTitle, lowerContent);
    score -= spamPenalty * 0.1; // 10% penalty for spam indicators
    
    const finalScore = Math.max(0, Math.min(1, score));
    
    return {
      ...site,
      authenticityScore: finalScore,
      trustScore,
      dealScore,
      recencyScore,
      spamPenalty
    };
  }

  private calculateTrustScore(url: string): number {
    // Perfect score for official restaurant domains
    if (url.includes('pandaexpress.com') || url.includes('mcdonalds.com') || 
        url.includes('jackinthebox.com') || url.includes('ampm.com') || 
        url.includes('deltaco.com')) {
      return 1.0;
    }
    
    // High score for major news outlets
    if (url.includes('latimes.com') || url.includes('abc7.com') || 
        url.includes('nbclosangeles.com') || url.includes('cbsla.com') || 
        url.includes('fox11la.com')) {
      return 0.9;
    }
    
    // Good score for sports news
    if (url.includes('espn.com') || url.includes('mlb.com') || 
        url.includes('dodgers.com') || url.includes('theathletic.com')) {
      return 0.85;
    }
    
    // Medium score for local news and Dodgers sites
    if (this.trustedSources.some(domain => url.includes(domain))) {
      return 0.7;
    }
    
    // Low score for social media
    if (url.includes('twitter.com') || url.includes('x.com') || 
        url.includes('reddit.com') || url.includes('facebook.com')) {
      return 0.4;
    }
    
    // Very low score for unknown domains
    return 0.2;
  }

  private calculateDealScore(title: string, content: string): number {
    let score = 0;
    const text = `${title} ${content}`;
    
    // Must mention Dodgers to be relevant
    if (!text.includes('dodgers') && !text.includes('dodger')) {
      return 0;
    }
    
    // Check for authentic deal patterns
    for (const pattern of this.authenticDealPatterns) {
      let patternScore = 0;
      
      // Restaurant mention
      if (text.includes(pattern.restaurant.toLowerCase())) {
        patternScore += 0.4;
      }
      
      // Trigger condition
      if (pattern.triggers.some(trigger => text.includes(trigger))) {
        patternScore += 0.4;
      }
      
      // Offer description
      if (pattern.offers.some(offer => text.includes(offer))) {
        patternScore += 0.3;
      }
      
      // Promo code (if applicable)
      if (pattern.codes && pattern.codes.some(code => text.includes(code.toLowerCase()))) {
        patternScore += 0.2;
      }
      
      score = Math.max(score, patternScore);
    }
    
    // Bonus for specific current year mentions (2024, 2025)
    if (text.includes('2024') || text.includes('2025')) {
      score += 0.1;
    }
    
    // Bonus for specific dollar amounts
    if (text.includes('$6') || text.includes('$5') || text.includes('free')) {
      score += 0.1;
    }
    
    // Penalty for generic deal aggregation language
    const genericTerms = ['deals', 'offers', 'discounts', 'promotions'];
    const genericCount = genericTerms.filter(term => text.includes(term)).length;
    if (genericCount > 3) {
      score -= 0.3;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private calculateRecencyScore(site: any): number {
    // If we have no date information, assume medium recency
    if (!site.discoveredAt) return 0.5;
    
    const now = new Date();
    const discovered = new Date(site.discoveredAt);
    const daysDiff = (now.getTime() - discovered.getTime()) / (1000 * 60 * 60 * 24);
    
    // Higher score for more recent discoveries
    if (daysDiff < 7) return 1.0;
    if (daysDiff < 30) return 0.8;
    if (daysDiff < 90) return 0.6;
    if (daysDiff < 180) return 0.4;
    return 0.2;
  }

  private calculateSpamPenalty(title: string, content: string): number {
    const text = `${title} ${content}`;
    const spamCount = this.spamKeywords.filter(keyword => text.includes(keyword)).length;
    return Math.min(1, spamCount * 0.2);
  }

  // Get only the most authentic deals for admin review
  async getAuthenticDeals(limit: number = 10): Promise<any[]> {
    const filtered = await this.filterDiscoveredSites();
    return filtered.slice(0, limit);
  }

  // Update discovery confidence scores based on authenticity
  async updateDiscoveryConfidence(): Promise<void> {
    const filtered = await this.filterDiscoveredSites();
    
    for (const site of filtered) {
      await storage.updateDiscoveredSite(site.id, {
        confidence: site.authenticityScore.toString()
      });
    }
    
    console.log(`Updated confidence scores for ${filtered.length} authentic sites`);
  }
}

export const precisionFilter = new PrecisionFilter();