/**
 * Circuit Breaker Implementation
 * 
 * Provides fault tolerance for external API calls by implementing
 * the circuit breaker pattern with exponential backoff and health monitoring.
 */

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting to close circuit */
  resetTimeout: number;
  /** Time in ms to monitor for failures */
  monitoringPeriod: number;
  /** Expected response time threshold in ms */
  timeoutThreshold: number;
  /** Name for logging/monitoring */
  name: string;
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not calling service
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  totalFailures: number;
  uptime: number; // Percentage
  avgResponseTime: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private lastStateChange = new Date();
  private totalRequests = 0;
  private totalFailures = 0;
  private responseTimes: number[] = [];
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      timeoutThreshold: 5000, // 5 seconds
      name: 'circuit-breaker',
      ...options
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`🔄 Circuit breaker ${this.options.name} moving to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN - failing fast`);
      }
    }

    const startTime = Date.now();
    this.totalRequests++;

    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn);
      
      const responseTime = Date.now() - startTime;
      this.recordSuccess(responseTime);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordFailure(error, responseTime);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${this.options.timeoutThreshold}ms`));
      }, this.options.timeoutThreshold);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Record successful execution
   */
  private recordSuccess(responseTime: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.responseTimes.push(responseTime);
    
    // Keep only recent response times
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-50);
    }

    // Reset failure count and potentially close circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.lastStateChange = new Date();
      console.log(`✅ Circuit breaker ${this.options.name} closed after successful test`);
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count periodically during normal operation
      const timeSinceLastFailure = this.lastFailureTime 
        ? Date.now() - this.lastFailureTime.getTime()
        : Infinity;
        
      if (timeSinceLastFailure > this.options.monitoringPeriod) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(error: any, responseTime: number): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.responseTimes.push(responseTime);

    console.warn(`⚠️ Circuit breaker ${this.options.name} recorded failure:`, error.message);

    // Open circuit if failure threshold exceeded
    if (this.failureCount >= this.options.failureThreshold && 
        this.state === CircuitState.CLOSED) {
      this.state = CircuitState.OPEN;
      this.lastStateChange = new Date();
      console.error(`🚨 Circuit breaker ${this.options.name} OPENED after ${this.failureCount} failures`);
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Failed during test - go back to open
      this.state = CircuitState.OPEN;
      this.lastStateChange = new Date();
      console.error(`🚨 Circuit breaker ${this.options.name} back to OPEN after failed test`);
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (this.state !== CircuitState.OPEN) return false;
    
    const timeSinceOpen = Date.now() - this.lastStateChange.getTime();
    return timeSinceOpen >= this.options.resetTimeout;
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    const uptime = this.totalRequests > 0 
      ? ((this.totalRequests - this.totalFailures) / this.totalRequests) * 100 
      : 100;

    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      uptime: Math.round(uptime * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime)
    };
  }

  /**
   * Force circuit open (for maintenance)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastStateChange = new Date();
    console.log(`🔧 Circuit breaker ${this.options.name} manually opened`);
  }

  /**
   * Force circuit closed (after maintenance)
   */
  forceClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastStateChange = new Date();
    console.log(`🔧 Circuit breaker ${this.options.name} manually closed`);
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.lastStateChange = new Date();
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.responseTimes = [];
    console.log(`🔄 Circuit breaker ${this.options.name} reset`);
  }

  /**
   * Check if circuit is available for requests
   */
  isAvailable(): boolean {
    return this.state !== CircuitState.OPEN;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.options.name;
  }
}

/**
 * Circuit Breaker Manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for a service
   */
  getBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(serviceName: string, fn: () => Promise<T>, options?: Partial<CircuitBreakerOptions>): Promise<T> {
    const breaker = this.getBreaker(serviceName, options);
    return breaker.execute(fn);
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Get list of degraded services (open or half-open circuits)
   */
  getDegradedServices(): string[] {
    const degraded: string[] = [];
    for (const [name, breaker] of this.breakers) {
      if (breaker.getState() !== CircuitState.CLOSED) {
        degraded.push(name);
      }
    }
    return degraded;
  }

  /**
   * Force all circuits closed (emergency recovery)
   */
  forceAllClosed(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceClosed();
    }
    console.log('🔧 All circuit breakers manually closed');
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    console.log('🔄 All circuit breakers reset');
  }
}

// Global circuit breaker manager
export const circuitBreakers = new CircuitBreakerManager();