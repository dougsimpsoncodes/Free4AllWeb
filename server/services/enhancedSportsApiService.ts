/**
 * Enhanced Sports API Service - Phase 1.1
 * 
 * Builds on existing sportsApiService with Phase 0 infrastructure:
 * - Circuit breaker protection for reliability
 * - Rate limiting for API compliance  
 * - Evidence storage for audit trails
 * - Conditional requests for efficiency
 * - Health monitoring and metrics
 */

import { circuitBreakers } from '../lib/circuitBreaker.ts';
import { apiRateLimiters } from '../lib/rateLimiter.ts';
import { putImmutable, verifyStored } from '../services/evidence/storage.ts';
import { createEvidenceIntegrity } from '../services/evidence/hash.ts';

interface GameData {
  gameId: string;
  teams: {
    home: { id: number; name: string; score: number };
    away: { id: number; name: string; score: number };
  };
  status: {
    state: string;
    detailedState: string;
    isFinal: boolean;
  };
  timestamp: string;
  source: 'ESPN' | 'MLB';
  venue?: {
    id: number;
    name: string;
  };
  inning?: number;
}

interface SourceResponse {
  data: GameData;
  fetchedAt: string;
  responseTime: number;
  etag?: string;
  lastModified?: string;
}

interface ApiCallOptions {
  useConditionalRequest?: boolean;
  timeout?: number;
  skipRateLimit?: boolean;
}

export class EnhancedSportsApiService {
  private mlbUrl = 'https://statsapi.mlb.com/api/v1';
  private espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';
  private responseCache = new Map<string, { etag?: string; lastModified?: string }>();

