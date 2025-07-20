// Simple extraction service using fetch instead of Puppeteer for reliable operation
import { storage } from '../storage';

interface ExtractedDeal {
  title: string;
  restaurant: string;
  offerDescription: string;
  triggerCondition: string;
  dealValue: string;
  promoCode?: string;
  instructions?: string;
  terms?: string;
  imageUrl?: string;
  sourceUrl: string;
  confidence: number;
}

export class SimpleExtractionEngine {
  
  async extractDealFromUrl(url: string): Promise<ExtractedDeal | null> {
    console.log(`Starting simple extraction for URL: ${url}`);
    
    try {
      // Fetch page content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });

      if (!response.ok) {
        console.error(`HTTP error: ${response.status}`);
        return null;
      }

      const html = await response.text();
      console.log(`Fetched HTML content, length: ${html.length} characters`);

      // Extract text content from HTML
      const textContent = this.extractTextFromHtml(html);
      console.log(`Extracted text content, length: ${textContent.length} characters`);

      // Determine restaurant from URL or content
      let restaurant = this.getRestaurantFromUrl(url);
      if (!restaurant) {
        restaurant = this.getRestaurantFromContent(textContent);
      }
      if (!restaurant) {
        console.log('Could not determine restaurant from URL or content');
        console.log(`URL: ${url}`);
        console.log(`Content preview: ${textContent.substring(0, 500)}...`);
        return null;
      }
      
      console.log(`Detected restaurant: ${restaurant}`);

      // Extract deal information based on content
      const dealInfo = this.extractDealInfo(textContent, restaurant);
      if (!dealInfo) {
        console.log('Could not extract deal information from content');
        return null;
      }

      // Extract image URL from HTML
      const imageUrl = this.extractImageUrl(html, url);

      const extractedDeal: ExtractedDeal = {
        title: dealInfo.title,
        restaurant: restaurant,
        offerDescription: dealInfo.offer,
        triggerCondition: dealInfo.trigger,
        dealValue: dealInfo.value,
        promoCode: dealInfo.code,
        instructions: dealInfo.instructions || 'Visit restaurant to redeem this offer',
        terms: dealInfo.terms || 'Terms and conditions apply. Valid while supplies last.',
        imageUrl: imageUrl,
        sourceUrl: url,
        confidence: dealInfo.confidence
      };

      console.log('Successfully extracted deal:', extractedDeal);
      return extractedDeal;

    } catch (error) {
      console.error(`Error extracting deal from ${url}:`, error);
      return null;
    }
  }

