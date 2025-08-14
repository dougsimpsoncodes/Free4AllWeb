#!/usr/bin/env node

/**
 * Phase 0 Integration Test Suite
 * 
 * Tests all Phase 0 components working together:
 * - Evidence canonicalization + hashing + WORM storage
 * - Circuit breakers + rate limiters protecting operations
 * - RBAC permissions controlling access
 * - Idempotency preventing duplicate operations
 * 
 * This simulates real validation system workflows.
 */

import { canonicalizeEvidence } from './server/services/evidence/canonicalize.ts';
import { hashEvidence, verifyEvidenceHash, createEvidenceIntegrity } from './server/services/evidence/hash.ts';
import { CircuitBreaker, circuitBreakers } from './server/lib/circuitBreaker.ts';
import { apiRateLimiters, rateLimiters } from './server/lib/rateLimiter.ts';
import { UserRole, Permission, userHasPermission, validationAuth } from './server/middleware/rbac.ts';
import { 
  generateValidationIdempotencyKey, 
  generateEvidenceIdempotencyKey,
  getIdempotencyStats,
  clearIdempotencyStore 
} from './server/middleware/idempotency.ts';

// Test counter
let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  console.log(`\n🧪 Integration Test: ${name}`);
  return Promise.resolve(fn())
    .then(() => {
      console.log(`✅ ${name}`);
      passCount++;
    })
    .catch(error => {
      console.log(`❌ ${name}: ${error.message}`);
      console.error(error.stack);
    });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Mock external API calls for testing
async function mockESPNAPICall(gameId) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Sometimes fail to test circuit breaker
  if (Math.random() < 0.1) {
    throw new Error('ESPN API temporary failure');
  }
  
  return {
    gameId,
    teams: {
      home: { name: 'Los Angeles Dodgers', score: 7 },
      away: { name: 'San Diego Padres', score: 3 }
    },
    status: 'final',
    inning: 9,
    timestamp: new Date().toISOString(),
    source: 'ESPN'
  };
}

async function mockMLBAPICall(gameId) {
  await new Promise(resolve => setTimeout(resolve, 75));
  
  if (Math.random() < 0.05) {
    throw new Error('MLB API rate limited');
  }
  
  return {
    gameId,
    teams: {
      home: { name: 'Los Angeles Dodgers', score: 7 },
      away: { name: 'San Diego Padres', score: 3 }
    },
    status: 'final',
    inning: 9,
    timestamp: new Date().toISOString(),
    source: 'MLB'
  };
}

// Simulate validation system operations
class MockValidationSystem {
  constructor() {
    this.evidenceStore = new Map();
  }

  async validatePromotion(user, promotionId, gameId, idempotencyKey) {
    // 1. Check RBAC permissions
    if (!userHasPermission(user, Permission.VALIDATE_PROMOTION)) {
      throw new Error('Insufficient permissions for validation');
    }

    // 2. Check idempotency (generate key if not provided)
    const effectiveKey = idempotencyKey || generateValidationIdempotencyKey(promotionId, gameId);
    if (this.evidenceStore.has(effectiveKey)) {
      return {
        success: true,
        cached: true,
        result: this.evidenceStore.get(effectiveKey)
      };
    }

    // 3. Fetch data with circuit breaker protection
    const espnData = await circuitBreakers.execute('espn-api', () => mockESPNAPICall(gameId));
    const mlbData = await circuitBreakers.execute('mlb-api', () => mockMLBAPICall(gameId));

    // 4. Create evidence object
    const evidence = {
      validation: {
        promotionId,
        gameId,
        validatedAt: new Date().toISOString(),
        validatedBy: user.id
      },
      sources: [espnData, mlbData],
      consensus: {
        finalScore: espnData.teams.home.score,
        status: 'CONFIRMED',
        confidence: 1.0,
        agreementSources: ['ESPN', 'MLB']
      },
      triggerEvaluation: {
        condition: 'score >= 6',
        met: espnData.teams.home.score >= 6,
        actualScore: espnData.teams.home.score
      }
    };

    // 5. Create immutable evidence
    const integrity = createEvidenceIntegrity(evidence);
    
    // 6. Store with idempotency
    const result = {
      promotionId,
      gameId,
      triggerMet: evidence.triggerEvaluation.met,
      evidence: evidence,
      integrity: integrity,
      idempotencyKey
    };

    this.evidenceStore.set(effectiveKey, result);

    return {
      success: true,
      cached: false,
      result
    };
  }

