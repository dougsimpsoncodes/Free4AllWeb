#!/usr/bin/env node

/**
 * Test suite for evidence canonicalization and hashing utilities
 * 
 * Validates that:
 * - Canonicalization is deterministic and order-independent
 * - Hashing produces consistent, verifiable results
 * - Edge cases are handled correctly
 */

import { canonicalize, canonicalizeEvidence, validateCanonicalEvidence, parseCanonicalEvidence } from './canonicalize.ts';
import { hashEvidence, verifyEvidenceHash, createHashChain, verifyHashChain, isValidHashFormat, createEvidenceIntegrity } from './hash.ts';

// Test counter
let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('🧪 Testing Evidence Utilities...\n');

// Test 1: Basic canonicalization determinism
test('Canonicalization is deterministic', () => {
  const obj1 = { b: 2, a: 1, c: 3 };
  const obj2 = { a: 1, c: 3, b: 2 };
  
  const canon1 = canonicalize(obj1);
  const canon2 = canonicalize(obj2);
  
  assert(canon1 === canon2, 'Objects with same content but different order should canonicalize identically');
  assert(canon1 === '{"a":1,"b":2,"c":3}', 'Should produce expected canonical form');
});

// Test 2: Nested object canonicalization
test('Nested object canonicalization', () => {
  const obj1 = {
    game: { score: 6, opponent: "Padres" },
    timestamp: "2024-01-15T19:30:00Z",
    metadata: { source: "ESPN" }
  };
  
  const obj2 = {
    metadata: { source: "ESPN" },
    game: { opponent: "Padres", score: 6 },
    timestamp: "2024-01-15T19:30:00Z"
  };
  
  const canon1 = canonicalizeEvidence(obj1);
  const canon2 = canonicalizeEvidence(obj2);
  
  assert(canon1 === canon2, 'Nested objects should canonicalize identically regardless of order');
});

// Test 3: Timestamp normalization
test('Timestamp normalization', () => {
  const evidence = {
    gameData: {
      finalScore: 6,
      completedAt: new Date('2024-01-15T19:30:00.000Z')
    },
    validatedAt: "2024-01-15T19:35:00Z"
  };
  
  const canonical = canonicalizeEvidence(evidence);
  
  assert(canonical.includes('"completedAt":"2024-01-15T19:30:00.000Z"'), 'Date objects should be normalized to ISO strings');
  assert(canonical.includes('"validatedAt":"2024-01-15T19:35:00.000Z"'), 'ISO strings should remain consistent');
});

// Test 4: Undefined value handling
test('Undefined value handling', () => {
  const obj = {
    a: 1,
    b: undefined,
    c: null,
    d: 2
  };
  
  const canonical = canonicalize(obj, { undefinedBehavior: 'omit' });
  
  assert(!canonical.includes('undefined'), 'Undefined values should be omitted');
  assert(canonical.includes('null'), 'Null values should be preserved');
  assert(canonical === '{"a":1,"c":null,"d":2}', 'Should omit undefined but keep null');
});

// Test 5: Array canonicalization
test('Array canonicalization', () => {
  const evidence = {
    sources: [
      { name: "ESPN", score: 6 },
      { name: "MLB", score: 5 }
    ]
  };
  
  const canonical = canonicalizeEvidence(evidence);
  const parsed = parseCanonicalEvidence(canonical);
  
  assert(Array.isArray(parsed.sources), 'Arrays should be preserved');
  assert(parsed.sources.length === 2, 'Array length should be preserved');
});

// Test 6: Basic hashing
test('Basic evidence hashing', () => {
  const evidence = {
    gameId: "dodgers-vs-padres-20240115",
    finalScore: 6,
    triggerMet: true
  };
  
  const result1 = hashEvidence(evidence);
  const result2 = hashEvidence(evidence);
  
  assert(result1.hash === result2.hash, 'Same evidence should produce same hash');
  assert(isValidHashFormat(result1.hash), 'Hash should be valid SHA-256 format');
  assert(result1.algorithm === 'sha256', 'Algorithm should be SHA-256');
  assert(result1.canonical, 'Should include canonical form');
});

// Test 7: Hash verification
test('Hash verification', () => {
  const evidence = {
    team: "Dodgers",
    score: 7,
    opponent: "Giants",
    isHome: true
  };
  
  const hashResult = hashEvidence(evidence);
  const verification = verifyEvidenceHash(evidence, hashResult.hash);
  
  assert(verification.isValid, 'Hash verification should pass for identical evidence');
  assert(verification.expectedHash === hashResult.hash, 'Expected hash should match');
  assert(verification.actualHash === hashResult.hash, 'Actual hash should match');
});

