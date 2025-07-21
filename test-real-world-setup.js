#!/usr/bin/env node

/**
 * Real-World Testing Setup Validator
 * Tests all live integrations before running the full system
 */

import { config } from 'dotenv';
import { Pool } from 'pg';

config();

console.log('🧪 Real-World Testing Setup Validator\n');

// Test 1: Database Connection
async function testDatabase() {
  console.log('1. Testing Database Connection...');
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'your_neon_database_url_here') {
    console.log('   ❌ DATABASE_URL not configured');
    return false;
  }
  
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    
    console.log('   ✅ Database connected successfully');
    console.log(`   📊 Current time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
    return false;
  }
}

// Test 2: Email Service
async function testEmail() {
  console.log('\n2. Testing Email Service...');
  
  const requiredVars = ['EMAIL_FROM', 'SMTP_USER', 'SMTP_PASS'];
  const missing = requiredVars.filter(v => 
    !process.env[v] || process.env[v].includes('your_') || process.env[v].includes('_here')
  );
  
  if (missing.length > 0) {
    console.log(`   ❌ Email variables not configured: ${missing.join(', ')}`);
    return false;
  }
  
  console.log('   ✅ Email environment variables configured');
  console.log(`   📧 From: ${process.env.EMAIL_FROM}`);
  return true;
}

// Test 3: SMS Service  
async function testSMS() {
  console.log('\n3. Testing SMS Service...');
  
  const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  const missing = requiredVars.filter(v => 
    !process.env[v] || process.env[v].includes('your_') || process.env[v].includes('_here')
  );
  
  if (missing.length > 0) {
    console.log(`   ❌ Twilio variables not configured: ${missing.join(', ')}`);
    return false;
  }
  
  console.log('   ✅ SMS environment variables configured');
  console.log(`   📱 From: ${process.env.TWILIO_PHONE_NUMBER}`);
  return true;
}

// Test 4: MLB API Access
async function testMLBAPI() {
  console.log('\n4. Testing MLB API Access...');
  
  try {
    const response = await fetch('https://statsapi.mlb.com/api/v1/teams');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('   ✅ MLB API accessible');
    console.log(`   ⚾ Found ${data.teams?.length || 0} teams`);
    return true;
  } catch (error) {
    console.log(`   ❌ MLB API failed: ${error.message}`);
    return false;
  }
}

// Test 5: External Website Access (for deal discovery)
async function testWebAccess() {
  console.log('\n5. Testing External Website Access...');
  
  const testSites = [
    'https://www.mcdonalds.com',
    'https://www.pandaexpress.com',
    'https://www.deltaco.com'
  ];
  
  let successCount = 0;
  
  for (const site of testSites) {
    try {
      const response = await fetch(site, { 
        method: 'HEAD',
        timeout: 5000
      });
      
      if (response.ok) {
        console.log(`   ✅ ${site} accessible`);
        successCount++;
      } else {
        console.log(`   ⚠️  ${site} returned ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${site} failed: ${error.message}`);
    }
  }
  
  console.log(`   📊 ${successCount}/${testSites.length} restaurant sites accessible`);
  return successCount > 0;
}

// Main Test Runner
async function runTests() {
  console.log('Running pre-deployment validation tests...\n');
  
  const tests = [
    { name: 'Database', fn: testDatabase },
    { name: 'Email', fn: testEmail },
    { name: 'SMS', fn: testSMS },
    { name: 'MLB API', fn: testMLBAPI },
    { name: 'Web Access', fn: testWebAccess }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const success = await test.fn();
    results.push({ name: test.name, success });
  }
  
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  
  let allPassed = true;
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    if (!result.success) allPassed = false;
  }
  
  console.log('\n🎯 Next Steps:');
  
  if (allPassed) {
    console.log('✅ All tests passed! Ready for real-world testing.');
    console.log('🚀 Run: npm run dev');
  } else {
    console.log('❌ Some tests failed. Please configure missing services:');
    console.log('   📖 See setup guides: EMAIL_SETUP.md, SMS_SETUP.md');
    console.log('   🔗 Database: https://console.neon.tech/');
    console.log('   📧 Email: https://www.mailersend.com/');
    console.log('   📱 SMS: https://www.twilio.com/');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };