export interface DealPattern {
  id: string;
  restaurant: string;
  team: string;
  sport: string;
  triggerType: 'win' | 'score' | 'performance' | 'occurrence';
  conditions: {
    venue?: 'home' | 'away' | 'any';
    scoreThreshold?: number;
    margin?: number;
    occurrenceType?: string;
  };
  reward: {
    item: string;
    value: string;
    promoCode?: string;
  };
  patterns: string[];
  confidence: number;
  seasonalPattern: boolean;
  lastSeen?: Date;
}

export class DealPatternMatcher {
  
  // Known recurring patterns from major LA sports deals
  private knownPatterns: DealPattern[] = [
    {
      id: 'mcdonalds-dodgers-6runs',
      restaurant: "McDonald's",
      team: 'Dodgers',
      sport: 'MLB',
      triggerType: 'score',
      conditions: {
        venue: 'home',
        scoreThreshold: 6
      },
      reward: {
        item: '6pc McNuggets',
        value: 'free',
        promoCode: 'DODGERS6'
      },
      patterns: [
        'free {item} when dodgers score {score}+ runs',
        'free mcnuggets dodgers 6 runs home',
        'when the dodgers score 6 or more runs at home'
      ],
      confidence: 0.95,
      seasonalPattern: true
    },
    {
      id: 'pandaexpress-dodgers-homewin',
      restaurant: 'Panda Express',
      team: 'Dodgers',
      sport: 'MLB',
      triggerType: 'win',
      conditions: {
        venue: 'home'
      },
      reward: {
        item: 'Panda Plate',
        value: '$6',
        promoCode: 'DODGERSWIN'
      },
      patterns: [
        '$6 panda plate dodgers home win',
        'when dodgers win at home',
        'following any dodgers home victory'
      ],
      confidence: 0.90,
      seasonalPattern: true
    },
    {
      id: 'jackinthebox-lakers-20point',
      restaurant: 'Jack in the Box',
      team: 'Lakers',
      sport: 'NBA',
      triggerType: 'performance',
      conditions: {
        venue: 'home',
        margin: 20
      },
      reward: {
        item: 'Jumbo Jack',
        value: 'free',
        promoCode: 'LAKERS20'
      },
      patterns: [
        'free jumbo jack lakers win 20+ points',
        'when lakers win by 20 or more points at staples',
        'lakers 20 point victory free burger'
      ],
      confidence: 0.88,
      seasonalPattern: true
    },
    {
      id: 'ampm-dodgers-stolenbase',
      restaurant: 'ampm',
      team: 'Dodgers',
      sport: 'MLB',
      triggerType: 'occurrence',
      conditions: {
        venue: 'home',
        occurrenceType: 'stolen base'
      },
      reward: {
        item: 'Hot Dog + Drink',
        value: 'free',
        promoCode: 'STEALBASE'
      },
      patterns: [
        'free hot dog when dodgers steal base',
        'dodgers stolen base free hot dog',
        'steal a base get free hot dog'
      ],
      confidence: 0.85,
      seasonalPattern: true
    },
    {
      id: 'deltaco-rams-homewin',
      restaurant: 'Del Taco',
      team: 'Rams',
      sport: 'NFL',
      triggerType: 'win',
      conditions: {
        venue: 'home'
      },
      reward: {
        item: 'Del Beef Taco',
        value: 'free',
        promoCode: 'RAMSWIN'
      },
      patterns: [
        'free del beef taco rams home win',
        'when rams win at sofi stadium',
        'rams victory free taco'
      ],
      confidence: 0.87,
      seasonalPattern: true
    }
  ];

