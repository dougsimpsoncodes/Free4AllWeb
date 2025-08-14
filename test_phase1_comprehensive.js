/**
 * Comprehensive Phase 1 Testing Suite
 * 
 * Tests all Phase 1 components systematically:
 * - Enhanced Sports API Service
 * - Consensus Engine
 * - Validation Service
 * - Evidence Storage
 * - Supporting Infrastructure
 */

import path from 'path';
import crypto from 'crypto';

// Import all Phase 1 components
import { enhancedSportsApi } from './server/services/enhancedSportsApiService.ts';
import { consensusEngine } from './server/services/consensusEngine.ts';
import { validationService } from './server/services/validationService.ts';
import { putImmutable, verifyStored, checkStorageHealth, initializeStorage } from './server/services/evidence/storage.ts';
import { circuitBreakers } from './server/lib/circuitBreaker.ts';
import { apiRateLimiters, rateLimiters } from './server/lib/rateLimiter.ts';
import { canonicalizeEvidence } from './server/services/evidence/canonicalize.ts';
import { hashEvidence, verifyEvidenceHash, createEvidenceIntegrity } from './server/services/evidence/hash.ts';
import { idempotency, generateValidationIdempotencyKey } from './server/middleware/idempotency.ts';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  maxRetries: 3,
  testGameId: '746446', // Real MLB game ID for testing
  testPromotionId: 1,
  verbose: true
};

// Test results storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

