/**
 * Rate Limiter Implementation
 * 
 * Provides token bucket and sliding window rate limiting
 * to protect external APIs and prevent abuse.
 */

export interface RateLimiterOptions {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier for this rate limiter */
  identifier: string;
  /** Whether to use token bucket (true) or sliding window (false) */
  useTokenBucket?: boolean;
  /** Token refill rate (tokens per second, only for token bucket) */
  refillRate?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current count/tokens remaining */
  remaining: number;
  /** Reset time for the current window */
  resetTime: Date;
  /** Total limit for this limiter */
  limit: number;
  /** Retry after seconds (if rate limited) */
  retryAfter?: number;
}

/**
 * Token Bucket Rate Limiter
 * Allows bursts up to bucket capacity, then refills at steady rate
 */
export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: Date;
  private readonly options: Required<RateLimiterOptions>;

  constructor(options: RateLimiterOptions) {
    this.options = {
      useTokenBucket: true,
      refillRate: options.maxRequests / (options.windowMs / 1000), // Default: spread evenly over window
      ...options
    } as Required<RateLimiterOptions>;

    this.tokens = this.options.maxRequests;
    this.lastRefill = new Date();
  }

  /**
   * Attempt to consume tokens
   */
  async consume(tokens: number = 1): Promise<RateLimitResult> {
    this.refillTokens();

    const allowed = this.tokens >= tokens;
    
    if (allowed) {
      this.tokens -= tokens;
    }

    const resetTime = new Date(Date.now() + this.options.windowMs);
    const retryAfter = allowed ? undefined : Math.ceil((tokens - this.tokens) / this.options.refillRate);

    return {
      allowed,
      remaining: Math.floor(this.tokens),
      resetTime,
      limit: this.options.maxRequests,
      retryAfter
    };
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = new Date();
    const timePassed = (now.getTime() - this.lastRefill.getTime()) / 1000;
    const tokensToAdd = timePassed * this.options.refillRate;

    this.tokens = Math.min(this.options.maxRequests, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current status without consuming tokens
   */
  getStatus(): RateLimitResult {
    this.refillTokens();
    
    return {
      allowed: this.tokens >= 1,
      remaining: Math.floor(this.tokens),
      resetTime: new Date(Date.now() + this.options.windowMs),
      limit: this.options.maxRequests
    };
  }

  /**
   * Reset the bucket (fill with tokens)
   */
  reset(): void {
    this.tokens = this.options.maxRequests;
    this.lastRefill = new Date();
  }
}

/**
 * Sliding Window Rate Limiter
 * Tracks requests over a moving time window
 */
export class SlidingWindowLimiter {
  private requests: Date[] = [];
  private readonly options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  /**
   * Attempt to make a request
   */
  async consume(count: number = 1): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.options.windowMs);

    // Remove expired requests
    this.requests = this.requests.filter(req => req > windowStart);

    const currentCount = this.requests.length;
    const allowed = currentCount + count <= this.options.maxRequests;

    if (allowed) {
      // Add new requests
      for (let i = 0; i < count; i++) {
        this.requests.push(now);
      }
    }

    const remaining = Math.max(0, this.options.maxRequests - this.requests.length);
    const resetTime = this.requests.length > 0 
      ? new Date(this.requests[0].getTime() + this.options.windowMs)
      : new Date(now.getTime() + this.options.windowMs);

    const retryAfter = allowed ? undefined : Math.ceil(
      (this.requests[0].getTime() + this.options.windowMs - now.getTime()) / 1000
    );

    return {
      allowed,
      remaining,
      resetTime,
      limit: this.options.maxRequests,
      retryAfter
    };
  }

  /**
   * Get current status without consuming
   */
  getStatus(): RateLimitResult {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.options.windowMs);

    // Remove expired requests
    this.requests = this.requests.filter(req => req > windowStart);

    const remaining = Math.max(0, this.options.maxRequests - this.requests.length);
    const resetTime = this.requests.length > 0 
      ? new Date(this.requests[0].getTime() + this.options.windowMs)
      : new Date(now.getTime() + this.options.windowMs);

    return {
      allowed: remaining > 0,
      remaining,
      resetTime,
      limit: this.options.maxRequests
    };
  }

  /**
   * Reset the window
   */
  reset(): void {
    this.requests = [];
  }
}