// Test 8: Hash verification failure
test('Hash verification detects tampering', () => {
  const originalEvidence = { score: 6, team: "Dodgers" };
  const tamperedEvidence = { score: 7, team: "Dodgers" };
  
  const originalHash = hashEvidence(originalEvidence).hash;
  const verification = verifyEvidenceHash(tamperedEvidence, originalHash);
  
  assert(!verification.isValid, 'Hash verification should fail for tampered evidence');
  assert(verification.error, 'Should provide error message');
});

// Test 9: Hash chain creation and verification
test('Hash chain functionality', () => {
  const evidenceList = [
    { source: "ESPN", score: 6, timestamp: "2024-01-15T19:30:00Z" },
    { source: "MLB", score: 6, timestamp: "2024-01-15T19:31:00Z" },
    { consensus: "CONFIRMED", confidence: 1.0 }
  ];
  
  const chainHash = createHashChain(evidenceList);
  const verification = verifyHashChain(evidenceList, chainHash);
  
  assert(isValidHashFormat(chainHash), 'Chain hash should be valid format');
  assert(verification.isValid, 'Chain verification should pass');
});

// Test 10: Hash chain tampering detection
test('Hash chain detects tampering', () => {
  const originalList = [
    { source: "ESPN", score: 6 },
    { source: "MLB", score: 6 }
  ];
  
  const tamperedList = [
    { source: "ESPN", score: 6 },
    { source: "MLB", score: 5 } // Changed score
  ];
  
  const originalChain = createHashChain(originalList);
  const verification = verifyHashChain(tamperedList, originalChain);
  
  assert(!verification.isValid, 'Chain verification should detect tampering');
});

// Test 11: Evidence integrity metadata
test('Evidence integrity metadata creation', () => {
  const evidence = {
    gameData: {
      dodgersScore: 8,
      giantsScore: 3,
      inning: 9,
      isFinal: true
    },
    validation: {
      triggerMet: true,
      conditions: ["score >= 6", "is_home = true"]
    }
  };
  
  const integrity = createEvidenceIntegrity(evidence);
  
  assert(integrity.hash, 'Should include hash');
  assert(integrity.canonical, 'Should include canonical form');
  assert(integrity.algorithm === 'sha256', 'Should specify algorithm');
  assert(integrity.hashedAt, 'Should include timestamp');
  assert(integrity.version === '1.0', 'Should include version');
});

// Test 12: Complex game evidence scenario
test('Complex game evidence scenario', () => {
  const gameEvidence = {
    game: {
      id: "game_401472250",
      date: "2024-08-15",
      teams: {
        home: { name: "Los Angeles Dodgers", score: 7 },
        away: { name: "San Diego Padres", score: 3 }
      },
      status: "final",
      inning: 9
    },
    promotion: {
      id: 1,
      title: "Free Orange Chicken - 6+ Runs",
      conditions: {
        type: "team_score",
        operator: "gte", 
        value: 6,
        homeGame: true
      }
    },
    validation: {
      sources: [
        {
          name: "ESPN",
          score: 7,
          status: "final",
          fetchedAt: "2024-08-15T22:45:30Z",
          confidence: 1.0
        },
        {
          name: "MLB",
          score: 7,
          status: "final", 
          fetchedAt: "2024-08-15T22:45:32Z",
          confidence: 1.0
        }
      ],
      consensus: "CONFIRMED",
      triggerMet: true,
      validatedAt: "2024-08-15T22:45:35Z"
    }
  };
  
  // Test canonicalization
  const canonical = canonicalizeEvidence(gameEvidence);
  assert(canonical.length > 0, 'Should produce non-empty canonical form');
  
  // Test hashing
  const hashResult = hashEvidence(gameEvidence);
  assert(isValidHashFormat(hashResult.hash), 'Should produce valid hash');
  
  // Test verification
  const verification = verifyEvidenceHash(gameEvidence, hashResult.hash);
  assert(verification.isValid, 'Should verify successfully');
  
  // Test round-trip
  const parsed = parseCanonicalEvidence(canonical);
  const secondHash = hashEvidence(parsed);
  assert(hashResult.hash === secondHash.hash, 'Round-trip should preserve hash');
});

// Test 13: Edge cases
test('Edge cases handling', () => {
  const edgeCases = [
    null,
    undefined,
    "",
    0,
    false,
    [],
    {},
    { a: null, b: undefined },
    [null, undefined, 0, false, ""],
    new Date('2024-01-15T19:30:00.000Z'),
    { nested: { deep: { value: 42 } } }
  ];
  
  edgeCases.forEach((testCase, index) => {
    try {
      const canonical = canonicalizeEvidence(testCase);
      const hashResult = hashEvidence(testCase);
      assert(isValidHashFormat(hashResult.hash), `Edge case ${index} should produce valid hash`);
    } catch (error) {
      throw new Error(`Edge case ${index} failed: ${error.message}`);
    }
  });
});

// Summary
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed`);

if (passCount === testCount) {
  console.log('🎉 All tests passed! Evidence utilities are working correctly.');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review the implementation.');
  process.exit(1);
}