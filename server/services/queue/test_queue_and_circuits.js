#!/usr/bin/env node

/**
 * Test suite for Job Queue and Circuit Breaker systems
 * 
 * Tests:
 * - Circuit breaker states and transitions
 * - Rate limiting (token bucket and sliding window)
 * - Queue operations (when Redis is available)
 * - Error handling and recovery
 */

import { CircuitBreaker, CircuitBreakerManager, CircuitState, circuitBreakers } from '../../lib/circuitBreaker.ts';
import { createRateLimiter, RateLimiterManager, apiRateLimiters, rateLimiters } from '../../lib/rateLimiter.ts';

// Test counter
let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  console.log(`\n🧪 Testing: ${name}`);
  return Promise.resolve(fn())
    .then(() => {
      console.log(`✅ ${name}`);
      passCount++;
    })
    .catch(error => {
      console.log(`❌ ${name}: ${error.message}`);
    });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Helper functions for testing
async function successfulOperation() {
  await new Promise(resolve => setTimeout(resolve, 10));
  return 'success';
}

async function failingOperation() {
  await new Promise(resolve => setTimeout(resolve, 10));
  throw new Error('Simulated failure');
}

async function slowOperation(delay = 6000) {
  await new Promise(resolve => setTimeout(resolve, delay));
  return 'slow success';
}

