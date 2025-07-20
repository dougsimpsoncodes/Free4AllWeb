import puppeteer from 'puppeteer';
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

interface ExtractionPattern {
  name: string;
  urlPattern: RegExp;
  selectors: {
    title?: string[];
    offer?: string[];
    trigger?: string[];
    value?: string[];
    code?: string[];
    instructions?: string[];
    terms?: string[];
    image?: string[];
  };
  extractors: {
    restaurant: (url: string) => string;
    parseOffer: (text: string) => { offer: string; value: string; trigger: string };
  };
}

// Restaurant-specific extraction patterns
const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  {
    name: 'Panda Express',
    urlPattern: /pandaexpress\.com/i,
    selectors: {
      title: [
        'h1', 
        '.promo-title', 
        '.hero-title',
        '[class*="title"]',
        '.main-heading'
      ],
      offer: [
        '.promo-description',
        '.offer-details', 
        '.deal-text',
        'p:contains("$")',
        '.content p'
      ],
      trigger: [
        '.trigger-condition',
        '.game-condition',
        'p:contains("win")',
        'p:contains("Dodgers")'
      ],
      value: [
        '.price',
        '.deal-value',
        'span:contains("$")',
        '.discount'
      ],
      code: [
        '.promo-code',
        '.code',
        '[class*="code"]',
        'input[type="text"]'
      ],
      instructions: [
        '.instructions',
        '.how-to',
        '.redemption',
        '.terms p:first-child'
      ],
      terms: [
        '.terms',
        '.fine-print',
        '.conditions',
        '.disclaimer'
      ],
      image: [
        '.hero-image img',
        '.promo-image img',
        '.main-image img',
        'img[src*="promo"]',
        'img[src*="deal"]'
      ]
    },
    extractors: {
      restaurant: (url: string) => 'Panda Express',
      parseOffer: (text: string) => {
        // Parse "$6 Panda plate for any Dodgers win"
        const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
        const itemMatch = text.match(/\$\d+(?:\.\d{2})?\s+([^,]+?)(?:\s+for|\s+when|$)/i);
        const triggerMatch = text.match(/(?:for|when)\s+(.+?)(?:\.|$)/i);
        
        return {
          offer: itemMatch ? itemMatch[1].trim() : text,
          value: priceMatch ? `$${priceMatch[1]}` : 'Special Price',
          trigger: triggerMatch ? triggerMatch[1].trim() : 'Dodgers win'
        };
      }
    }
  },
  {
    name: 'McDonald\'s',
    urlPattern: /mcdonalds\.com/i,
    selectors: {
      title: ['h1', '.hero-title', '.promo-headline'],
      offer: ['.offer-description', '.deal-details', 'p:contains("Free")'],
      trigger: ['p:contains("runs")', 'p:contains("score")', '.game-condition'],
      image: ['.hero-image img', '.promo-banner img', 'img[src*="promo"]']
    },
    extractors: {
      restaurant: (url: string) => 'McDonald\'s',
      parseOffer: (text: string) => {
        const freeMatch = text.match(/Free\s+([^,]+?)(?:\s+when|\s+with|$)/i);
        const triggerMatch = text.match(/(?:when|if)\s+(.+?)(?:\.|$)/i);
        
        return {
          offer: freeMatch ? freeMatch[1].trim() : text,
          value: 'Free',
          trigger: triggerMatch ? triggerMatch[1].trim() : 'Dodgers win'
        };
      }
    }
  },
  {
    name: 'Jack in the Box',
    urlPattern: /jackinthebox\.com/i,
    selectors: {
      title: ['h1', '.promo-title', '.deal-headline'],
      offer: ['.deal-description', 'p:contains("Free")', '.offer-text'],
      trigger: ['p:contains("strikeout")', 'p:contains("Dodgers")', '.condition'],
      image: ['.promo-image img', '.hero-banner img']
    },
    extractors: {
      restaurant: (url: string) => 'Jack in the Box',
      parseOffer: (text: string) => {
        const itemMatch = text.match(/Free\s+([^,]+?)(?:\s+when|$)/i);
        const strikeoutMatch = text.match(/(\d+)\+?\s*strikeout/i);
        
        return {
          offer: itemMatch ? itemMatch[1].trim() : 'Promotional Item',
          value: 'Free',
          trigger: strikeoutMatch ? `${strikeoutMatch[1]}+ strikeouts` : 'Pitching performance'
        };
      }
    }
  }
];

export class DealExtractionEngine {
  private browser: puppeteer.Browser | null = null;

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private getPattern(url: string): ExtractionPattern | null {
    return EXTRACTION_PATTERNS.find(pattern => pattern.urlPattern.test(url)) || null;
  }

  private async extractTextFromSelectors(page: puppeteer.Page, selectors: string[]): Promise<string> {
    console.log(`Trying selectors: ${selectors.join(', ')}`);
    
    for (const selector of selectors) {
      try {
        // Also try contains() selectors for text content
        if (selector.includes(':contains(')) {
          const textContent = await page.evaluate(() => document.body.innerText);
          const match = textContent.match(new RegExp(selector.replace(':contains("', '').replace('")', ''), 'i'));
          if (match) {
            console.log(`Found text via content search: ${match[0]}`);
            return match[0];
          }
        } else {
          const element = await page.$(selector);
          if (element) {
            const text = await page.evaluate(el => el.textContent?.trim() || '', element);
            if (text && text.length > 0) {
              console.log(`Found text with selector "${selector}": ${text.substring(0, 100)}...`);
              return text;
            }
          }
        }
      } catch (error) {
        console.log(`Selector failed: ${selector}, error: ${error.message}`);
      }
    }
    
    console.log('No text found with any selector');
    return '';
  }