  private extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, ' ');
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  private getRestaurantFromUrl(url: string): string | null {
    // Direct restaurant domains
    if (url.includes('pandaexpress.com')) return 'Panda Express';
    if (url.includes('mcdonalds.com')) return 'McDonald\'s';
    if (url.includes('jackinthebox.com')) return 'Jack in the Box';
    if (url.includes('ampm.com')) return 'ampm';
    if (url.includes('deltaco.com')) return 'Del Taco';
    
    // Social media and news sites - detect from URL path/content
    if (url.includes('JackBox') || url.includes('jackbox')) return 'Jack in the Box';
    if (url.includes('panda') || url.includes('Panda')) return 'Panda Express';
    if (url.includes('mcdonalds') || url.includes('McDonald')) return 'McDonald\'s';
    if (url.includes('ampm') || url.includes('AMPM')) return 'ampm';
    if (url.includes('deltaco') || url.includes('DelTaco')) return 'Del Taco';
    
    return null;
  }

  private getRestaurantFromContent(content: string): string | null {
    const lowerContent = content.toLowerCase();
    
    // Look for restaurant mentions in content (expanded patterns)
    if (lowerContent.includes('panda express') || lowerContent.includes('panda') || 
        lowerContent.includes('plate') || lowerContent.includes('orange chicken')) return 'Panda Express';
    if (lowerContent.includes('jack in the box') || lowerContent.includes('jackinthebox') || 
        lowerContent.includes('jumbo jack') || lowerContent.includes('curly fries')) return 'Jack in the Box';
    if (lowerContent.includes('mcdonald') || lowerContent.includes('mcdonalds') || 
        lowerContent.includes('big mac') || lowerContent.includes('mcnuggets')) return 'McDonald\'s';
    if (lowerContent.includes('ampm') || lowerContent.includes('am/pm') || 
        lowerContent.includes('arco')) return 'ampm';
    if (lowerContent.includes('del taco') || lowerContent.includes('deltaco')) return 'Del Taco';
    
    return null;
  }

  private extractDealInfo(content: string, restaurant: string): {
    title: string;
    offer: string;
    trigger: string;
    value: string;
    code?: string;
    instructions?: string;
    terms?: string;
    confidence: number;
  } | null {
    
    const lowerContent = content.toLowerCase();
    console.log(`Analyzing content for ${restaurant}...`);

    // Panda Express specific extraction
    if (restaurant === 'Panda Express') {
      return this.extractPandaExpressDeal(content, lowerContent);
    }

    // McDonald's specific extraction
    if (restaurant === 'McDonald\'s') {
      return this.extractMcDonaldsDeal(content, lowerContent);
    }

    // Jack in the Box specific extraction
    if (restaurant === 'Jack in the Box') {
      return this.extractJackInTheBoxDeal(content, lowerContent);
    }

    // Generic deal extraction for other restaurants
    return this.extractGenericDeal(content, lowerContent, restaurant);
  }

  private extractPandaExpressDeal(content: string, lowerContent: string): {
    title: string;
    offer: string;
    trigger: string;
    value: string;
    code?: string;
    instructions?: string;
    terms?: string;
    confidence: number;
  } | null {
    
    // Look for dollar amounts
    const dollarMatches = content.match(/\$(\d+(?:\.\d{2})?)/g);
    const priceMatch = dollarMatches ? dollarMatches[0] : null;
    
    // Look for Dodgers mentions
    const dodgersMatch = content.match(/dodgers?\s+(win|victory|beat|game)/i);
    
    // Look for food items
    const plateMatch = content.match(/(plate|bowl|entree|combo)/i);
    
    // Look for specific deal text
    const dealMatch = content.match(/(\$\d+(?:\.\d{2})?\s+[^.]+(?:plate|bowl|entree))/i);
    
    console.log('Panda Express extraction results:', {
      priceMatch,
      dodgersMatch: !!dodgersMatch,
      plateMatch: !!plateMatch,
      dealMatch: !!dealMatch
    });

    // High confidence extraction
    if (priceMatch && dodgersMatch && plateMatch) {
      return {
        title: 'Panda Express Dodgers Win Deal',
        offer: dealMatch ? dealMatch[1] : `${priceMatch} Panda Plate`,
        trigger: 'Any LA Dodgers win',
        value: priceMatch,
        confidence: 0.9
      };
    }

    // Medium confidence extraction
    if (priceMatch && (lowerContent.includes('dodgers') || lowerContent.includes('deal'))) {
      return {
        title: 'Panda Express Dodgers Promotion',
        offer: dealMatch ? dealMatch[1] : `${priceMatch} special offer`,
        trigger: 'Dodgers team performance',
        value: priceMatch,
        confidence: 0.7
      };
    }

    // Low confidence extraction
    if (lowerContent.includes('dodgers') && (lowerContent.includes('deal') || lowerContent.includes('promo'))) {
      return {
        title: 'Panda Express Dodgers Promotion',
        offer: 'Special promotional offer',
        trigger: 'Dodgers team performance',
        value: 'Special Price',
        confidence: 0.5
      };
    }

    return null;
  }

  private extractMcDonaldsDeal(content: string, lowerContent: string): any {
    // Enhanced McDonald's patterns for social media content
    const patterns = {
      runs: /(\d+)\+?\s*(runs?|r)/i,
      free: /free\s+([^,.!]+)/i,
      bigMac: /big\s*mac/i,
      fries: /fries?/i,
      mcnuggets: /mcnuggets?|nuggets?/i,
      dodgers: /dodgers?/i,
      deal: /deal|offer|promo|discount/i,
      win: /win|victory/i
    };

    // High confidence: runs-based deals
    const runsMatch = content.match(patterns.runs);
    const freeMatch = content.match(patterns.free);
    
    if (runsMatch && (freeMatch || patterns.bigMac.test(content))) {
      return {
        title: 'McDonald\'s Dodgers Runs Deal',
        offer: freeMatch ? freeMatch[1].trim() : 'Free Big Mac',
        trigger: `${runsMatch[1]}+ runs scored by Dodgers`,
        value: 'Free',
        confidence: 0.9
      };
    }

    // Medium confidence: win-based deals
    if (patterns.dodgers.test(content) && patterns.win.test(content)) {
      if (patterns.bigMac.test(content)) {
        return {
          title: 'McDonald\'s Dodgers Win Deal',
          offer: 'Free Big Mac',
          trigger: 'Dodgers home win',
          value: 'Free',
          confidence: 0.8
        };
      }
      if (patterns.fries.test(content)) {
        return {
          title: 'McDonald\'s Dodgers Win Deal',
          offer: 'Free Fries',
          trigger: 'Dodgers home win',
          value: 'Free',
          confidence: 0.8
        };
      }
    }

    // Lower confidence: general McDonald's + Dodgers
    if (patterns.dodgers.test(content) && patterns.deal.test(content)) {
      return {
        title: 'McDonald\'s Dodgers Promotion',
        offer: 'Special promotional offer',
        trigger: 'LA Dodgers team performance',
        value: 'Special Deal',
        confidence: 0.6
      };
    }

    return null;
  }

  private extractJackInTheBoxDeal(content: string, lowerContent: string): any {
    // Enhanced pattern matching for social media and news content
    const patterns = {
      strikeout: /(\d+)\+?\s*(strikeout|k)/i,
      free: /free\s+([^,.!]+)/i,
      jumboJack: /jumbo\s*jack/i,
      dodgers: /dodgers?/i,
      deal: /deal|offer|promo|discount/i,
      with: /with\s+([^,.!]+)/i
    };

    // High confidence: specific strikeout deal
    const strikeoutMatch = content.match(patterns.strikeout);
    const freeMatch = content.match(patterns.free);
    
    if (strikeoutMatch && (freeMatch || patterns.jumboJack.test(content))) {
      return {
        title: 'Jack in the Box Strikeout Deal',
        offer: freeMatch ? freeMatch[1].trim() : 'Free Jumbo Jack with large drink',
        trigger: `${strikeoutMatch[1]}+ strikeouts by Dodgers`,
        value: 'Free',
        confidence: 0.9
      };
    }

    // Medium confidence: Dodgers + food item mentions
    if (patterns.dodgers.test(content) && patterns.jumboJack.test(content)) {
      const withMatch = content.match(patterns.with);
      return {
        title: 'Jack in the Box Dodgers Deal',
        offer: withMatch ? `Free Jumbo Jack with ${withMatch[1]}` : 'Free Jumbo Jack with large drink',
        trigger: 'Dodgers performance (strikeouts or wins)',
        value: 'Free',
        confidence: 0.8
      };
    }

    // Lower confidence: Dodgers + deal keywords
    if (patterns.dodgers.test(content) && patterns.deal.test(content)) {
      return {
        title: 'Jack in the Box Dodgers Promotion',
        offer: 'Special promotional offer',
        trigger: 'LA Dodgers team performance',
        value: 'Special Deal',
        confidence: 0.6
      };
    }

    return null;
  }

  private extractGenericDeal(content: string, lowerContent: string, restaurant: string): any {
    // Enhanced generic deal extraction with better pattern matching
    const patterns = {
      free: /free\s+([^,.!]+)/i,
      deal: /(deal|offer|promo|discount|special)/i,
      price: /\$(\d+(?:\.\d{2})?)/,
      dodgers: /dodgers?/i,
      win: /win|victory|beat/i,
      runs: /(\d+)\+?\s*(runs?|r\b)/i,
      strikeouts: /(\d+)\+?\s*(strikeouts?|k\b)/i,
      home: /home\s+(game|win)/i,
      code: /code\s*:?\s*([A-Z0-9]+)/i,
      percent: /(\d+)%\s*off/i
    };

    const freeMatch = content.match(patterns.free);
    const dealMatch = content.match(patterns.deal);
    const priceMatch = content.match(patterns.price);
    const codeMatch = content.match(patterns.code);
    const percentMatch = content.match(patterns.percent);

    // High confidence: specific trigger + offer
    const runsMatch = content.match(patterns.runs);
    const strikeoutsMatch = content.match(patterns.strikeouts);
    
    if (patterns.dodgers.test(content)) {
      if (runsMatch && (freeMatch || priceMatch)) {
        return {
          title: `${restaurant} Dodgers Runs Deal`,
          offer: freeMatch ? freeMatch[1].trim() : (priceMatch ? `${priceMatch[0]} special` : 'Special offer'),
          trigger: `${runsMatch[1]}+ runs scored by Dodgers`,
          value: freeMatch ? 'Free' : (priceMatch ? priceMatch[0] : 'Special Price'),
          code: codeMatch ? codeMatch[1] : undefined,
          confidence: 0.8
        };
      }
      
      if (strikeoutsMatch && (freeMatch || priceMatch)) {
        return {
          title: `${restaurant} Dodgers Strikeouts Deal`,
          offer: freeMatch ? freeMatch[1].trim() : (priceMatch ? `${priceMatch[0]} special` : 'Special offer'),
          trigger: `${strikeoutsMatch[1]}+ strikeouts by Dodgers`,
          value: freeMatch ? 'Free' : (priceMatch ? priceMatch[0] : 'Special Price'),
          code: codeMatch ? codeMatch[1] : undefined,
          confidence: 0.8
        };
      }
      
      if (patterns.win.test(content) && (freeMatch || priceMatch || percentMatch)) {
        return {
          title: `${restaurant} Dodgers Win Deal`,
          offer: freeMatch ? freeMatch[1].trim() : (percentMatch ? `${percentMatch[1]}% off` : (priceMatch ? `${priceMatch[0]} special` : 'Special offer')),
          trigger: 'LA Dodgers win',
          value: freeMatch ? 'Free' : (percentMatch ? `${percentMatch[1]}% off` : (priceMatch ? priceMatch[0] : 'Special Price')),
          code: codeMatch ? codeMatch[1] : undefined,
          confidence: 0.7
        };
      }
      
      // Medium confidence: Dodgers + any deal mention
      if (dealMatch || freeMatch || priceMatch) {
        return {
          title: `${restaurant} Dodgers Deal`,
          offer: freeMatch ? freeMatch[1].trim() : (dealMatch ? dealMatch[1] : (priceMatch ? `${priceMatch[0]} special` : 'Special offer')),
          trigger: 'LA Dodgers performance',
          value: freeMatch ? 'Free' : (priceMatch ? priceMatch[0] : 'Special Price'),
          code: codeMatch ? codeMatch[1] : undefined,
          confidence: 0.6
        };
      }
      
      // Lower confidence: just restaurant + dodgers mention
      return {
        title: `${restaurant} Dodgers Promotion`,
        offer: 'Special promotional offer',
        trigger: 'LA Dodgers team performance',
        value: 'Special Price',
        confidence: 0.5
      };
    }

    return null;
  }

  private extractImageUrl(html: string, baseUrl: string): string | undefined {
    // Look for promotional images
    const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    
    if (imgMatches) {
      for (const imgMatch of imgMatches) {
        const srcMatch = imgMatch.match(/src=["']([^"']+)["']/i);
        if (srcMatch) {
          let src = srcMatch[1];
          
          // Convert relative URLs to absolute
          if (src.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            src = `${urlObj.protocol}//${urlObj.host}${src}`;
          } else if (!src.startsWith('http')) {
            src = new URL(src, baseUrl).href;
          }
          
          // Prefer images with promotional keywords
          const imgLower = imgMatch.toLowerCase();
          if (imgLower.includes('promo') || imgLower.includes('deal') || 
              imgLower.includes('offer') || imgLower.includes('dodgers')) {
            return src;
          }
        }
      }
    }
    
    return undefined;
  }

  async enhanceDiscoveredSite(siteId: number): Promise<ExtractedDeal | null> {
    try {
      // Get the discovered site
      const site = await storage.getDiscoveredSite(siteId);
      if (!site) {
        console.error(`Site ${siteId} not found`);
        return null;
      }

      // Extract deal details
      const extractedDeal = await this.extractDealFromUrl(site.url);
      if (!extractedDeal) {
        console.error(`Could not extract deal from ${site.url}`);
        return null;
      }

      // Update the discovered site with extracted data
      await storage.updateDiscoveredSite(siteId, {
        restaurantDetected: extractedDeal.restaurant,
        dealExtracted: JSON.stringify({
          title: extractedDeal.title,
          offer: extractedDeal.offerDescription,
          trigger: extractedDeal.triggerCondition,
          value: extractedDeal.dealValue,
          code: extractedDeal.promoCode,
          instructions: extractedDeal.instructions,
          terms: extractedDeal.terms,
          imageUrl: extractedDeal.imageUrl
        }),
        confidence: extractedDeal.confidence.toString()
      });

      return extractedDeal;

    } catch (error) {
      console.error(`Error enhancing site ${siteId}:`, error);
      return null;
    }
  }
}

export const simpleExtractionEngine = new SimpleExtractionEngine();