// Utility functions
function logTest(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${details}`);
    console.log(`❌ ${testName}: ${details}`);
  }
  testResults.details.push({ testName, passed, details });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === Enhanced Sports API Service Tests ===

async function testEnhancedSportsApiService() {
  console.log('\n🧪 Testing Enhanced Sports API Service...');
  
  try {
    // Test 1: Basic game data fetching
    console.log('Testing basic game data fetching...');
    const result = await enhancedSportsApi.getGameData(TEST_CONFIG.testGameId);
    logTest('Enhanced Sports API - Basic fetch', 
      result.success && result.sources && result.sources.length > 0,
      result.error || 'No sources returned'
    );

    // Test 2: Conditional request handling
    console.log('Testing conditional requests...');
    const conditionalResult = await enhancedSportsApi.getGameData(TEST_CONFIG.testGameId, {
      useConditionalRequest: true
    });
    logTest('Enhanced Sports API - Conditional requests', 
      conditionalResult.success,
      conditionalResult.error
    );

    // Test 3: Rate limiting protection
    console.log('Testing rate limiting...');
    const rateLimitStatus = await enhancedSportsApi.getRateLimitStatus();
    logTest('Enhanced Sports API - Rate limit status', 
      rateLimitStatus.espn && rateLimitStatus.mlb,
      'Missing rate limit status'
    );

    // Test 4: Circuit breaker status
    console.log('Testing circuit breaker status...');
    const healthStatus = await enhancedSportsApi.getSourceHealth();
    logTest('Enhanced Sports API - Circuit breaker health', 
      healthStatus.espn && healthStatus.mlb && healthStatus.overall,
      'Missing health status components'
    );

    // Test 5: Error handling with invalid game ID
    console.log('Testing error handling...');
    const errorResult = await enhancedSportsApi.getGameData('invalid-game-id');
    logTest('Enhanced Sports API - Error handling', 
      !errorResult.success && errorResult.error,
      'Should fail with invalid game ID'
    );

    // Test 6: Evidence storage integration
    console.log('Testing evidence storage integration...');
    if (result.success && result.evidenceHash) {
      logTest('Enhanced Sports API - Evidence storage', 
        typeof result.evidenceHash === 'string' && result.evidenceHash.length === 64,
        'Evidence hash should be 64-character hex string'
      );
    } else {
      logTest('Enhanced Sports API - Evidence storage', false, 'No evidence hash returned');
    }

    // Test 7: Response time tracking
    console.log('Testing response time tracking...');
    const startTime = Date.now();
    await enhancedSportsApi.getGameData(TEST_CONFIG.testGameId);
    const responseTime = Date.now() - startTime;
    logTest('Enhanced Sports API - Response time tracking', 
      responseTime > 0 && responseTime < 15000,
      `Response time: ${responseTime}ms`
    );

  } catch (error) {
    logTest('Enhanced Sports API - Service tests', false, error.message);
  }
}

// === Consensus Engine Tests ===

async function testConsensusEngine() {
  console.log('\n🧪 Testing Consensus Engine...');
  
  try {
    // Test 1: Basic consensus evaluation
    console.log('Testing basic consensus evaluation...');
    const consensus = await consensusEngine.evaluateGameConsensus(TEST_CONFIG.testGameId);
    logTest('Consensus Engine - Basic evaluation', 
      consensus.status && consensus.confidence !== undefined && consensus.sources,
      'Missing required consensus fields'
    );

    // Test 2: Source weight calculations
    console.log('Testing source weight calculations...');
    if (consensus.sources && consensus.sources.length > 0) {
      const espnSource = consensus.sources.find(s => s.source === 'ESPN');
      const mlbSource = consensus.sources.find(s => s.source === 'MLB');
      
      let weightsCorrect = true;
      if (espnSource && espnSource.weight !== 0.6) weightsCorrect = false;
      if (mlbSource && mlbSource.weight !== 0.4) weightsCorrect = false;
      
      logTest('Consensus Engine - Source weights', 
        weightsCorrect,
        `ESPN weight: ${espnSource?.weight}, MLB weight: ${mlbSource?.weight}`
      );
    } else {
      logTest('Consensus Engine - Source weights', false, 'No sources to test weights');
    }

    // Test 3: Quality factor logic
    console.log('Testing quality factor logic...');
    if (consensus.sources && consensus.sources.length > 0) {
      let qualityFactorsValid = true;
      for (const source of consensus.sources) {
        const expectedQuality = source.data.status.isFinal ? 1.0 : 0.8;
        if (Math.abs(source.qualityFactor - expectedQuality) > 0.01) {
          qualityFactorsValid = false;
          break;
        }
      }
      logTest('Consensus Engine - Quality factors', qualityFactorsValid, 'Quality factors calculation');
    } else {
      logTest('Consensus Engine - Quality factors', false, 'No sources to test quality factors');
    }

    // Test 4: Recency factor calculations
    console.log('Testing recency factor calculations...');
    if (consensus.sources && consensus.sources.length > 0) {
      let recencyFactorsValid = true;
      for (const source of consensus.sources) {
        if (source.recencyFactor < 0.6 || source.recencyFactor > 1.0) {
          recencyFactorsValid = false;
          break;
        }
      }
      logTest('Consensus Engine - Recency factors', 
        recencyFactorsValid,
        'Recency factors should be between 0.6 and 1.0'
      );
    } else {
      logTest('Consensus Engine - Recency factors', false, 'No sources to test recency factors');
    }

    // Test 5: Agreement analysis
    console.log('Testing agreement analysis...');
    logTest('Consensus Engine - Agreement analysis', 
      consensus.decisionRationale && consensus.requiresReconciliation !== undefined,
      'Missing agreement analysis fields'
    );

    // Test 6: Evidence storage integration
    console.log('Testing evidence storage integration...');
    logTest('Consensus Engine - Evidence storage', 
      consensus.evidenceHash && consensus.evidenceHash.length === 64,
      'Evidence hash should be 64-character hex string'
    );

    // Test 7: Metrics tracking
    console.log('Testing metrics tracking...');
    const metrics = consensusEngine.getMetrics();
    logTest('Consensus Engine - Metrics tracking', 
      metrics.totalEvaluations > 0 && metrics.averageConfidence !== undefined,
      'Metrics should track evaluations and confidence'
    );

    // Test 8: Consensus for specific promotion
    console.log('Testing consensus for specific promotion...');
    const promotionConsensus = await consensusEngine.getConsensusForPromotion(
      TEST_CONFIG.testPromotionId, 
      TEST_CONFIG.testGameId
    );
    logTest('Consensus Engine - Promotion-specific consensus', 
      promotionConsensus.status && promotionConsensus.evidenceHash,
      'Should return consensus with evidence for promotion'
    );

  } catch (error) {
    logTest('Consensus Engine - Service tests', false, error.message);
  }
}

// === Validation Service Tests ===

async function testValidationService() {
  console.log('\n🧪 Testing Validation Service...');
  
  try {
    // Test 1: Basic promotion validation
    console.log('Testing basic promotion validation...');
    const validation = await validationService.validatePromotionTrigger(
      TEST_CONFIG.testPromotionId,
      TEST_CONFIG.testGameId,
      'win_home'
    );
    logTest('Validation Service - Basic validation', 
      validation.promotionId && validation.validation && validation.validation.validationId,
      'Missing required validation fields'
    );

    // Test 2: Evidence chain creation
    console.log('Testing evidence chain creation...');
    if (validation.validation.evidenceChain) {
      logTest('Validation Service - Evidence chain', 
        Array.isArray(validation.validation.evidenceChain) && validation.validation.evidenceChain.length > 0,
        'Evidence chain should be non-empty array'
      );
    } else {
      logTest('Validation Service - Evidence chain', false, 'No evidence chain created');
    }

    // Test 3: Consensus integration
    console.log('Testing consensus integration...');
    logTest('Validation Service - Consensus integration', 
      validation.validation.consensus && validation.validation.confidence !== undefined,
      'Should integrate consensus results'
    );

    // Test 4: Validation ID generation
    console.log('Testing validation ID generation...');
    const validationId = generateValidationIdempotencyKey(TEST_CONFIG.testPromotionId, TEST_CONFIG.testGameId);
    logTest('Validation Service - Validation ID generation', 
      typeof validationId === 'string' && validationId.length > 0,
      'Should generate valid validation ID'
    );

    // Test 5: Approval logic
    console.log('Testing approval logic...');
    logTest('Validation Service - Approval logic', 
      typeof validation.validation.isValid === 'boolean' && 
      typeof validation.validation.requiresManualReview === 'boolean',
      'Should have clear approval decisions'
    );

    // Test 6: Error handling with invalid promotion
    console.log('Testing error handling...');
    try {
      const errorValidation = await validationService.validatePromotionTrigger(
        99999, // Non-existent promotion
        TEST_CONFIG.testGameId,
        'win_home'
      );
      logTest('Validation Service - Error handling', 
        !errorValidation.validation.isValid || errorValidation.validation.requiresManualReview,
        'Should handle invalid promotions gracefully'
      );
    } catch (error) {
      logTest('Validation Service - Error handling', true, 'Properly throws error for invalid promotion');
    }

    // Test 7: Batch validation
    console.log('Testing batch validation...');
    const batchValidations = await validationService.validatePromotionsForGame(TEST_CONFIG.testGameId);
    logTest('Validation Service - Batch validation', 
      Array.isArray(batchValidations),
      'Should return array of validations'
    );

    // Test 8: Validation metrics
    console.log('Testing validation metrics...');
    const validationMetrics = validationService.getValidationMetrics();
    logTest('Validation Service - Metrics', 
      validationMetrics && validationMetrics.validationService,
      'Should provide validation metrics'
    );

  } catch (error) {
    logTest('Validation Service - Service tests', false, error.message);
  }
}

// === Evidence Storage Tests ===

async function testEvidenceStorage() {
  console.log('\n🧪 Testing Evidence Storage...');
  
  try {
    // Test 1: Initialize storage
    console.log('Testing storage initialization...');
    await initializeStorage();
    logTest('Evidence Storage - Initialization', true, 'Storage initialized successfully');

    // Test 2: WORM semantics - write evidence
    console.log('Testing WORM write operation...');
    const testEvidence = {
      type: 'test_evidence',
      timestamp: new Date().toISOString(),
      data: { test: 'value', number: 42 }
    };
    
    const writeResult = await putImmutable(testEvidence);
    logTest('Evidence Storage - WORM write', 
      writeResult.hash && writeResult.uri && writeResult.storedAt,
      'Should return hash, URI, and timestamp'
    );

    // Test 3: Hash validation
    console.log('Testing hash validation...');
    const integrity = createEvidenceIntegrity(testEvidence);
    logTest('Evidence Storage - Hash validation', 
      integrity.hash === writeResult.hash,
      'Hash should match expected value'
    );

    // Test 4: WORM semantics - verify stored evidence
    console.log('Testing evidence verification...');
    const verificationResult = await verifyStored(writeResult.uri, writeResult.hash);
    logTest('Evidence Storage - WORM verification', 
      verificationResult.isValid && verificationResult.evidence,
      verificationResult.error || 'Verification failed'
    );

    // Test 5: Duplicate evidence handling
    console.log('Testing duplicate evidence handling...');
    const duplicateResult = await putImmutable(testEvidence);
    logTest('Evidence Storage - Duplicate handling', 
      duplicateResult.hash === writeResult.hash,
      'Should handle duplicates correctly'
    );

    // Test 6: Evidence immutability
    console.log('Testing evidence immutability...');
    const modifiedEvidence = { ...testEvidence, modified: true };
    const modifiedResult = await putImmutable(modifiedEvidence);
    logTest('Evidence Storage - Immutability', 
      modifiedResult.hash !== writeResult.hash,
      'Modified evidence should have different hash'
    );

    // Test 7: Storage health check
    console.log('Testing storage health...');
    const healthResult = await checkStorageHealth();
    logTest('Evidence Storage - Health check', 
      healthResult.isHealthy !== undefined && healthResult.statistics,
      'Should provide health status and statistics'
    );

    // Test 8: Hash format validation
    console.log('Testing hash format validation...');
    const { isValidHashFormat } = await import('./server/services/evidence/hash.ts');
    logTest('Evidence Storage - Hash format validation', 
      isValidHashFormat(writeResult.hash) && !isValidHashFormat('invalid-hash'),
      'Should validate hash format correctly'
    );

  } catch (error) {
    logTest('Evidence Storage - Service tests', false, error.message);
  }
}

// === Supporting Infrastructure Tests ===

async function testSupportingInfrastructure() {
  console.log('\n🧪 Testing Supporting Infrastructure...');
  
  try {
    // Test 1: Circuit breaker functionality
    console.log('Testing circuit breaker...');
    const testBreaker = circuitBreakers.getBreaker('test-service');
    const breakerStats = testBreaker.getStats();
    logTest('Circuit Breaker - Basic functionality', 
      breakerStats.state && breakerStats.totalRequests !== undefined,
      'Should provide circuit breaker statistics'
    );

    // Test 2: Rate limiter functionality
    console.log('Testing rate limiter...');
    const testLimiter = rateLimiters.getLimiter('test-limiter', {
      maxRequests: 5,
      windowMs: 1000
    });
    const limiterStatus = testLimiter.getStatus();
    logTest('Rate Limiter - Basic functionality', 
      limiterStatus.allowed !== undefined && limiterStatus.remaining !== undefined,
      'Should provide rate limiter status'
    );

    // Test 3: Evidence canonicalization
    console.log('Testing evidence canonicalization...');
    const testData = { b: 2, a: 1, timestamp: new Date().toISOString() };
    const canonical = canonicalizeEvidence(testData);
    logTest('Evidence Canonicalization - Basic function', 
      typeof canonical === 'string' && canonical.length > 0,
      'Should canonicalize evidence to string'
    );

    // Test 4: Evidence hashing
    console.log('Testing evidence hashing...');
    const hashResult = hashEvidence(testData);
    logTest('Evidence Hashing - Basic function', 
      hashResult.hash && hashResult.canonical && hashResult.algorithm === 'sha256',
      'Should produce hash with metadata'
    );

    // Test 5: Hash verification
    console.log('Testing hash verification...');
    const verifyResult = verifyEvidenceHash(testData, hashResult.hash);
    logTest('Evidence Hashing - Verification', 
      verifyResult.isValid && verifyResult.expectedHash === verifyResult.actualHash,
      'Should verify hash correctly'
    );

    // Test 6: Idempotency key generation
    console.log('Testing idempotency key generation...');
    const idempotencyKey = generateValidationIdempotencyKey(1, 'test-game');
    logTest('Idempotency - Key generation', 
      typeof idempotencyKey === 'string' && idempotencyKey.length > 0,
      'Should generate idempotency key'
    );

    // Test 7: Pre-configured rate limiters
    console.log('Testing pre-configured rate limiters...');
    const espnStatus = await apiRateLimiters.espn.consume();
    const mlbStatus = await apiRateLimiters.mlb.consume();
    logTest('Rate Limiter - Pre-configured APIs', 
      espnStatus.allowed !== undefined && mlbStatus.allowed !== undefined,
      'Should have working ESPN and MLB rate limiters'
    );

  } catch (error) {
    logTest('Supporting Infrastructure - Tests', false, error.message);
  }
}

// === Integration Tests ===

async function testIntegrationScenarios() {
  console.log('\n🧪 Testing Integration Scenarios...');
  
  try {
    // Test 1: End-to-end validation workflow
    console.log('Testing end-to-end validation workflow...');
    const startTime = Date.now();
    
    // Step 1: Fetch game data
    const gameData = await enhancedSportsApi.getGameData(TEST_CONFIG.testGameId);
    
    // Step 2: Get consensus
    const consensus = await consensusEngine.evaluateGameConsensus(TEST_CONFIG.testGameId);
    
    // Step 3: Validate promotion
    const validation = await validationService.validatePromotionTrigger(
      TEST_CONFIG.testPromotionId,
      TEST_CONFIG.testGameId,
      'win_home'
    );
    
    const endTime = Date.now();
    
    logTest('Integration - End-to-end workflow', 
      gameData.success && consensus.status && validation.validation,
      `Workflow completed in ${endTime - startTime}ms`
    );

    // Test 2: Error recovery
    console.log('Testing error recovery...');
    try {
      await enhancedSportsApi.getGameData('invalid-game-id');
      const recovery = await enhancedSportsApi.getGameData(TEST_CONFIG.testGameId);
      logTest('Integration - Error recovery', 
        recovery.success,
        'Should recover from errors'
      );
    } catch (error) {
      logTest('Integration - Error recovery', false, 'Failed to recover from error');
    }

    // Test 3: Circuit breaker integration
    console.log('Testing circuit breaker integration...');
    const healthStatus = await enhancedSportsApi.getSourceHealth();
    logTest('Integration - Circuit breaker integration', 
      healthStatus.overall.healthy !== undefined,
      'Should integrate circuit breaker status'
    );

    // Test 4: Evidence chain integrity
    console.log('Testing evidence chain integrity...');
    if (validation.validation.evidenceChain && validation.validation.evidenceChain.length > 1) {
      logTest('Integration - Evidence chain integrity', 
        validation.validation.evidenceChain.every(hash => hash && hash.length === 64),
        'All evidence hashes should be valid'
      );
    } else {
      logTest('Integration - Evidence chain integrity', false, 'No evidence chain to test');
    }

    // Test 5: Concurrent access
    console.log('Testing concurrent access...');
    const concurrentPromises = Array(5).fill().map(() => 
      enhancedSportsApi.getGameData(TEST_CONFIG.testGameId)
    );
    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const successfulResults = concurrentResults.filter(r => r.status === 'fulfilled' && r.value.success);
    logTest('Integration - Concurrent access', 
      successfulResults.length >= 3,
      `${successfulResults.length}/5 concurrent requests succeeded`
    );

  } catch (error) {
    logTest('Integration - Scenarios', false, error.message);
  }
}

// === Performance and Security Tests ===

async function testPerformanceAndSecurity() {
  console.log('\n🧪 Testing Performance and Security...');
  
  try {
    // Test 1: Response time performance
    console.log('Testing response time performance...');
    const responseTimes = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await enhancedSportsApi.getGameData(TEST_CONFIG.testGameId);
      responseTimes.push(Date.now() - startTime);
      await sleep(1000); // Rate limiting compliance
    }
    
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    logTest('Performance - Response time', 
      avgResponseTime < 10000,
      `Average response time: ${avgResponseTime.toFixed(0)}ms`
    );

    // Test 2: Memory usage monitoring
    console.log('Testing memory usage...');
    const beforeMemory = process.memoryUsage();
    
    // Perform multiple operations
    for (let i = 0; i < 10; i++) {
      const evidence = { iteration: i, timestamp: new Date().toISOString() };
      await putImmutable(evidence);
    }
    
    const afterMemory = process.memoryUsage();
    const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
    logTest('Performance - Memory usage', 
      memoryIncrease < 50 * 1024 * 1024, // Less than 50MB increase
      `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
    );

    // Test 3: Hash collision resistance
    console.log('Testing hash collision resistance...');
    const hashes = new Set();
    let collisionFound = false;
    
    for (let i = 0; i < 1000; i++) {
      const evidence = { id: i, timestamp: new Date().toISOString(), random: Math.random() };
      const hash = hashEvidence(evidence).hash;
      
      if (hashes.has(hash)) {
        collisionFound = true;
        break;
      }
      hashes.add(hash);
    }
    
    logTest('Security - Hash collision resistance', 
      !collisionFound,
      `Generated ${hashes.size} unique hashes`
    );

    // Test 4: Evidence tampering detection
    console.log('Testing evidence tampering detection...');
    const originalEvidence = { data: 'original', timestamp: new Date().toISOString() };
    const originalHash = hashEvidence(originalEvidence).hash;
    
    const tamperedEvidence = { data: 'tampered', timestamp: new Date().toISOString() };
    const verifyResult = verifyEvidenceHash(tamperedEvidence, originalHash);
    
    logTest('Security - Tampering detection', 
      !verifyResult.isValid,
      'Should detect evidence tampering'
    );

    // Test 5: Rate limiting enforcement
    console.log('Testing rate limiting enforcement...');
    let rateLimitHit = false;
    
    try {
      // Attempt to exceed rate limit
      for (let i = 0; i < 10; i++) {
        const result = await apiRateLimiters.espn.consume();
        if (!result.allowed) {
          rateLimitHit = true;
          break;
        }
      }
    } catch (error) {
      rateLimitHit = true;
    }
    
    logTest('Security - Rate limiting enforcement', 
      rateLimitHit,
      'Should enforce rate limits'
    );

  } catch (error) {
    logTest('Performance & Security - Tests', false, error.message);
  }
}