  private async extractImageFromSelectors(page: puppeteer.Page, selectors: string[], baseUrl: string): Promise<string> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const src = await page.evaluate(el => el.src || el.getAttribute('src'), element);
          if (src) {
            // Convert relative URLs to absolute
            return src.startsWith('http') ? src : new URL(src, baseUrl).href;
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    return '';
  }

  private extractFromContent(content: string, restaurantName: string): {
    title: string;
    offer: string;
    trigger: string;
    value: string;
    confidence: number;
  } {
    console.log('Analyzing page content for deal information...');
    
    // For Panda Express specifically
    if (restaurantName === 'Panda Express') {
      // Look for deal patterns in content
      const dollarMatch = content.match(/\$(\d+(?:\.\d{2})?)/);
      const plateMatch = content.match(/plate|bowl|entree/i);
      const dodgersMatch = content.match(/dodgers?\s+(win|victory|beat)/i);
      
      if (dollarMatch && plateMatch && dodgersMatch) {
        return {
          title: `Panda Express Dodgers Win Deal`,
          offer: `${dollarMatch[0]} Panda Plate`,
          trigger: 'Any Dodgers win',
          value: dollarMatch[0],
          confidence: 0.85
        };
      }
      
      // Fallback extraction based on content keywords
      if (content.toLowerCase().includes('dodgers') && (dollarMatch || content.toLowerCase().includes('deal'))) {
        return {
          title: `Panda Express Dodgers Promotion`,
          offer: dollarMatch ? `${dollarMatch[0]} deal` : 'Special offer',
          trigger: 'Dodgers team performance',
          value: dollarMatch ? dollarMatch[0] : 'Special Price',
          confidence: 0.65
        };
      }
    }
    
    return {
      title: '',
      offer: '',
      trigger: '',
      value: '',
      confidence: 0
    };
  }

  async extractDealFromUrl(url: string): Promise<ExtractedDeal | null> {
    console.log(`Starting extraction for URL: ${url}`);
    
    const pattern = this.getPattern(url);
    if (!pattern) {
      console.log(`No extraction pattern found for URL: ${url}`);
      return null;
    }

    console.log(`Using pattern: ${pattern.name}`);
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // Set user agent to avoid blocking
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to page with longer timeout
      console.log(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      // Extract content using pattern selectors
      const title = await this.extractTextFromSelectors(page, pattern.selectors.title || []);
      const offerText = await this.extractTextFromSelectors(page, pattern.selectors.offer || []);
      const triggerText = await this.extractTextFromSelectors(page, pattern.selectors.trigger || []);
      const valueText = await this.extractTextFromSelectors(page, pattern.selectors.value || []);
      const codeText = await this.extractTextFromSelectors(page, pattern.selectors.code || []);
      const instructionsText = await this.extractTextFromSelectors(page, pattern.selectors.instructions || []);
      const termsText = await this.extractTextFromSelectors(page, pattern.selectors.terms || []);
      const imageUrl = await this.extractImageFromSelectors(page, pattern.selectors.image || [], url);

      // Parse offer using restaurant-specific logic
      const combinedText = [title, offerText, triggerText].join(' ');
      const parsed = pattern.extractors.parseOffer(combinedText);

      // Calculate confidence based on extracted data quality
      let confidence = 0.3; // Base confidence
      if (title) confidence += 0.2;
      if (parsed.offer && parsed.offer !== combinedText) confidence += 0.2;
      if (parsed.trigger && parsed.trigger !== 'Dodgers win') confidence += 0.15;
      if (parsed.value && parsed.value !== 'Special Price') confidence += 0.1;
      if (imageUrl) confidence += 0.05;

      const extractedDeal: ExtractedDeal = {
        title: title || `${pattern.extractors.restaurant(url)} Dodgers Deal`,
        restaurant: pattern.extractors.restaurant(url),
        offerDescription: parsed.offer || offerText || 'Special promotional offer',
        triggerCondition: parsed.trigger || triggerText || 'When the LA Dodgers win',
        dealValue: parsed.value || valueText || 'Special Price',
        promoCode: codeText || undefined,
        instructions: instructionsText || 'Present this offer at participating locations',
        terms: termsText || 'Terms and conditions apply. Valid while supplies last.',
        imageUrl: imageUrl || undefined,
        sourceUrl: url,
        confidence: Math.min(confidence, 1.0)
      };

      console.log(`Successfully extracted deal from ${url}:`, extractedDeal);
      return extractedDeal;

    } catch (error) {
      console.error(`Error extracting deal from ${url}:`, error);
      return null;
    } finally {
      await page.close();
    }
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

  async batchEnhanceDiscoveredSites(limit: number = 10): Promise<number> {
    try {
      // Get pending sites that haven't been enhanced yet
      const sites = await storage.getPendingDiscoveredSites(limit);
      let enhancedCount = 0;

      for (const site of sites) {
        if (!site.dealExtracted) {
          const extracted = await this.enhanceDiscoveredSite(site.id);
          if (extracted) {
            enhancedCount++;
          }
          // Small delay to avoid overwhelming target sites
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return enhancedCount;

    } catch (error) {
      console.error('Error in batch enhancement:', error);
      return 0;
    }
  }
}

export const dealExtractionEngine = new DealExtractionEngine();