  /**
   * Get game data with multi-source reliability and evidence storage
   */
  async getGameData(gameId: string, options: ApiCallOptions = {}): Promise<{
    success: boolean;
    data?: GameData;
    sources: SourceResponse[];
    consensus?: any;
    evidenceHash?: string;
    error?: string;
  }> {
    const sources: SourceResponse[] = [];
    const startTime = Date.now();

    try {
      // Attempt to fetch from both sources with protection
      const [espnResult, mlbResult] = await Promise.allSettled([
        this.fetchFromESPN(gameId, options),
        this.fetchFromMLB(gameId, options)
      ]);

      // Process ESPN result
      if (espnResult.status === 'fulfilled' && espnResult.value) {
        sources.push(espnResult.value);
      } else if (espnResult.status === 'rejected') {
        console.warn(`ESPN API failed for game ${gameId}:`, espnResult.reason.message);
      }

      // Process MLB result  
      if (mlbResult.status === 'fulfilled' && mlbResult.value) {
        sources.push(mlbResult.value);
      } else if (mlbResult.status === 'rejected') {
        console.warn(`MLB API failed for game ${gameId}:`, mlbResult.reason.message);
      }

      if (sources.length === 0) {
        return {
          success: false,
          sources: [],
          error: 'All data sources failed'
        };
      }

      // Store evidence of the API responses
      const evidence = {
        gameId,
        sources: sources.map(s => ({
          source: s.data.source,
          data: s.data,
          fetchedAt: s.fetchedAt,
          responseTime: s.responseTime
        })),
        requestedAt: new Date().toISOString(),
        totalResponseTime: Date.now() - startTime
      };

      const evidenceResult = await putImmutable(evidence);

      // For now, return the first successful source
      // Phase 1.2 will implement consensus logic
      const primaryData = sources[0].data;

      return {
        success: true,
        data: primaryData,
        sources,
        evidenceHash: evidenceResult.hash
      };

    } catch (error) {
      console.error(`Error fetching game data for ${gameId}:`, error);
      return {
        success: false,
        sources,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch data from ESPN API with circuit breaker and rate limiting
   */
  private async fetchFromESPN(gameId: string, options: ApiCallOptions = {}): Promise<SourceResponse> {
    // Check rate limiting
    if (!options.skipRateLimit) {
      const rateLimitResult = await apiRateLimiters.espn.consume();
      if (!rateLimitResult.allowed) {
        throw new Error(`ESPN API rate limited. Retry after ${rateLimitResult.retryAfter}s`);
      }
    }

    // Execute with circuit breaker protection
    return circuitBreakers.execute('espn-api', async () => {
      const startTime = Date.now();
      const url = `${this.espnUrl}/scoreboard`;

      // Prepare request headers
      const headers: HeadersInit = {
        'User-Agent': 'Free4AllWeb-ValidationSystem/1.0'
      };

      // Add conditional request headers if available
      const cacheKey = `espn-${gameId}`;
      if (options.useConditionalRequest && this.responseCache.has(cacheKey)) {
        const cached = this.responseCache.get(cacheKey)!;
        if (cached.etag) headers['If-None-Match'] = cached.etag;
        if (cached.lastModified) headers['If-Modified-Since'] = cached.lastModified;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(options.timeout || 8000)
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        throw new Error('ESPN data not modified (304)');
      }

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
      }

      const responseTime = Date.now() - startTime;
      const rawData = await response.json();

      // Cache response headers for future conditional requests
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      if (etag || lastModified) {
        this.responseCache.set(cacheKey, { etag: etag || undefined, lastModified: lastModified || undefined });
      }

      // Convert ESPN format to standardized GameData
      const gameData = this.convertESPNToGameData(rawData, gameId);

      return {
        data: gameData,
        fetchedAt: new Date().toISOString(),
        responseTime,
        etag: etag || undefined,
        lastModified: lastModified || undefined
      };
    }, {
      failureThreshold: 3,
      resetTimeout: 30000,
      timeoutThreshold: 8000
    });
  }

  /**
   * Fetch data from MLB API with circuit breaker and rate limiting
   */
  private async fetchFromMLB(gameId: string, options: ApiCallOptions = {}): Promise<SourceResponse> {
    // Check rate limiting
    if (!options.skipRateLimit) {
      const rateLimitResult = await apiRateLimiters.mlb.consume();
      if (!rateLimitResult.allowed) {
        throw new Error(`MLB API rate limited. Retry after ${rateLimitResult.retryAfter}s`);
      }
    }

    // Execute with circuit breaker protection
    return circuitBreakers.execute('mlb-api', async () => {
      const startTime = Date.now();
      const url = `${this.mlbUrl}/game/${gameId}/feed/live`;

      // Prepare request headers
      const headers: HeadersInit = {
        'User-Agent': 'Free4AllWeb-ValidationSystem/1.0'
      };

      // Add conditional request headers if available
      const cacheKey = `mlb-${gameId}`;
      if (options.useConditionalRequest && this.responseCache.has(cacheKey)) {
        const cached = this.responseCache.get(cacheKey)!;
        if (cached.etag) headers['If-None-Match'] = cached.etag;
        if (cached.lastModified) headers['If-Modified-Since'] = cached.lastModified;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(options.timeout || 10000)
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        throw new Error('MLB data not modified (304)');
      }

      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
      }

      const responseTime = Date.now() - startTime;
      const rawData = await response.json();

      // Cache response headers
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      if (etag || lastModified) {
        this.responseCache.set(cacheKey, { etag: etag || undefined, lastModified: lastModified || undefined });
      }

      // Convert MLB format to standardized GameData
      const gameData = this.convertMLBToGameData(rawData, gameId);

      return {
        data: gameData,
        fetchedAt: new Date().toISOString(),
        responseTime,
        etag: etag || undefined,
        lastModified: lastModified || undefined
      };
    }, {
      failureThreshold: 5, // Higher threshold for official API
      resetTimeout: 60000,
      timeoutThreshold: 10000
    });
  }

  /**
   * Convert ESPN API response to standardized GameData format
   */
  private convertESPNToGameData(rawData: any, gameId: string): GameData {
    // Find the specific game in ESPN's scoreboard response
    const game = rawData.events?.find((event: any) => event.id === gameId);
    
    if (!game) {
      throw new Error(`Game ${gameId} not found in ESPN response`);
    }

    const competition = game.competitions?.[0];
    if (!competition) {
      throw new Error(`No competition data found for game ${gameId}`);
    }

    const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) {
      throw new Error(`Incomplete team data for game ${gameId}`);
    }

    return {
      gameId,
      teams: {
        home: {
          id: parseInt(homeTeam.team.id),
          name: homeTeam.team.displayName,
          score: parseInt(homeTeam.score || '0')
        },
        away: {
          id: parseInt(awayTeam.team.id),
          name: awayTeam.team.displayName,
          score: parseInt(awayTeam.score || '0')
        }
      },
      status: {
        state: game.status.type.state,
        detailedState: game.status.type.description,
        isFinal: game.status.type.completed
      },
      timestamp: new Date().toISOString(),
      source: 'ESPN',
      venue: competition.venue ? {
        id: parseInt(competition.venue.id),
        name: competition.venue.fullName
      } : undefined,
      inning: competition.status?.period
    };
  }

