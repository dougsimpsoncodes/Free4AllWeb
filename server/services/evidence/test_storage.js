#!/usr/bin/env node

/**
 * Test suite for WORM evidence storage
 * 
 * Tests:
 * - Evidence storage and retrieval
 * - Hash verification
 * - WORM constraints (immutability)
 * - Deduplication
 */

import { putImmutable, verifyStored, getEvidenceByHash, checkStorageHealth, initializeStorage } from './storage.ts';
import { hashEvidence } from './hash.ts';

// Test counter
let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  console.log(`\n🧪 Testing: ${name}`);
  return fn()
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

async function runTests() {
  console.log('🔒 Testing WORM Evidence Storage...\n');

  // Initialize storage first
  await test('Storage initialization', async () => {
    await initializeStorage();
  });

  // Test 1: Basic evidence storage
  await test('Basic evidence storage', async () => {
    const evidence = {
      gameId: "test-game-001",
      team: "Dodgers",
      score: 7,
      opponent: "Giants",
      timestamp: "2024-08-15T22:30:00Z"
    };

    const result = await putImmutable(evidence);
    
    assert(result.uri, 'Should return storage URI');
    assert(result.hash, 'Should return evidence hash');
    assert(result.hash.length === 64, 'Hash should be 64 characters (SHA-256)');
    assert(result.storedAt, 'Should include timestamp');
    assert(result.size > 0, 'Should include size');

    // Store for later tests
    global.testEvidenceUri = result.uri;
    global.testEvidenceHash = result.hash;
    global.testEvidence = evidence;
  });

  // Test 2: Evidence retrieval and verification
  await test('Evidence retrieval and verification', async () => {
    const verification = await verifyStored(global.testEvidenceUri, global.testEvidenceHash);
    
    assert(verification.isValid, 'Stored evidence should verify correctly');
    assert(verification.evidence, 'Should return evidence object');
    assert(verification.hashVerification.matches, 'Hash should match');
    assert(verification.metadata, 'Should include metadata');
    
    // Verify evidence content
    assert(verification.evidence.gameId === global.testEvidence.gameId, 'Game ID should match');
    assert(verification.evidence.score === global.testEvidence.score, 'Score should match');
  });

  // Test 3: Get evidence by hash
  await test('Get evidence by hash', async () => {
    const result = await getEvidenceByHash(global.testEvidenceHash);
    
    assert(result.isValid, 'Should retrieve evidence successfully');
    assert(result.evidence, 'Should return evidence object');
    assert(result.evidence.team === 'Dodgers', 'Evidence content should match');
  });

  // Test 4: Deduplication (storing same evidence twice)
  await test('Evidence deduplication', async () => {
    const sameEvidence = { ...global.testEvidence };
    const result = await putImmutable(sameEvidence);
    
    // Should return same hash and URI
    assert(result.hash === global.testEvidenceHash, 'Duplicate evidence should return same hash');
    assert(result.uri === global.testEvidenceUri, 'Duplicate evidence should return same URI');
  });

  // Test 5: Different evidence produces different hash
  await test('Different evidence produces different hash', async () => {
    const differentEvidence = {
      ...global.testEvidence,
      score: 8 // Changed score
    };

    const result = await putImmutable(differentEvidence);
    
    assert(result.hash !== global.testEvidenceHash, 'Different evidence should produce different hash');
    assert(result.uri !== global.testEvidenceUri, 'Different evidence should have different URI');
  });

  // Test 6: Hash verification failure for tampered evidence
  await test('Hash verification detects tampering', async () => {
    const verification = await verifyStored(global.testEvidenceUri, 'invalid_hash_that_does_not_match_evidence_content_at_all_64chars');
    
    assert(!verification.isValid, 'Should detect hash mismatch');
    assert(verification.error, 'Should provide error message');
  });

  // Test 7: Complex evidence with nested objects
  await test('Complex evidence storage', async () => {
    const complexEvidence = {
      promotion: {
        id: 1,
        title: "Free Orange Chicken - 6+ Runs"
      },
      game: {
        dodgers: { score: 8, hits: 12, errors: 0 },
        opponent: { score: 3, hits: 7, errors: 2 },
        inning: 9,
        status: "final"
      },
      validation: {
        sources: [
          { name: "ESPN", score: 8, fetchedAt: "2024-08-15T22:45:00Z" },
          { name: "MLB", score: 8, fetchedAt: "2024-08-15T22:45:02Z" }
        ],
        consensus: "CONFIRMED",
        triggeredAt: "2024-08-15T22:45:05Z"
      },
      metadata: {
        validatedBy: "validation_engine_v1.0",
        confidence: 1.0,
        evidence_version: "2024.1"
      }
    };

    const result = await putImmutable(complexEvidence);
    assert(result.hash, 'Complex evidence should be stored successfully');
    
    const verification = await verifyStored(result.uri, result.hash);
    assert(verification.isValid, 'Complex evidence should verify correctly');
    assert(verification.evidence.promotion.title === complexEvidence.promotion.title, 'Nested data should be preserved');
  });

  // Test 8: Storage health check
  await test('Storage health check', async () => {
    const health = await checkStorageHealth();
    
    assert(typeof health.isHealthy === 'boolean', 'Should report health status');
    assert(health.statistics, 'Should include statistics');
    assert(health.statistics.totalRecords >= 0, 'Should report record count');
    assert(Array.isArray(health.issues), 'Should include issues array');
    
    console.log(`   📊 Storage stats: ${health.statistics.totalRecords} records, ${health.statistics.totalSize} bytes`);
  });

  // Test 9: Large evidence (stress test)
  await test('Large evidence storage', async () => {
    // Create evidence with substantial content
    const largeEvidence = {
      gameData: {
        innings: Array.from({ length: 9 }, (_, i) => ({
          inning: i + 1,
          top: { runs: Math.floor(Math.random() * 3), hits: Math.floor(Math.random() * 4) },
          bottom: { runs: Math.floor(Math.random() * 3), hits: Math.floor(Math.random() * 4) }
        })),
        playByPlay: Array.from({ length: 100 }, (_, i) => ({
          play: i + 1,
          description: `Play description ${i + 1} with detailed information about what happened`,
          timestamp: new Date(Date.now() + i * 60000).toISOString()
        }))
      },
      metadata: {
        version: "1.0",
        created: new Date().toISOString(),
        description: "Large evidence object for stress testing storage capabilities"
      }
    };

    const result = await putImmutable(largeEvidence);
    assert(result.hash, 'Large evidence should be stored successfully');
    assert(result.size > 1000, 'Large evidence should have substantial size');
    
    const verification = await verifyStored(result.uri, result.hash);
    assert(verification.isValid, 'Large evidence should verify correctly');
  });

  // Test 10: Invalid hash format handling
  await test('Invalid hash format handling', async () => {
    const invalidHashes = [
      'too_short',
      'way_too_long_hash_that_exceeds_64_characters_and_should_be_rejected_by_validation',
      'contains-invalid-chars!@#$',
      '',
      null,
      undefined
    ];

    for (const invalidHash of invalidHashes) {
      const result = await getEvidenceByHash(invalidHash);
      assert(!result.isValid, `Invalid hash "${invalidHash}" should be rejected`);
      assert(result.error, 'Should provide error message for invalid hash');
    }
  });

  // Summary
  console.log(`\n📊 Test Results: ${passCount}/${testCount} passed`);

  if (passCount === testCount) {
    console.log('🎉 All WORM storage tests passed! Evidence storage is working correctly.');
    console.log('🔒 WORM constraints ensure evidence integrity and immutability.');
    return true;
  } else {
    console.log('❌ Some storage tests failed. Please review the implementation.');
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