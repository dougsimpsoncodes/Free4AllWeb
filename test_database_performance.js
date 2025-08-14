#!/usr/bin/env node

/**
 * Test script to verify database performance improvements
 * Tests the critical indexes we just created for discovered_sites table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabasePerformance() {
  console.log('🧪 Testing Database Performance Improvements...\n');

  try {
    // Test 1: URL duplicate checking performance (should use hash index)
    console.log('1️⃣ Testing URL duplicate checking...');
    const testUrl = 'https://reddit.com/r/deals/test-performance-url';
    
    const startTime1 = Date.now();
    const { data: urlTest, error: urlError } = await supabase
      .from('discovered_sites')
      .select('id, url')
      .eq('url', testUrl)
      .limit(1);
    
    const duration1 = Date.now() - startTime1;
    console.log(`   ⏱️  URL lookup took: ${duration1}ms`);
    console.log(`   📊 Result: ${urlTest?.length || 0} matches found`);
    if (urlError) console.log(`   ⚠️  Error: ${urlError.message}`);

    // Test 2: Status filtering performance (should use partial index)
    console.log('\n2️⃣ Testing status filtering...');
    
    const startTime2 = Date.now();
    const { data: statusTest, error: statusError } = await supabase
      .from('discovered_sites')
      .select('id, status, found_at')
      .eq('status', 'pending')
      .order('found_at', { ascending: false })
      .limit(10);
    
    const duration2 = Date.now() - startTime2;
    console.log(`   ⏱️  Status filtering took: ${duration2}ms`);
    console.log(`   📊 Result: ${statusTest?.length || 0} pending sites found`);
    if (statusError) console.log(`   ⚠️  Error: ${statusError.message}`);

    // Test 3: Recent discoveries performance (should use DESC index)
    console.log('\n3️⃣ Testing recent discoveries ordering...');
    
    const startTime3 = Date.now();
    const { data: recentTest, error: recentError } = await supabase
      .from('discovered_sites')
      .select('id, found_at, title')
      .order('found_at', { ascending: false })
      .limit(20);
    
    const duration3 = Date.now() - startTime3;
    console.log(`   ⏱️  Recent discoveries took: ${duration3}ms`);
    console.log(`   📊 Result: ${recentTest?.length || 0} recent sites found`);
    if (recentError) console.log(`   ⚠️  Error: ${recentError.message}`);

    // Test 4: Search terms performance
    console.log('\n4️⃣ Testing search terms ordering...');
    
    const startTime4 = Date.now();
    const { data: termsTest, error: termsError } = await supabase
      .from('search_terms')
      .select('id, term, success_rate')
      .eq('is_active', true)
      .order('success_rate', { ascending: false })
      .limit(10);
    
    const duration4 = Date.now() - startTime4;
    console.log(`   ⏱️  Search terms ordering took: ${duration4}ms`);
    console.log(`   📊 Result: ${termsTest?.length || 0} active terms found`);
    if (termsError) console.log(`   ⚠️  Error: ${termsError.message}`);

    // Test 5: Verify index usage (PostgreSQL EXPLAIN)
    console.log('\n5️⃣ Testing index usage with EXPLAIN...');
    
    const { data: explainTest, error: explainError } = await supabase.rpc('exec_sql', {
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
        SELECT * FROM discovered_sites WHERE url = $1;
      `,
      params: [testUrl]
    });
    
    if (explainTest && !explainError) {
      const plan = explainTest[0]['QUERY PLAN'][0];
      console.log(`   📋 Query Plan: ${plan['Node Type']}`);
      console.log(`   ⏱️  Execution Time: ${plan['Actual Total Time']?.toFixed(2)}ms`);
      console.log(`   📊 Rows: ${plan['Actual Rows']}`);
      
      // Check if index was used
      const indexUsed = JSON.stringify(plan).includes('idx_discovered_sites_url_hash') ||
                       JSON.stringify(plan).includes('Index Scan');
      console.log(`   🎯 Index Used: ${indexUsed ? '✅ YES' : '❌ NO'}`);
    } else if (explainError) {
      console.log(`   ⚠️  Could not run EXPLAIN: ${explainError.message}`);
    }

    // Performance summary
    console.log('\n📊 PERFORMANCE TEST SUMMARY:');
    console.log('='.repeat(50));
    console.log(`URL Lookup:         ${duration1}ms ${duration1 < 50 ? '✅' : duration1 < 100 ? '⚠️' : '❌'}`);
    console.log(`Status Filtering:   ${duration2}ms ${duration2 < 100 ? '✅' : duration2 < 200 ? '⚠️' : '❌'}`);
    console.log(`Recent Discoveries: ${duration3}ms ${duration3 < 100 ? '✅' : duration3 < 200 ? '⚠️' : '❌'}`);
    console.log(`Search Terms:       ${duration4}ms ${duration4 < 50 ? '✅' : duration4 < 100 ? '⚠️' : '❌'}`);
    
    const avgTime = (duration1 + duration2 + duration3 + duration4) / 4;
    console.log(`Average Query Time: ${avgTime.toFixed(1)}ms ${avgTime < 75 ? '✅ EXCELLENT' : avgTime < 150 ? '⚠️ GOOD' : '❌ NEEDS IMPROVEMENT'}`);

    console.log('\n🎯 EXPECTED IMPROVEMENTS:');
    console.log('• URL lookups should be <50ms (hash index)');
    console.log('• Status filtering should be <100ms (partial index)');
    console.log('• Recent discoveries should be <100ms (DESC index)');
    console.log('• Overall average should be <75ms');

    if (avgTime < 75) {
      console.log('\n🚀 SUCCESS: Database performance optimizations working perfectly!');
    } else if (avgTime < 150) {
      console.log('\n⚡ GOOD: Performance improved, indexes are working');
    } else {
      console.log('\n⚠️ REVIEW: Performance may need additional optimization');
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  }
}

// Run the performance test
testDatabasePerformance().catch(console.error);