  /**
   * Convert MLB API response to standardized GameData format
   */
  private convertMLBToGameData(rawData: any, gameId: string): GameData {
    const gameData = rawData.gameData;
    const liveData = rawData.liveData;

    if (!gameData || !liveData) {
      throw new Error(`Incomplete MLB data for game ${gameId}`);
    }

    const homeScore = liveData.linescore?.teams?.home?.runs || 0;
    const awayScore = liveData.linescore?.teams?.away?.runs || 0;

    return {
      gameId,
      teams: {
        home: {
          id: gameData.teams.home.id,
          name: gameData.teams.home.name,
          score: homeScore
        },
        away: {
          id: gameData.teams.away.id,
          name: gameData.teams.away.name,
          score: awayScore
        }
      },
      status: {
        state: gameData.status.abstractGameState,
        detailedState: gameData.status.detailedState,
        isFinal: gameData.status.abstractGameState === 'Final'
      },
      timestamp: new Date().toISOString(),
      source: 'MLB',
      venue: gameData.venue ? {
        id: gameData.venue.id,
        name: gameData.venue.name
      } : undefined,
      inning: liveData.linescore?.currentInning
    };
  }

  /**
   * Get health status of all data sources
   */
  async getSourceHealth(): Promise<{
    espn: { available: boolean; stats: any };
    mlb: { available: boolean; stats: any };
    overall: { healthy: boolean; degradedServices: string[] };
  }> {
    const espnBreaker = circuitBreakers.getBreaker('espn-api');
    const mlbBreaker = circuitBreakers.getBreaker('mlb-api');

    const espnStats = espnBreaker.getStats();
    const mlbStats = mlbBreaker.getStats();

    const degradedServices = circuitBreakers.getDegradedServices();

    return {
      espn: {
        available: espnBreaker.isAvailable(),
        stats: espnStats
      },
      mlb: {
        available: mlbBreaker.isAvailable(),
        stats: mlbStats
      },
      overall: {
        healthy: degradedServices.length === 0,
        degradedServices
      }
    };
  }

  /**
   * Get rate limiting status for all APIs
   */
  async getRateLimitStatus(): Promise<{
    espn: any;
    mlb: any;
  }> {
    return {
      espn: apiRateLimiters.espn.getStatus(),
      mlb: apiRateLimiters.mlb.getStatus()
    };
  }

  /**
   * Force reset circuit breakers (admin function)
   */
  async resetCircuitBreakers(): Promise<void> {
    circuitBreakers.getBreaker('espn-api').reset();
    circuitBreakers.getBreaker('mlb-api').reset();
    console.log('🔄 All sports API circuit breakers reset');
  }

  /**
   * Clear response cache (for testing or troubleshooting)
   */
  clearCache(): void {
    this.responseCache.clear();
    console.log('🗑️ Sports API response cache cleared');
  }
}

// Global enhanced service instance
export const enhancedSportsApi = new EnhancedSportsApiService();