  // Advanced pattern matching using fuzzy matching and NLP techniques
  matchDealPattern(text: string, restaurant: string, team: string): {
    pattern: DealPattern | null;
    confidence: number;
    extractedData: any;
  } {
    const cleanText = this.normalizeText(text);
    let bestMatch: DealPattern | null = null;
    let bestConfidence = 0;
    let extractedData = {};

    for (const pattern of this.knownPatterns) {
      if (pattern.restaurant !== restaurant || pattern.team !== team) continue;

      const matchResult = this.calculatePatternMatch(cleanText, pattern);
      
      if (matchResult.confidence > bestConfidence && matchResult.confidence > 0.7) {
        bestMatch = pattern;
        bestConfidence = matchResult.confidence;
        extractedData = matchResult.extractedData;
      }
    }

    return {
      pattern: bestMatch,
      confidence: bestConfidence,
      extractedData
    };
  }

  private calculatePatternMatch(text: string, pattern: DealPattern): {
    confidence: number;
    extractedData: any;
  } {
    let confidence = 0;
    const extractedData: any = {};

    // Check each pattern variant
    for (const patternText of pattern.patterns) {
      const patternMatch = this.fuzzyPatternMatch(text, patternText);
      confidence = Math.max(confidence, patternMatch.score);
      
      if (patternMatch.extractedData) {
        Object.assign(extractedData, patternMatch.extractedData);
      }
    }

    // Boost confidence based on key components
    if (this.containsReward(text, pattern.reward)) confidence += 0.1;
    if (this.containsTrigger(text, pattern)) confidence += 0.1;
    if (this.containsPromoCode(text, pattern.reward.promoCode)) confidence += 0.05;

    // Seasonal adjustment
    if (pattern.seasonalPattern && this.isInSeason(pattern.sport)) {
      confidence += 0.05;
    }

    return { confidence: Math.min(confidence, 1.0), extractedData };
  }

  private fuzzyPatternMatch(text: string, pattern: string): {
    score: number;
    extractedData: any;
  } {
    const textWords = this.tokenize(text);
    const patternWords = this.tokenize(pattern);
    const extractedData: any = {};
    
    let matchedWords = 0;
    let totalWords = patternWords.length;
    
    for (const patternWord of patternWords) {
      if (patternWord.startsWith('{') && patternWord.endsWith('}')) {
        // Variable placeholder - extract value
        const varName = patternWord.slice(1, -1);
        const extractedValue = this.extractVariable(textWords, varName, patternWord);
        if (extractedValue) {
          extractedData[varName] = extractedValue;
          matchedWords++;
        }
      } else {
        // Exact word match with fuzzy tolerance
        const found = textWords.some(textWord => 
          this.wordSimilarity(textWord, patternWord) > 0.8
        );
        if (found) matchedWords++;
      }
    }

    const score = matchedWords / totalWords;
    return { score, extractedData };
  }

  private extractVariable(textWords: string[], varName: string, placeholder: string): string | null {
    switch (varName) {
      case 'score':
        return textWords.find(word => /^\d+$/.test(word)) || null;
      case 'item':
        // Extract food item names
        const foodItems = ['mcnuggets', 'burger', 'taco', 'plate', 'jack', 'hot dog'];
        return textWords.find(word => foodItems.some(item => word.includes(item))) || null;
      default:
        return null;
    }
  }

