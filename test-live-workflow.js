#!/usr/bin/env node

/**
 * Live Workflow Testing Script
 * Tests the complete Free4AllWeb system with real data
 */

import { config } from 'dotenv';
config();

const BASE_URL = 'http://localhost:3000';

console.log('🎯 Live Workflow Testing for Free4AllWeb\n');

// Test 1: Fetch Real MLB Games
async function testRealMLBData() {
  console.log('1. Testing Real MLB Data Integration...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/mlb/sync-games`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('   ✅ MLB data sync successful');
    console.log(`   📊 Synced games: ${data.gamesProcessed || 0}`);
    console.log(`   📅 Date range: ${data.dateRange || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ MLB data sync failed: ${error.message}`);
    return false;
  }
}

// Test 2: Real Deal Discovery
async function testRealDealDiscovery() {
  console.log('\n2. Testing Real Deal Discovery...');
  
  try {
    // Start deal discovery
    const response = await fetch(`${BASE_URL}/api/admin/discovery/run`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('   ✅ Deal discovery initiated');
    console.log(`   🔍 Discovery status: ${data.status || 'running'}`);
    
    // Wait a bit then check results
    console.log('   ⏳ Waiting 10 seconds for discovery results...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check discovered sites
    const sitesResponse = await fetch(`${BASE_URL}/api/admin/discovery/sites`);
    const sitesData = await sitesResponse.json();
    
    console.log(`   📋 Discovered sites: ${sitesData.sites?.length || 0}`);
    
    if (sitesData.sites?.length > 0) {
      const topSite = sitesData.sites[0];
      console.log(`   🏆 Top confidence: ${Math.round(parseFloat(topSite.confidence) * 100)}%`);
      console.log(`   🍽️  Restaurant detected: ${topSite.restaurantDetected || 'N/A'}`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Deal discovery failed: ${error.message}`);
    return false;
  }
}

// Test 3: Real Email Notification
async function testRealEmailNotification() {
  console.log('\n3. Testing Real Email Notifications...');
  
  try {
    // Get your email for testing
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    
    const response = await fetch(`${BASE_URL}/api/email/showcase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testEmail
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('   ✅ Email notification sent');
    console.log(`   📧 Sent to: ${testEmail}`);
    console.log(`   📨 Email types: ${data.emailsSent?.join(', ') || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ Email notification failed: ${error.message}`);
    return false;
  }
}

// Test 4: Real Game Processing & Deal Triggers
async function testRealGameProcessing() {
  console.log('\n4. Testing Real Game Processing & Deal Triggers...');
  
  try {
    // Process recent games for deal triggers
    const response = await fetch(`${BASE_URL}/api/admin/process-games`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('   ✅ Game processing completed');
    console.log(`   🎮 Games processed: ${data.gamesProcessed || 0}`);
    console.log(`   🎯 Deals triggered: ${data.dealsTriggered || 0}`);
    
    // Check active deals
    const dealsResponse = await fetch(`${BASE_URL}/api/active-deals`);
    const dealsData = await dealsResponse.json();
    
    console.log(`   📋 Currently active deals: ${dealsData.deals?.length || 0}`);
    
    if (dealsData.deals?.length > 0) {
      const activeDeal = dealsData.deals[0];
      console.log(`   🍔 Sample deal: ${activeDeal.restaurant} - ${activeDeal.offer}`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Game processing failed: ${error.message}`);
    return false;
  }
}

// Test 5: User Alert Subscription Flow
async function testUserAlertFlow() {
  console.log('\n5. Testing User Alert Subscription Flow...');
  
  try {
    // Test alert subscription (requires authentication in real app)
    const testUser = {
      teamId: 119, // Dodgers
      emailAlerts: true,
      smsAlerts: false,
      alertTiming: 'immediate'
    };
    
    const response = await fetch(`${BASE_URL}/api/alert-preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });
    
    if (response.status === 401) {
      console.log('   ⚠️  Authentication required for alert preferences');
      console.log('   ✅ Alert endpoint properly secured');
      return true;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('   ✅ Alert subscription successful');
    console.log(`   🔔 Alert preference ID: ${data.id || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ Alert subscription failed: ${error.message}`);
    return false;
  }
}

// Test 6: Performance & Load Testing
async function testPerformance() {
  console.log('\n6. Testing Performance & Load...');
  
  const endpoints = [
    '/api/teams',
    '/api/restaurants', 
    '/api/active-deals',
    '/api/admin/discovery/sites?limit=10'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}${endpoint}`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      const status = response.ok ? '✅' : '❌';
      
      console.log(`   ${status} ${endpoint}: ${responseTime}ms`);
      
      if (responseTime > 5000) {
        console.log(`   ⚠️  Slow response (>${responseTime}ms) for ${endpoint}`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint}: ${error.message}`);
    }
  }
  
  return true;
}

// Main Test Runner
async function runLiveTests() {
  console.log('🚀 Starting live workflow tests...\n');
  console.log('Make sure the server is running: npm run dev\n');
  
  const tests = [
    { name: 'Real MLB Data', fn: testRealMLBData },
    { name: 'Real Deal Discovery', fn: testRealDealDiscovery },
    { name: 'Real Email Notifications', fn: testRealEmailNotification },
    { name: 'Real Game Processing', fn: testRealGameProcessing },
    { name: 'User Alert Flow', fn: testUserAlertFlow },
    { name: 'Performance', fn: testPerformance }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.log(`   💥 Test crashed: ${error.message}`);
      results.push({ name: test.name, success: false });
    }
  }
  
  console.log('\n📊 Live Testing Results:');
  console.log('========================');
  
  let passedCount = 0;
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    if (result.success) passedCount++;
  }
  
  const successRate = Math.round((passedCount / results.length) * 100);
  console.log(`\n🎯 Success Rate: ${successRate}% (${passedCount}/${results.length})`);
  
  if (successRate >= 80) {
    console.log('🎉 System is ready for production!');
  } else if (successRate >= 60) {
    console.log('⚠️  System mostly working, some issues to resolve');
  } else {
    console.log('❌ System needs significant fixes before production');
  }
  
  console.log('\n📋 Manual Testing Checklist:');
  console.log('☐ Open http://localhost:3000 in browser');
  console.log('☐ Test user authentication flow');
  console.log('☐ Subscribe to Dodgers alerts');
  console.log('☐ Check deal discovery admin panel');
  console.log('☐ Verify email delivery in inbox');
  console.log('☐ Test mobile responsiveness');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveTests().catch(console.error);
}

export { runLiveTests };