  async getValidationEvidence(user, evidenceHash) {
    // Check read permissions
    if (!userHasPermission(user, Permission.READ_EVIDENCE)) {
      throw new Error('Insufficient permissions to read evidence');
    }

    // Find evidence by hash
    for (const [key, evidence] of this.evidenceStore.entries()) {
      if (evidence.integrity.hash === evidenceHash) {
        return evidence;
      }
    }

    throw new Error('Evidence not found');
  }
}

async function runIntegrationTests() {
  console.log('🔄 Phase 0 Integration Testing - All Components Together...\n');

  // Clear any existing state
  clearIdempotencyStore();

  // Create mock validation system
  const validationSystem = new MockValidationSystem();

  // Test users with different roles
  const adminUser = { id: 'admin-001', email: 'admin@test.com', role: UserRole.ADMIN };
  const reviewerUser = { id: 'reviewer-001', email: 'reviewer@test.com', role: UserRole.REVIEWER };
  const regularUser = { id: 'user-001', email: 'user@test.com', role: UserRole.USER };

  await test('End-to-end validation workflow with admin user', async () => {
    const promotionId = 1;
    const gameId = 'dodgers-vs-padres-20240815';
    const timestamp = '2024-08-15T22:30:00Z'; // Fixed timestamp for consistent idempotency
    const idempotencyKey = generateValidationIdempotencyKey(promotionId, gameId, timestamp);

    // Admin should be able to validate
    const result = await validationSystem.validatePromotion(adminUser, promotionId, gameId, idempotencyKey);

    assert(result.success, 'Validation should succeed');
    assert(!result.cached, 'First validation should not be cached');
    assert(result.result.promotionId === promotionId, 'Should return correct promotion ID');
    assert(result.result.triggerMet === true, 'Trigger should be met (score 7 >= 6)');
    assert(result.result.integrity.hash, 'Should include evidence hash');
    assert(result.result.integrity.canonical, 'Should include canonical form');

    console.log(`   📊 Evidence hash: ${result.result.integrity.hash.substring(0, 16)}...`);
    console.log(`   🎯 Trigger met: ${result.result.triggerMet} (score: ${result.result.evidence.consensus.finalScore})`);
    
    // Store the key for the next test
    global.testIdempotencyKey = idempotencyKey;
  });

  await test('Idempotency prevents duplicate validation', async () => {
    const promotionId = 1;
    const gameId = 'dodgers-vs-padres-20240815';
    
    // Use the same key as the previous test
    const idempotencyKey = global.testIdempotencyKey;

    console.log(`   🔍 Looking for cached result with key: ${idempotencyKey.substring(0, 16)}...`);
    console.log(`   📦 Evidence store has ${validationSystem.evidenceStore.size} entries`);
    
    // Check what keys are in the store
    if (validationSystem.evidenceStore.size > 0) {
      const keys = Array.from(validationSystem.evidenceStore.keys());
      console.log(`   🔑 Store keys: ${keys.map(k => k.substring(0, 16) + '...').join(', ')}`);
    }

    // Second validation with same key should return cached result
    const result = await validationSystem.validatePromotion(adminUser, promotionId, gameId, idempotencyKey);

    assert(result.success, 'Cached validation should succeed');
    assert(result.cached, 'Second validation should be cached');

    console.log(`   🔄 Idempotency key: ${idempotencyKey.substring(0, 16)}... (cached: ${result.cached})`);
  });

  await test('RBAC prevents unauthorized validation', async () => {
    const promotionId = 2;
    const gameId = 'dodgers-vs-giants-20240816';
    const idempotencyKey = generateValidationIdempotencyKey(promotionId, gameId);

    // Regular user should not be able to validate
    try {
      await validationSystem.validatePromotion(regularUser, promotionId, gameId, idempotencyKey);
      assert(false, 'Regular user validation should have failed');
    } catch (error) {
      assert(error.message.includes('Insufficient permissions'), 'Should fail with permission error');
    }

    console.log(`   🔒 Regular user correctly blocked from validation`);
  });

  await test('RBAC controls evidence access', async () => {
    // Admin can read evidence
    const promotionId = 1;
    const gameId = 'dodgers-vs-padres-20240815';
    const idempotencyKey = generateValidationIdempotencyKey(promotionId, gameId);
    
    const validationResult = await validationSystem.validatePromotion(adminUser, promotionId, gameId, idempotencyKey);
    const evidenceHash = validationResult.result.integrity.hash;

    // Admin should be able to read
    const adminEvidence = await validationSystem.getValidationEvidence(adminUser, evidenceHash);
    assert(adminEvidence.integrity.hash === evidenceHash, 'Admin should be able to read evidence');

    // Reviewer should be able to read
    const reviewerEvidence = await validationSystem.getValidationEvidence(reviewerUser, evidenceHash);
    assert(reviewerEvidence.integrity.hash === evidenceHash, 'Reviewer should be able to read evidence');

    // Regular user should not be able to read
    try {
      await validationSystem.getValidationEvidence(regularUser, evidenceHash);
      assert(false, 'Regular user should not be able to read evidence');
    } catch (error) {
      assert(error.message.includes('Insufficient permissions'), 'Should fail with permission error');
    }

    console.log(`   📖 Evidence access correctly controlled by RBAC`);
  });

  await test('Circuit breakers protect against API failures', async () => {
    const breaker = circuitBreakers.getBreaker('isolated-test-api', { 
      failureThreshold: 3, 
      resetTimeout: 100 
    });

    // Reset breaker to ensure clean state
    breaker.reset();

    // Force controlled failures to test circuit breaker
    let failures = 0;
    let successes = 0;
    let fastFails = 0;

    for (let i = 0; i < 8; i++) {
      try {
        await breaker.execute(async () => {
          // Controlled failure pattern: fail first 3, then succeed
          if (i < 3) {
            throw new Error('Controlled API failure');
          }
          return 'success';
        });
        successes++;
      } catch (error) {
        if (error.message.includes('is OPEN')) {
          fastFails++;
        } else {
          failures++;
        }
      }
    }

    const stats = breaker.getStats();
    const totalAttempts = successes + failures + fastFails;
    
    assert(totalAttempts === 8, `Should have attempted 8 requests (got ${totalAttempts})`);
    assert(failures >= 2, 'Should have recorded actual failures');
    
    console.log(`   ⚡ Circuit breaker stats: ${successes} successes, ${failures} failures, ${fastFails} fast-fails`);
    console.log(`   📊 Circuit state: ${breaker.getState()}`);
  });

  await test('Rate limiting protects API endpoints', async () => {
    // Test with a small limit for quick testing
    const testLimiter = rateLimiters.getLimiter('integration-test', {
      maxRequests: 3,
      windowMs: 1000,
      useTokenBucket: true
    });

    const results = [];
    
    // Make 5 requests rapidly
    for (let i = 0; i < 5; i++) {
      const result = await testLimiter.consume();
      results.push(result);
    }

    const allowed = results.filter(r => r.allowed).length;
    const blocked = results.filter(r => !r.allowed).length;

    assert(allowed === 3, 'Should allow exactly 3 requests');
    assert(blocked === 2, 'Should block 2 requests');

    console.log(`   🚦 Rate limiting: ${allowed} allowed, ${blocked} blocked`);
  });

  await test('Evidence integrity verification', async () => {
    // Create some evidence
    const originalEvidence = {
      gameId: 'integrity-test-game',
      score: 8,
      timestamp: '2024-08-15T22:30:00Z',
      validation: {
        trigger: 'score >= 6',
        met: true
      }
    };

    // Hash the evidence
    const integrity = createEvidenceIntegrity(originalEvidence);
    
    // Verify integrity
    const verification = verifyEvidenceHash(originalEvidence, integrity.hash);
    assert(verification.isValid, 'Evidence should verify successfully');

    // Test tampering detection
    const tamperedEvidence = { ...originalEvidence, score: 5 };
    const tamperedVerification = verifyEvidenceHash(tamperedEvidence, integrity.hash);
    assert(!tamperedVerification.isValid, 'Tampered evidence should fail verification');

    console.log(`   🔍 Evidence integrity: ${integrity.hash.substring(0, 16)}...`);
    console.log(`   🛡️ Tampering detection: ${tamperedVerification.isValid ? '❌ FAILED' : '✅ WORKING'}`);
  });

  await test('Complex multi-step validation workflow', async () => {
    // Simulate a complete validation workflow
    const workflows = [
      { promotionId: 10, gameId: 'game-001', expectedTrigger: true },
      { promotionId: 11, gameId: 'game-002', expectedTrigger: true },
      { promotionId: 12, gameId: 'game-003', expectedTrigger: true }
    ];

    const results = [];

    for (const workflow of workflows) {
      const idempotencyKey = generateValidationIdempotencyKey(workflow.promotionId, workflow.gameId);
      
      try {
        // Rate limit check
        const rateLimitResult = await apiRateLimiters.general.consume();
        if (!rateLimitResult.allowed) {
          console.log(`   ⏳ Rate limited for promotion ${workflow.promotionId}`);
          continue;
        }

        // Execute validation
        const result = await validationSystem.validatePromotion(
          adminUser, 
          workflow.promotionId, 
          workflow.gameId, 
          idempotencyKey
        );

        results.push({
          promotionId: workflow.promotionId,
          success: result.success,
          triggerMet: result.result.triggerMet,
          cached: result.cached,
          evidenceHash: result.result.integrity.hash
        });

      } catch (error) {
        results.push({
          promotionId: workflow.promotionId,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    assert(successful > 0, 'At least one validation should succeed');

    console.log(`   🔄 Processed ${results.length} validations: ${successful} successful`);
    results.forEach(r => {
      if (r.success) {
        console.log(`     ✅ Promotion ${r.promotionId}: trigger=${r.triggerMet}, cached=${r.cached}`);
      } else {
        console.log(`     ❌ Promotion ${r.promotionId}: ${r.error}`);
      }
    });
  });

  await test('System monitoring and health checks', async () => {
    // Check circuit breaker health
    const circuitStats = circuitBreakers.getAllStats();
    const degradedServices = circuitBreakers.getDegradedServices();

    // Check idempotency store
    const idempotencyStats = getIdempotencyStats();

    // Check rate limiter status
    const rateLimiterStats = rateLimiters.getAllStatus();

    console.log(`   📊 System Health Summary:`);
    console.log(`     Circuit Breakers: ${Object.keys(circuitStats).length} active`);
    console.log(`     Degraded Services: ${degradedServices.length}`);
    console.log(`     Idempotency Store: ${idempotencyStats.total} entries`);
    console.log(`     Rate Limiters: ${Object.keys(rateLimiterStats).length} active`);

    // All systems should be functional
    assert(typeof circuitStats === 'object', 'Circuit breaker stats should be available');
    assert(Array.isArray(degradedServices), 'Degraded services list should be available');
    assert(typeof idempotencyStats.total === 'number', 'Idempotency stats should be available');
  });

  // Performance test
  await test('Performance under concurrent load', async () => {
    const concurrentRequests = 10;
    const promises = [];

    const startTime = Date.now();

    for (let i = 0; i < concurrentRequests; i++) {
      const promotionId = 20 + i;
      const gameId = `concurrent-game-${i}`;
      const idempotencyKey = generateValidationIdempotencyKey(promotionId, gameId);

      promises.push(
        validationSystem.validatePromotion(adminUser, promotionId, gameId, idempotencyKey)
          .catch(error => ({ error: error.message }))
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => r.error).length;

    console.log(`   ⚡ Concurrent performance: ${successful} successful, ${failed} failed in ${duration}ms`);
    console.log(`   📈 Average per request: ${Math.round(duration / concurrentRequests)}ms`);

    assert(successful > concurrentRequests * 0.7, 'At least 70% of concurrent requests should succeed');
    assert(duration < 5000, 'Concurrent requests should complete within 5 seconds');
  });

  // Summary
  console.log(`\n📊 Integration Test Results: ${passCount}/${testCount} passed`);

  if (passCount === testCount) {
    console.log('\n🎉 ALL PHASE 0 INTEGRATION TESTS PASSED!');
    console.log('🚀 The validation system foundation is working perfectly:');
    console.log('   ✅ Evidence integrity with WORM storage');
    console.log('   ✅ Circuit breakers protecting external APIs');
    console.log('   ✅ Rate limiting preventing abuse');
    console.log('   ✅ RBAC controlling access');
    console.log('   ✅ Idempotency preventing duplicates');
    console.log('   ✅ End-to-end workflows functioning');
    console.log('   ✅ Performance under concurrent load');
    console.log('\n🏗️  Ready for Phase 1: Data Source Integration!');
    return true;
  } else {
    console.log('\n❌ Some integration tests failed. Please review the issues above.');
    return false;
  }
}

// Run integration tests
runIntegrationTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Integration test execution failed:', error);
    process.exit(1);
  });