  private wordSimilarity(word1: string, word2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(word1, word2);
    const maxLength = Math.max(word1.length, word2.length);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private containsReward(text: string, reward: any): boolean {
    const rewardTerms = [
      reward.item.toLowerCase(),
      reward.value.toLowerCase()
    ];
    
    return rewardTerms.some(term => text.includes(term));
  }

  private containsTrigger(text: string, pattern: DealPattern): boolean {
    const triggerWords = {
      'win': ['win', 'wins', 'victory', 'beat'],
      'score': ['score', 'scores', 'runs', 'points'],
      'performance': ['margin', 'by', 'more than'],
      'occurrence': ['steal', 'stolen', 'base', 'touchdown']
    };
    
    const relevantWords = triggerWords[pattern.triggerType] || [];
    return relevantWords.some(word => text.includes(word));
  }

  private containsPromoCode(text: string, promoCode?: string): boolean {
    if (!promoCode) return false;
    return text.includes(promoCode.toLowerCase()) || text.includes('promo') || text.includes('code');
  }

  private isInSeason(sport: string): boolean {
    const month = new Date().getMonth(); // 0-11
    
    switch (sport) {
      case 'MLB':
        return month >= 2 && month <= 9; // March-October
      case 'NBA':
        return month >= 9 || month <= 3; // October-April
      case 'NFL':
        return month >= 8 && month <= 1; // September-February
      default:
        return true;
    }
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    return this.normalizeText(text).split(' ').filter(word => word.length > 0);
  }

  // Generate new pattern from successful deal discovery
  generatePatternFromDeal(dealText: string, restaurant: string, team: string, sport: string): DealPattern | null {
    const cleanText = this.normalizeText(dealText);
    
    // Extract key components
    const reward = this.extractReward(cleanText);
    const trigger = this.extractTrigger(cleanText);
    const conditions = this.extractConditions(cleanText);
    
    if (!reward || !trigger) return null;

    return {
      id: `generated-${Date.now()}`,
      restaurant,
      team,
      sport,
      triggerType: trigger.type,
      conditions,
      reward,
      patterns: [cleanText],
      confidence: 0.7, // Generated patterns start with lower confidence
      seasonalPattern: this.isInSeason(sport)
    };
  }

  private extractReward(text: string): any | null {
    // Extract food items and values
    const freeMatch = text.match(/free\s+([^.]+)/);
    const dollarMatch = text.match(/\$(\d+)\s+([^.]+)/);
    
    if (freeMatch) {
      return {
        item: freeMatch[1].trim(),
        value: 'free'
      };
    }
    
    if (dollarMatch) {
      return {
        item: dollarMatch[2].trim(),
        value: `$${dollarMatch[1]}`
      };
    }
    
    return null;
  }

  private extractTrigger(text: string): { type: string; details: any } | null {
    if (text.includes('win')) {
      return { type: 'win', details: {} };
    }
    
    if (text.includes('score') || text.includes('runs')) {
      const scoreMatch = text.match(/(\d+)\+?\s*(runs?|points?)/);
      return {
        type: 'score',
        details: { threshold: scoreMatch ? parseInt(scoreMatch[1]) : null }
      };
    }
    
    if (text.includes('steal') || text.includes('stolen')) {
      return { type: 'occurrence', details: { occurrenceType: 'stolen base' } };
    }
    
    return null;
  }

  private extractConditions(text: string): any {
    const conditions: any = {};
    
    if (text.includes('home') || text.includes('at home')) {
      conditions.venue = 'home';
    } else if (text.includes('away')) {
      conditions.venue = 'away';
    }
    
    const marginMatch = text.match(/(\d+)\+?\s*points?/);
    if (marginMatch) {
      conditions.margin = parseInt(marginMatch[1]);
    }
    
    return conditions;
  }

  // Update pattern confidence based on validation
  updatePatternConfidence(patternId: string, wasCorrect: boolean): void {
    const pattern = this.knownPatterns.find(p => p.id === patternId);
    if (pattern) {
      if (wasCorrect) {
        pattern.confidence = Math.min(pattern.confidence + 0.05, 1.0);
      } else {
        pattern.confidence = Math.max(pattern.confidence - 0.1, 0.5);
      }
      pattern.lastSeen = new Date();
    }
  }

  getPatternStats(): { patterns: number; avgConfidence: number; lastUpdated: Date } {
    const avgConfidence = this.knownPatterns.reduce((sum, p) => sum + p.confidence, 0) / this.knownPatterns.length;
    const lastUpdated = this.knownPatterns
      .filter(p => p.lastSeen)
      .reduce((latest, p) => p.lastSeen! > latest ? p.lastSeen! : latest, new Date(0));
    
    return {
      patterns: this.knownPatterns.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      lastUpdated
    };
  }
}

export const dealPatternMatcher = new DealPatternMatcher();