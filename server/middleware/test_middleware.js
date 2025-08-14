#!/usr/bin/env node

/**
 * Test suite for RBAC and Idempotency middleware
 * 
 * Tests:
 * - Role-based access control
 * - Permission checking
 * - Idempotency key handling
 * - Request deduplication
 */

import { 
  UserRole, 
  Permission, 
  hasPermission, 
  userHasPermission, 
  getRolePermissions,
  getRoleLevel,
  hasRoleLevel
} from './rbac.ts';

import {
  generateValidationIdempotencyKey,
  generateEvidenceIdempotencyKey,
  generateNotificationIdempotencyKey,
  getIdempotencyStats,
  clearIdempotencyStore
} from './idempotency.ts';

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

async function runTests() {
  console.log('🔐 Testing RBAC and Idempotency Middleware...\n');

  // RBAC Tests
  await test('User role permissions are correctly defined', async () => {
    const userPerms = getRolePermissions(UserRole.USER);
    const reviewerPerms = getRolePermissions(UserRole.REVIEWER);
    const adminPerms = getRolePermissions(UserRole.ADMIN);
    const systemPerms = getRolePermissions(UserRole.SYSTEM);

    // User should have minimal permissions
    assert(userPerms.includes(Permission.READ_PROMOTIONS), 'User should be able to read promotions');
    assert(!userPerms.includes(Permission.WRITE_PROMOTIONS), 'User should not be able to write promotions');

    // Reviewer should have more permissions than user
    assert(reviewerPerms.includes(Permission.READ_PROMOTIONS), 'Reviewer should be able to read promotions');
    assert(reviewerPerms.includes(Permission.READ_EVIDENCE), 'Reviewer should be able to read evidence');
    assert(reviewerPerms.includes(Permission.REVIEW_VALIDATION), 'Reviewer should be able to review validation');
    assert(!reviewerPerms.includes(Permission.WRITE_PROMOTIONS), 'Reviewer should not be able to write promotions');

    // Admin should have extensive permissions
    assert(adminPerms.includes(Permission.WRITE_PROMOTIONS), 'Admin should be able to write promotions');
    assert(adminPerms.includes(Permission.APPROVE_PROMOTIONS), 'Admin should be able to approve promotions');
    assert(adminPerms.includes(Permission.OVERRIDE_VALIDATION), 'Admin should be able to override validation');
    assert(adminPerms.includes(Permission.MANAGE_USERS), 'Admin should be able to manage users');

    // System should have all permissions
    assert(systemPerms.length === Object.values(Permission).length, 'System should have all permissions');
  });

  await test('Permission checking works correctly', async () => {
    // Test role-based permission checking
    assert(hasPermission(UserRole.ADMIN, Permission.WRITE_PROMOTIONS), 'Admin should have write permissions');
    assert(!hasPermission(UserRole.USER, Permission.WRITE_PROMOTIONS), 'User should not have write permissions');
    assert(hasPermission(UserRole.REVIEWER, Permission.REVIEW_VALIDATION), 'Reviewer should have review permissions');
    assert(hasPermission(UserRole.SYSTEM, Permission.MANAGE_SYSTEM), 'System should have manage permissions');

    // Test user permission checking
    const adminUser = { id: 'admin1', role: 'admin' };
    const userUser = { id: 'user1', role: 'user' };
    const reviewerUser = { id: 'reviewer1', role: 'reviewer' };

    assert(userHasPermission(adminUser, Permission.WRITE_PROMOTIONS), 'Admin user should have write permissions');
    assert(!userHasPermission(userUser, Permission.WRITE_PROMOTIONS), 'Regular user should not have write permissions');
    assert(userHasPermission(reviewerUser, Permission.REVIEW_VALIDATION), 'Reviewer user should have review permissions');
  });

  await test('Role hierarchy levels work correctly', async () => {
    const userLevel = getRoleLevel(UserRole.USER);
    const reviewerLevel = getRoleLevel(UserRole.REVIEWER);
    const adminLevel = getRoleLevel(UserRole.ADMIN);
    const systemLevel = getRoleLevel(UserRole.SYSTEM);

    assert(userLevel < reviewerLevel, 'User level should be less than reviewer level');
    assert(reviewerLevel < adminLevel, 'Reviewer level should be less than admin level');
    assert(adminLevel < systemLevel, 'Admin level should be less than system level');

    // Test role level checking
    assert(hasRoleLevel(UserRole.ADMIN, UserRole.REVIEWER), 'Admin should meet reviewer level requirement');
    assert(hasRoleLevel(UserRole.ADMIN, UserRole.USER), 'Admin should meet user level requirement');
    assert(!hasRoleLevel(UserRole.USER, UserRole.ADMIN), 'User should not meet admin level requirement');
    assert(hasRoleLevel(UserRole.SYSTEM, UserRole.ADMIN), 'System should meet admin level requirement');
  });

  await test('Custom user permissions override role permissions', async () => {
    const userWithCustomPerms = {
      id: 'special1',
      role: 'user',
      permissions: [Permission.WRITE_PROMOTIONS, Permission.READ_EVIDENCE]
    };

    // Should have custom permissions even though role doesn't
    assert(userHasPermission(userWithCustomPerms, Permission.WRITE_PROMOTIONS), 
      'User with custom permissions should have write access');
    assert(userHasPermission(userWithCustomPerms, Permission.READ_EVIDENCE), 
      'User with custom permissions should have evidence read access');
    
    // Should still have role-based permissions
    assert(userHasPermission(userWithCustomPerms, Permission.READ_PROMOTIONS), 
      'User should still have role-based permissions');
  });

  // Idempotency Tests
  await test('Idempotency key generation is deterministic', async () => {
    // Clear store first
    clearIdempotencyStore();

    const key1 = generateValidationIdempotencyKey(1, 'game123', '2024-01-15T19:30:00Z');
    const key2 = generateValidationIdempotencyKey(1, 'game123', '2024-01-15T19:30:00Z');
    const key3 = generateValidationIdempotencyKey(1, 'game124', '2024-01-15T19:30:00Z');

    assert(key1 === key2, 'Same parameters should generate same key');
    assert(key1 !== key3, 'Different parameters should generate different keys');
    assert(key1.length === 32, 'Validation keys should be 32 characters');
  });

  await test('Evidence idempotency keys work correctly', async () => {
    const hash1 = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
    const hash2 = 'b2c3d4e5f6789012345678901234567890123456789012345678901234abcde';

    const key1 = generateEvidenceIdempotencyKey(hash1);
    const key2 = generateEvidenceIdempotencyKey(hash1);
    const key3 = generateEvidenceIdempotencyKey(hash2);

    assert(key1 === key2, 'Same hash should generate same evidence key');
    assert(key1 !== key3, 'Different hashes should generate different evidence keys');
    assert(key1.startsWith('evidence:'), 'Evidence keys should have correct prefix');
  });

  await test('Notification idempotency keys handle user targeting', async () => {
    const key1 = generateNotificationIdempotencyKey(123, 'push');
    const key2 = generateNotificationIdempotencyKey(123, 'push');
    const key3 = generateNotificationIdempotencyKey(123, 'push', 'user456');
    const key4 = generateNotificationIdempotencyKey(123, 'email');

    assert(key1 === key2, 'Same notification parameters should generate same key');
    assert(key1 !== key3, 'Different user should generate different key');
    assert(key1 !== key4, 'Different notification type should generate different key');
    assert(key1.length === 32, 'Notification keys should be 32 characters');
  });

  await test('Idempotency store statistics work correctly', async () => {
    // Clear store first
    clearIdempotencyStore();

    let stats = getIdempotencyStats();
    assert(stats.total === 0, 'Empty store should have zero total');
    assert(stats.expired === 0, 'Empty store should have zero expired');

    // Note: We can't easily test the actual store without mocking Express
    // This tests the stats interface
    assert(typeof stats.total === 'number', 'Stats should include total count');
    assert(typeof stats.expired === 'number', 'Stats should include expired count');
  });

  await test('Complex permission scenarios', async () => {
    // Test validation system permissions
    const validationUser = { id: 'val1', role: 'admin' };
    
    assert(userHasPermission(validationUser, Permission.VALIDATE_PROMOTION), 
      'Admin should be able to execute validation');
    assert(userHasPermission(validationUser, Permission.REVIEW_VALIDATION), 
      'Admin should be able to review validation');
    assert(userHasPermission(validationUser, Permission.OVERRIDE_VALIDATION), 
      'Admin should be able to override validation');

    // Test evidence permissions
    assert(userHasPermission(validationUser, Permission.READ_EVIDENCE), 
      'Admin should be able to read evidence');
    assert(userHasPermission(validationUser, Permission.WRITE_EVIDENCE), 
      'Admin should be able to write evidence');

    // Test reviewer limitations
    const reviewer = { id: 'rev1', role: 'reviewer' };
    assert(userHasPermission(reviewer, Permission.READ_EVIDENCE), 
      'Reviewer should be able to read evidence');
    assert(!userHasPermission(reviewer, Permission.WRITE_EVIDENCE), 
      'Reviewer should not be able to write evidence');
    assert(!userHasPermission(reviewer, Permission.OVERRIDE_VALIDATION), 
      'Reviewer should not be able to override validation');
  });

  await test('Idempotency key format validation (simulated)', async () => {
    // Test valid keys
    const validKeys = [
      'abc123',
      'validation-key-123',
      'evidence_hash_abc123',
      'notification-456_push',
      'a'.repeat(255) // Max length
    ];

    // Test invalid keys (we'll simulate the validation logic)
    const invalidKeys = [
      '', // Empty
      'key with spaces',
      'key@invalid#chars',
      'a'.repeat(256), // Too long
      'key.with.dots'
    ];

    // Simulate isValidIdempotencyKey function logic
    const isValidKey = (key) => /^[a-zA-Z0-9_-]{1,255}$/.test(key);

    validKeys.forEach(key => {
      assert(isValidKey(key), `Key "${key}" should be valid`);
    });

    invalidKeys.forEach(key => {
      assert(!isValidKey(key), `Key "${key}" should be invalid`);
    });
  });

  await test('Permission inheritance and security boundaries', async () => {
    // Test that higher roles include lower role permissions
    const adminPerms = getRolePermissions(UserRole.ADMIN);
    const reviewerPerms = getRolePermissions(UserRole.REVIEWER);
    const userPerms = getRolePermissions(UserRole.USER);

    // Admin should include all reviewer permissions
    reviewerPerms.forEach(perm => {
      assert(adminPerms.includes(perm), `Admin should have reviewer permission: ${perm}`);
    });

    // Reviewer should include all user permissions  
    userPerms.forEach(perm => {
      assert(reviewerPerms.includes(perm), `Reviewer should have user permission: ${perm}`);
    });

    // Test security boundaries - users should not have dangerous permissions
    const dangerousPermissions = [
      Permission.DELETE_EVIDENCE,
      Permission.OVERRIDE_VALIDATION,
      Permission.MANAGE_SYSTEM
    ];

    dangerousPermissions.forEach(perm => {
      assert(!userPerms.includes(perm), `User should not have dangerous permission: ${perm}`);
    });
  });

  await test('Role-based access scenarios for validation system', async () => {
    const scenarios = [
      {
        role: UserRole.USER,
        canRead: true,
        canWrite: false,
        canValidate: false,
        canReview: false,
        canOverride: false
      },
      {
        role: UserRole.REVIEWER, 
        canRead: true,
        canWrite: false,
        canValidate: false,
        canReview: true,
        canOverride: false
      },
      {
        role: UserRole.ADMIN,
        canRead: true,
        canWrite: true,
        canValidate: true,
        canReview: true,
        canOverride: true
      },
      {
        role: UserRole.SYSTEM,
        canRead: true,
        canWrite: true,
        canValidate: true,
        canReview: true,
        canOverride: true
      }
    ];

    scenarios.forEach(scenario => {
      const user = { id: 'test', role: scenario.role };
      
      assert(userHasPermission(user, Permission.READ_PROMOTIONS) === scenario.canRead,
        `${scenario.role} read permission should be ${scenario.canRead}`);
      
      assert(userHasPermission(user, Permission.WRITE_PROMOTIONS) === scenario.canWrite,
        `${scenario.role} write permission should be ${scenario.canWrite}`);
      
      assert(userHasPermission(user, Permission.VALIDATE_PROMOTION) === scenario.canValidate,
        `${scenario.role} validate permission should be ${scenario.canValidate}`);
      
      assert(userHasPermission(user, Permission.REVIEW_VALIDATION) === scenario.canReview,
        `${scenario.role} review permission should be ${scenario.canReview}`);
      
      assert(userHasPermission(user, Permission.OVERRIDE_VALIDATION) === scenario.canOverride,
        `${scenario.role} override permission should be ${scenario.canOverride}`);
    });
  });

  // Summary
  console.log(`\n📊 Test Results: ${passCount}/${testCount} passed`);

  if (passCount === testCount) {
    console.log('🎉 All RBAC and idempotency tests passed!');
    console.log('🔐 Role-based access control and idempotency middleware are working correctly.');
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