/**
 * Rate Limiter Factory
 */
export function createRateLimiter(options: RateLimiterOptions): TokenBucketLimiter | SlidingWindowLimiter {
  if (options.useTokenBucket !== false) {
    return new TokenBucketLimiter(options);
  } else {
    return new SlidingWindowLimiter(options);
  }
}

/**
 * Global Rate Limiter Manager
 */
export class RateLimiterManager {
  private limiters = new Map<string, TokenBucketLimiter | SlidingWindowLimiter>();

  /**
   * Get or create rate limiter for an identifier
   */
  getLimiter(identifier: string, options: Omit<RateLimiterOptions, 'identifier'>): TokenBucketLimiter | SlidingWindowLimiter {
    const key = identifier;
    
    if (!this.limiters.has(key)) {
      this.limiters.set(key, createRateLimiter({ identifier, ...options }));
    }
    
    return this.limiters.get(key)!;
  }

  /**
   * Consume from a rate limiter
   */
  async consume(identifier: string, options: Omit<RateLimiterOptions, 'identifier'>, tokens: number = 1): Promise<RateLimitResult> {
    const limiter = this.getLimiter(identifier, options);
    return limiter.consume(tokens);
  }

  /**
   * Get status of a rate limiter
   */
  getStatus(identifier: string, options: Omit<RateLimiterOptions, 'identifier'>): RateLimitResult {
    const limiter = this.getLimiter(identifier, options);
    return limiter.getStatus();
  }

  /**
   * Reset a specific rate limiter
   */
  reset(identifier: string): void {
    const limiter = this.limiters.get(identifier);
    if (limiter) {
      limiter.reset();
    }
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Get statistics for all rate limiters
   */
  getAllStatus(): Record<string, RateLimitResult> {
    const status: Record<string, RateLimitResult> = {};
    
    for (const [identifier, limiter] of this.limiters) {
      status[identifier] = limiter.getStatus();
    }
    
    return status;
  }

  /**
   * Cleanup expired limiters (optional memory management)
   */
  cleanup(): void {
    // For in-memory implementation, we could remove limiters that haven't been used recently
    // This is optional since the Map will naturally limit growth
  }
}

/**
 * Pre-configured rate limiters for common external APIs
 */
export const apiRateLimiters = {
  /**
   * ESPN API rate limiter
   * Conservative limits to avoid hitting their rate limits
   */
  espn: createRateLimiter({
    identifier: 'espn-api',
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    useTokenBucket: true,
    refillRate: 1.5 // ~1.5 requests per second
  }),

  /**
   * MLB API rate limiter
   * Higher limits as it's an official API
   */
  mlb: createRateLimiter({
    identifier: 'mlb-api',
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
    useTokenBucket: true,
    refillRate: 3 // ~3 requests per second
  }),

  /**
   * Google Custom Search API rate limiter
   * Based on Google's documented limits
   */
  google: createRateLimiter({
    identifier: 'google-api',
    maxRequests: 100,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    useTokenBucket: false // Use sliding window for daily limits
  }),

  /**
   * Twitter API rate limiter
   * Based on Twitter API v2 limits
   */
  twitter: createRateLimiter({
    identifier: 'twitter-api',
    maxRequests: 300,
    windowMs: 15 * 60 * 1000, // 15 minutes
    useTokenBucket: true,
    refillRate: 0.33 // ~20 requests per minute
  }),

  /**
   * General external API rate limiter
   * Conservative default for unknown APIs
   */
  general: createRateLimiter({
    identifier: 'general-api',
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    useTokenBucket: true,
    refillRate: 1 // 1 request per second
  })
};

// Global rate limiter manager
export const rateLimiters = new RateLimiterManager();