// === Main Test Runner ===

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Phase 1 Testing Suite');
  console.log('=' * 60);
  
  const startTime = Date.now();
  
  try {
    // Initialize storage before tests
    await initializeStorage();
    
    // Run all test suites
    await testEnhancedSportsApiService();
    await testConsensusEngine();
    await testValidationService();
    await testEvidenceStorage();
    await testSupportingInfrastructure();
    await testIntegrationScenarios();
    await testPerformanceAndSecurity();
    
  } catch (error) {
    console.error('💥 Test runner error:', error);
    testResults.errors.push(`Test runner error: ${error.message}`);
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Generate test report
  console.log('\n' + '=' * 60);
  console.log('📊 COMPREHENSIVE TEST REPORT');
  console.log('=' * 60);
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} (${((testResults.passed / testResults.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${testResults.failed} (${((testResults.failed / testResults.total) * 100).toFixed(1)}%)`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  if (testResults.passed === testResults.total) {
    console.log('\n🎉 ALL TESTS PASSED! Phase 1 is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Review and fix issues before deployment.');
  }
  
  // Return results for programmatic use
  return {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: (testResults.passed / testResults.total) * 100,
      duration
    },
    errors: testResults.errors,
    details: testResults.details
  };
}

// Export for use as module
export { runComprehensiveTests, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch(console.error);
}