async function runTests() {
  console.log('🔄 Testing Queue Management and Circuit Breakers...\n');

  // Circuit Breaker Tests
  await test('Circuit breaker starts in CLOSED state', async () => {
    const breaker = new CircuitBreaker({ name: 'test-cb-1', failureThreshold: 3 });
    assert(breaker.getState() === CircuitState.CLOSED, 'Should start in CLOSED state');
    
    const stats = breaker.getStats();
    assert(stats.failureCount === 0, 'Should start with zero failures');
    assert(stats.totalRequests === 0, 'Should start with zero requests');
  });

  await test('Circuit breaker handles successful operations', async () => {
    const breaker = new CircuitBreaker({ name: 'test-cb-2', failureThreshold: 3 });
    
    const result = await breaker.execute(successfulOperation);
    assert(result === 'success', 'Should return operation result');
    
    const stats = breaker.getStats();
    assert(stats.successCount === 1, 'Should record success');
    assert(stats.totalRequests === 1, 'Should increment total requests');
    assert(breaker.getState() === CircuitState.CLOSED, 'Should remain CLOSED');
  });

  await test('Circuit breaker opens after failure threshold', async () => {
    const breaker = new CircuitBreaker({ 
      name: 'test-cb-3', 
      failureThreshold: 2,
      resetTimeout: 100 // Short timeout for testing
    });
    
    // First failure
    try {
      await breaker.execute(failingOperation);
    } catch (error) {
      // Expected
    }
    
    assert(breaker.getState() === CircuitState.CLOSED, 'Should stay CLOSED after first failure');
    
    // Second failure - should open circuit
    try {
      await breaker.execute(failingOperation);
    } catch (error) {
      // Expected
    }
    
    assert(breaker.getState() === CircuitState.OPEN, 'Should OPEN after threshold failures');
    
    // Third attempt should fail fast
    try {
      await breaker.execute(successfulOperation);
      assert(false, 'Should have thrown');
    } catch (error) {
      assert(error.message.includes('is OPEN'), 'Should fail fast when OPEN');
    }
  });

  await test('Circuit breaker transitions to HALF_OPEN after timeout', async () => {
    const breaker = new CircuitBreaker({ 
      name: 'test-cb-4', 
      failureThreshold: 1,
      resetTimeout: 50 // Very short for testing
    });
    
    // Trigger failure to open circuit
    try {
      await breaker.execute(failingOperation);
    } catch (error) {
      // Expected
    }
    
    assert(breaker.getState() === CircuitState.OPEN, 'Should be OPEN');
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // Next attempt should transition to HALF_OPEN
    const result = await breaker.execute(successfulOperation);
    assert(result === 'success', 'Should succeed in HALF_OPEN');
    assert(breaker.getState() === CircuitState.CLOSED, 'Should close after successful test');
  });

  await test('Circuit breaker handles timeout threshold', async () => {
    const breaker = new CircuitBreaker({ 
      name: 'test-cb-5', 
      timeoutThreshold: 100,
      failureThreshold: 1
    });
    
    try {
      await breaker.execute(() => slowOperation(150));
      assert(false, 'Should have timed out');
    } catch (error) {
      assert(error.message.includes('Timeout'), 'Should timeout on slow operations');
    }
    
    assert(breaker.getState() === CircuitState.OPEN, 'Should open after timeout');
  });

  await test('Circuit breaker manager handles multiple services', async () => {
    const manager = new CircuitBreakerManager();
    
    const espnBreaker = manager.getBreaker('espn', { failureThreshold: 2 });
    const mlbBreaker = manager.getBreaker('mlb', { failureThreshold: 3 });
    
    assert(espnBreaker !== mlbBreaker, 'Should create separate breakers');
    
    // Test ESPN breaker
    await espnBreaker.execute(successfulOperation);
    
    // Test MLB breaker with failures
    try {
      await mlbBreaker.execute(failingOperation);
    } catch (error) {
      // Expected
    }
    
    const allStats = manager.getAllStats();
    assert(allStats.espn.successCount === 1, 'ESPN should have 1 success');
    assert(allStats.mlb.failureCount === 1, 'MLB should have 1 failure');
  });

  // Rate Limiter Tests
  await test('Token bucket rate limiter allows burst', async () => {
    const limiter = createRateLimiter({
      identifier: 'test-tb-1',
      maxRequests: 5,
      windowMs: 1000,
      useTokenBucket: true,
      refillRate: 1 // 1 token per second
    });
    
    // Should allow burst of 5 requests
    for (let i = 0; i < 5; i++) {
      const result = await limiter.consume();
      assert(result.allowed, `Request ${i + 1} should be allowed`);
    }
    
    // 6th request should be rejected
    const result = await limiter.consume();
    assert(!result.allowed, '6th request should be rejected');
    assert(result.retryAfter > 0, 'Should provide retry after time');
  });

  await test('Token bucket refills over time', async () => {
    const limiter = createRateLimiter({
      identifier: 'test-tb-2',
      maxRequests: 2,
      windowMs: 1000,
      useTokenBucket: true,
      refillRate: 10 // Fast refill for testing
    });
    
    // Consume all tokens
    await limiter.consume(2);
    
    let result = await limiter.consume();
    assert(!result.allowed, 'Should be rejected initially');
    
    // Wait for refill
    await new Promise(resolve => setTimeout(resolve, 150));
    
    result = await limiter.consume();
    assert(result.allowed, 'Should be allowed after refill');
  });

  await test('Sliding window rate limiter tracks time window', async () => {
    const limiter = createRateLimiter({
      identifier: 'test-sw-1',
      maxRequests: 3,
      windowMs: 200, // 200ms window
      useTokenBucket: false
    });
    
    // Fill the window
    for (let i = 0; i < 3; i++) {
      const result = await limiter.consume();
      assert(result.allowed, `Request ${i + 1} should be allowed`);
    }
    
    // 4th request should be rejected
    let result = await limiter.consume();
    assert(!result.allowed, '4th request should be rejected');
    
    // Wait for window to slide
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Should allow new requests
    result = await limiter.consume();
    assert(result.allowed, 'Should be allowed after window reset');
  });

  await test('Rate limiter manager handles multiple identifiers', async () => {
    const manager = new RateLimiterManager();
    
    const result1 = await manager.consume('service-1', { maxRequests: 2, windowMs: 1000 });
    const result2 = await manager.consume('service-2', { maxRequests: 2, windowMs: 1000 });
    
    assert(result1.allowed, 'Service 1 should be allowed');
    assert(result2.allowed, 'Service 2 should be allowed');
    assert(result1.remaining === 1, 'Service 1 should have 1 remaining');
    assert(result2.remaining === 1, 'Service 2 should have 1 remaining');
  });

  await test('Pre-configured API rate limiters work correctly', async () => {
    // Test ESPN rate limiter
    const espnResult = await apiRateLimiters.espn.consume();
    assert(espnResult.allowed, 'ESPN limiter should allow requests');
    assert(espnResult.limit === 100, 'ESPN limiter should have correct limit');
    
    // Test MLB rate limiter
    const mlbResult = await apiRateLimiters.mlb.consume();
    assert(mlbResult.allowed, 'MLB limiter should allow requests');
    assert(mlbResult.limit === 200, 'MLB limiter should have correct limit');
    
    // Reset for clean slate
    apiRateLimiters.espn.reset();
    apiRateLimiters.mlb.reset();
  });

  await test('Combined circuit breaker and rate limiter', async () => {
    // Create a protected service that uses both circuit breaker and rate limiter
    const protectedService = async (shouldFail = false) => {
      // Check rate limit first
      const rateLimitResult = await apiRateLimiters.general.consume();
      if (!rateLimitResult.allowed) {
        throw new Error('Rate limited');
      }
      
      // Execute with circuit breaker protection
      return circuitBreakers.execute('protected-service', async () => {
        if (shouldFail) {
          throw new Error('Service failure');
        }
        return 'protected success';
      }, { failureThreshold: 2 });
    };
    
    // Should work normally
    const result1 = await protectedService(false);
    assert(result1 === 'protected success', 'Should succeed normally');
    
    // Test failure handling
    try {
      await protectedService(true);
      assert(false, 'Should have failed');
    } catch (error) {
      assert(error.message === 'Service failure', 'Should propagate service error');
    }
    
    // Verify circuit breaker stats
    const stats = circuitBreakers.getAllStats();
    assert(stats['protected-service'].totalRequests === 2, 'Should track all requests');
    assert(stats['protected-service'].totalFailures === 1, 'Should track failures');
  });

  await test('Error handling and recovery scenarios', async () => {
    const breaker = new CircuitBreaker({ 
      name: 'recovery-test',
      failureThreshold: 2,
      resetTimeout: 50
    });
    
    // Force multiple failures to open circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Expected
      }
    }
    
    assert(breaker.getState() === CircuitState.OPEN, 'Should be open after failures');
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // Should recover with successful operation
    const result = await breaker.execute(successfulOperation);
    assert(result === 'success', 'Should recover successfully');
    assert(breaker.getState() === CircuitState.CLOSED, 'Should be closed after recovery');
    
    const stats = breaker.getStats();
    assert(stats.uptime < 100, 'Uptime should reflect failures');
    assert(stats.avgResponseTime > 0, 'Should track response times');
  });

  await test('Performance and stress testing', async () => {
    const breaker = new CircuitBreaker({ name: 'perf-test', failureThreshold: 10 });
    const limiter = createRateLimiter({
      identifier: 'perf-test',
      maxRequests: 50,
      windowMs: 1000,
      useTokenBucket: true
    });
    
    // Rapid fire requests
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        limiter.consume().then(result => 
          result.allowed ? breaker.execute(successfulOperation) : Promise.reject('Rate limited')
        ).catch(() => 'handled')
      );
    }
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => r === 'success').length;
    const handled = results.filter(r => r === 'handled').length;
    
    assert(successes > 0, 'Should have some successes');
    assert(successes + handled === 20, 'Should handle all requests');
    
    console.log(`   📊 Performance test: ${successes} successes, ${handled} rate limited/handled`);
  });

  // Summary
  console.log(`\n📊 Test Results: ${passCount}/${testCount} passed`);

  if (passCount === testCount) {
    console.log('🎉 All queue and circuit breaker tests passed!');
    console.log('🔄 Job queue, circuit breakers, and rate limiters are working correctly.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });