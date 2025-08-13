#!/usr/bin/env node

/**
 * APNs Credential Validation Script
 * Securely validates APNs setup before deployment
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

console.log('🔐 Free4AllWeb APNs Security Validation\n');

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function pass(message) {
  console.log(`✅ ${message}`);
  checks.passed++;
}

function fail(message) {
  console.log(`❌ ${message}`);
  checks.failed++;
}

function warn(message) {
  console.log(`⚠️  ${message}`);
  checks.warnings++;
}

// Check 1: Environment Variables
console.log('📋 Checking Environment Variables...');

const requiredVars = [
  'APNS_KEY_ID',
  'APNS_TEAM_ID', 
  'APNS_BUNDLE_ID'
];

requiredVars.forEach(varName => {
  if (process.env[varName]) {
    pass(`${varName} is configured`);
  } else {
    fail(`${varName} is missing from environment`);
  }
});

// Check 2: Private Key File
console.log('\n📁 Checking Private Key File...');

const keyPath = process.env.APNS_PRIVATE_KEY_PATH || './credentials/apns-key.p8';

if (fs.existsSync(keyPath)) {
  pass(`Private key file found at ${keyPath}`);
  
  // Check file permissions
  const stats = fs.statSync(keyPath);
  const permissions = (stats.mode & parseInt('777', 8)).toString(8);
  
  if (permissions === '600') {
    pass('File permissions are secure (600)');
  } else {
    fail(`File permissions are insecure (${permissions}). Run: chmod 600 ${keyPath}`);
  }
  
  // Validate key format
  try {
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    
    if (keyContent.includes('-----BEGIN PRIVATE KEY-----') && 
        keyContent.includes('-----END PRIVATE KEY-----')) {
      pass('Private key format is valid');
    } else {
      fail('Private key format is invalid');
    }
    
    // Check key length (Apple keys are typically 256 bytes)
    const keyLines = keyContent.split('\n').filter(line => 
      !line.includes('BEGIN') && !line.includes('END') && line.trim()
    );
    
    if (keyLines.length > 0) {
      pass('Private key contains content');
    } else {
      fail('Private key appears to be empty');
    }
    
  } catch (error) {
    fail(`Cannot read private key file: ${error.message}`);
  }
} else {
  fail(`Private key file not found at ${keyPath}`);
  console.log(`   💡 Create credentials directory and place your .p8 file there:`);
  console.log(`   mkdir -p credentials`);
  console.log(`   cp ~/Downloads/AuthKey_YOURKEY.p8 ${keyPath}`);
  console.log(`   chmod 600 ${keyPath}`);
}

// Check 3: Directory Security
console.log('\n🗂️  Checking Directory Security...');

const credentialsDir = path.dirname(keyPath);

if (fs.existsSync(credentialsDir)) {
  const dirStats = fs.statSync(credentialsDir);
  const dirPermissions = (dirStats.mode & parseInt('777', 8)).toString(8);
  
  if (dirPermissions === '700') {
    pass(`Credentials directory permissions are secure (700)`);
  } else {
    warn(`Credentials directory permissions could be more secure (${dirPermissions}). Consider: chmod 700 ${credentialsDir}`);
  }
} else {
  fail(`Credentials directory does not exist: ${credentialsDir}`);
}

// Check 4: Git Security
console.log('\n🔒 Checking Git Security...');

const gitignorePath = '.gitignore';
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  
  const securityPatterns = [
    'credentials/',
    '*.p8',
    '.env'
  ];
  
  securityPatterns.forEach(pattern => {
    if (gitignoreContent.includes(pattern)) {
      pass(`Git ignores ${pattern}`);
    } else {
      fail(`Add "${pattern}" to .gitignore to prevent credential exposure`);
    }
  });
} else {
  warn('.gitignore file not found');
}

// Check 5: Bundle ID Format
console.log('\n📦 Checking Bundle ID Format...');

const bundleId = process.env.APNS_BUNDLE_ID;
if (bundleId) {
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+/.test(bundleId)) {
    pass('Bundle ID format is valid');
  } else {
    warn('Bundle ID format may be invalid (should be like com.company.app)');
  }
  
  if (bundleId.includes('free4all')) {
    pass('Bundle ID appears to be for Free4AllWeb');
  } else {
    warn('Bundle ID may not match Free4AllWeb project');
  }
}

// Check 6: Environment Type
console.log('\n🌍 Checking Environment Configuration...');

const environment = process.env.APNS_ENVIRONMENT || 'sandbox';
if (environment === 'sandbox') {
  pass('Environment set to sandbox (development)');
} else if (environment === 'production') {
  warn('Environment set to production - ensure this is intentional');
} else {
  fail(`Invalid environment: ${environment} (should be 'sandbox' or 'production')`);
}

// Summary
console.log('\n📊 Security Validation Summary');
console.log('═══════════════════════════════');
console.log(`✅ Passed: ${checks.passed}`);
console.log(`❌ Failed: ${checks.failed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);

if (checks.failed === 0) {
  console.log('\n🎉 APNs setup is secure and ready for use!');
  
  if (checks.warnings > 0) {
    console.log('💡 Consider addressing warnings for optimal security.');
  }
  
  console.log('\nNext steps:');
  console.log('1. Start your development server: npm run dev');
  console.log('2. Check APNs status: curl http://localhost:5001/api/test/apns-status');
  console.log('3. Test notifications: curl -X POST http://localhost:5001/api/test/send-notification');
  
  process.exit(0);
} else {
  console.log('\n⚠️  APNs setup has security issues that must be resolved.');
  console.log('Please fix the failed checks before proceeding to production.');
  
  process.exit(1);
}