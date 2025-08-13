import { db } from "../supabaseDb";
import { discoveredSites } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface ExtractedDeal {
  restaurant: string;
  offer: string;
  trigger: string;
  promoCode?: string;
  restrictions?: string;
}

export class TeamDealExtractor {
  
  /**
   * Extract team-specific deals from multi-team posts
   */
  async extractTeamDeals(siteId: number, teamName: string = "Dodgers"): Promise<ExtractedDeal[]> {
    // Get the discovered site
    const [site] = await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.id, siteId));

    if (!site || !site.content) {
      return [];
    }

    // Extract just the team-specific section
    const teamSection = this.extractTeamSection(site.content, teamName);
    if (!teamSection) {
      return [];
    }

    // Parse individual deals from the team section
    const deals = this.parseDealsFromSection(teamSection);
    
    // Update the discovered site with extracted team info
    if (deals.length > 0) {
      await db.update(discoveredSites)
        .set({
          teamDetected: teamName,
          restaurantDetected: deals.map(d => d.restaurant).join(", "),
          triggerDetected: this.inferTriggerFromPost(site.title, teamSection),
          promoCodeDetected: deals.map(d => d.promoCode).filter(Boolean).join(", ")
        })
        .where(eq(discoveredSites.id, siteId));
    }

    return deals;
  }

  /**
   * Extract just the section for a specific team from a multi-team post
   */
  private extractTeamSection(content: string, teamName: string): string | null {
    // Common patterns for team sections
    const patterns = [
      // Reddit format: r/Dodgers **(valid in LA area)**
      new RegExp(`r/${teamName}.*?\\n\\n(?:r/|Daily|$)`, 'si'),
      // Alternative: **Dodgers** or **Los Angeles Dodgers**
      new RegExp(`\\*\\*(?:Los Angeles )?${teamName}\\*\\*.*?\\n\\n(?:\\*\\*|Daily|$)`, 'si'),
      // Section headers: === Dodgers === 
      new RegExp(`={2,}\\s*${teamName}\\s*={2,}.*?(?:={2,}|$)`, 'si')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    // Fallback: Look for team name and extract surrounding lines
    const lines = content.split('\n');
    let teamStartIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(teamName.toLowerCase())) {
        teamStartIdx = i;
        break;
      }
    }

    if (teamStartIdx === -1) return null;

    // Extract lines until we hit another team or end
    const teamLines = [];
    for (let i = teamStartIdx; i < lines.length; i++) {
      const line = lines[i];
      
      // Stop if we hit another team section
      if (i > teamStartIdx && this.isTeamHeader(line) && !line.includes(teamName)) {
        break;
      }
      
      teamLines.push(line);
      
      // Stop after we've collected a few deal lines
      if (teamLines.length > 1 && line.trim() === '') {
        // Check if next line is another team
        if (i + 1 < lines.length && this.isTeamHeader(lines[i + 1])) {
          break;
        }
      }
    }

    return teamLines.join('\n').trim();
  }

  /**
   * Parse individual deals from a team section
   */
  private parseDealsFromSection(section: string): ExtractedDeal[] {
    const deals: ExtractedDeal[] = [];
    const lines = section.split('\n');

    for (const line of lines) {
      // Skip headers and empty lines
      if (!line.trim() || this.isTeamHeader(line)) continue;

      // Parse deal lines (usually start with emoji or bullet)
      if (line.match(/^[🍔🥡🍕🌮🍟🥤🍨🍲🥖•\-\*]/)) {
        const deal = this.parseDealLine(line);
        if (deal) {
          deals.push(deal);
        }
      }
    }

    return deals;
  }

  /**
   * Parse a single deal line
   */
  private parseDealLine(line: string): ExtractedDeal | null {
    // Remove emoji and clean up
    const cleanLine = line.replace(/^[🍔🥡🍕🌮🍟🥤🍨🍲🥖•\-\*]\s*/, '').trim();

    // First extract restaurant name
    const restaurant = this.extractRestaurant(cleanLine);
    
    // Common patterns
    const patterns = [
      // "Free X from Y when/with Z"
      /(?:Free|BOGO|\$\d+|%\s*off)\s+(.+?)\s+from\s+(.+?)(?:\s+when|\s+with|\s+using)?(?:\s+(.+))?$/i,
      // "$X Item from Restaurant using code CODE"
      /(\$\d+\s+.+?)\s+from\s+(.+?)\s+(?:when\s+)?using\s+code\s+(\w+)/i,
      // "Free Item from Restaurant"
      /(Free\s+.+?)\s+from\s+(.+?)$/i,
      // Special case for price offers: "$6 Panda Plate from Panda Express"
      /(\$\d+\s+.+?)(?:\s+from\s+.+?)?(?:\s+when|\s+using)?(?:\s+(.+))?$/i
    ];

    // Since we already extracted restaurant, we can build the deal
    if (restaurant && restaurant !== "Unknown") {
      const offer = this.extractOffer(cleanLine);
      const trigger = this.extractTrigger(cleanLine);
      const promoCode = this.extractPromoCode(cleanLine);

      return {
        restaurant,
        offer: offer || cleanLine,
        trigger: trigger || "game win",
        promoCode,
        restrictions: this.extractRestrictions(cleanLine)
      };
    }

    return null;
  }

  private extractOffer(text: string): string | null {
    // Extract the offer description
    const patterns = [
      /(Free\s+.+?)(?:\s+from|$)/i,
      /(\$\d+\s+.+?)(?:\s+from|$)/i,
      /(BOGO\s+.+?)(?:\s+from|$)/i,
      /(\d+%\s+off\s+.+?)(?:\s+from|$)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractRestaurant(text: string): string {
    // Known restaurant patterns
    const restaurants = [
      "McDonald's", "Jack in the Box", "Panda Express", "Taco Bell",
      "Pizza Hut", "Subway", "Arby's", "Little Caesar's", "Papa John's",  
      "Culver's", "99 Restaurants", "Wendy's", "Burger King", "KFC"
    ];

    for (const restaurant of restaurants) {
      if (text.toLowerCase().includes(restaurant.toLowerCase())) {
        return restaurant;
      }
    }

    // Try to extract from "from X" pattern
    const fromMatch = text.match(/from\s+([A-Z][^,\s]+(?:\s+[A-Z][^,\s]+)*)/);
    if (fromMatch) {
      return fromMatch[1];
    }

    return "Unknown";
  }

  private extractPromoCode(text: string): string | undefined {
    // Look for promo codes
    const codePatterns = [
      /code\s+(\w+)/i,
      /promo\s+(\w+)/i,
      /using\s+(\w+)/i,
      /\b([A-Z]{3,}[0-9]+)\b/, // DODGERS25 pattern
      /\b([A-Z]{4,})\b/ // DODGERSWIN pattern
    ];

    for (const pattern of codePatterns) {
      const match = text.match(pattern);
      if (match && match[1].length > 3) {
        return match[1];
      }
    }

    return undefined;
  }

  private extractTrigger(text: string): string | null {
    // Common trigger patterns
    if (text.includes("win")) return "team wins";
    if (text.includes("score") && text.includes("6")) return "score 6+ runs";
    if (text.includes("home run")) return "home run hit";
    if (text.includes("strikeout")) return "strikeouts";
    if (text.includes("purchase")) return "with purchase";
    
    return null;
  }

  private extractRestrictions(text: string): string | undefined {
    const restrictions = [];
    
    if (text.includes("app")) restrictions.push("app required");
    if (text.includes("purchase")) restrictions.push("purchase required");
    if (text.includes("minimum")) restrictions.push("minimum purchase");
    if (text.match(/\$\d+/)) restrictions.push("minimum spend");
    
    return restrictions.length > 0 ? restrictions.join(", ") : undefined;
  }

  private isTeamHeader(line: string): boolean {
    return !!(
      line.match(/^r\/\w+/) || // Reddit team subreddit
      line.match(/\*\*.*\*\*/) || // Bold team name
      line.match(/^={2,}/) || // Section divider
      line.includes("area)**") // Location indicator
    );
  }

  private inferTriggerFromPost(title: string, content: string): string {
    // Check if this is a win-triggered deal
    if (title.includes("Win") || content.includes("WIN")) {
      return "team wins";
    }
    
    // Default for daily deals
    if (title.includes("Daily") || title.includes("MLB Free Food")) {
      return "game played";
    }
    
    return "varies by promotion";
  }
}