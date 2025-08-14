#!/usr/bin/env node

/**
 * Check if our performance indexes were created successfully
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

async function checkIndexes() {
  console.log('🔍 Checking database indexes...\n');

  try {
    // Check if our expected indexes exist by trying to use them in EXPLAIN queries
    const indexChecks = [
      {
        name: 'idx_discovered_sites_url_hash',
        query: "SELECT 1 FROM discovered_sites WHERE url = 'test' LIMIT 1"
      },
      {
        name: 'idx_discovered_sites_status_pending', 
        query: "SELECT 1 FROM discovered_sites WHERE status = 'pending' LIMIT 1"
      },
      {
        name: 'idx_discovered_sites_found_at_desc',
        query: "SELECT 1 FROM discovered_sites ORDER BY found_at DESC LIMIT 1"
      },
      {
        name: 'idx_search_terms_success_rate_desc',
        query: "SELECT 1 FROM search_terms WHERE is_active = true ORDER BY success_rate DESC LIMIT 1"
      }
    ];

    console.log('📋 TESTING INDEX USAGE:');
    console.log('='.repeat(50));

    for (const check of indexChecks) {
      try {
        const startTime = Date.now();
        const { data, error } = await supabase
          .from('discovered_sites')
          .select('id')
          .limit(1);
        const duration = Date.now() - startTime;
        
        console.log(`   ${check.name}: ${duration}ms`);
      } catch (error) {
        console.log(`   ${check.name}: ERROR - ${error.message}`);
      }
    }

    if (error) {
      console.error('❌ Error querying indexes:', error.message);
      return;
    }

    console.log('📋 CURRENT INDEXES:');
    console.log('='.repeat(80));
    
    const discoveredSitesIndexes = indexes.filter(i => i.tablename === 'discovered_sites');
    const searchTermsIndexes = indexes.filter(i => i.tablename === 'search_terms');
    
    console.log('\n🗂️  discovered_sites table:');
    if (discoveredSitesIndexes.length === 0) {
      console.log('   ❌ No indexes found');
    } else {
      discoveredSitesIndexes.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
        if (idx.indexdef.length < 100) {
          console.log(`      ${idx.indexdef}`);
        }
      });
    }
    
    console.log('\n🔍 search_terms table:');
    if (searchTermsIndexes.length === 0) {
      console.log('   ❌ No indexes found');
    } else {
      searchTermsIndexes.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
        if (idx.indexdef.length < 100) {
          console.log(`      ${idx.indexdef}`);
        }
      });
    }

    // Check for our specific performance indexes
    console.log('\n🎯 PERFORMANCE INDEXES STATUS:');
    console.log('='.repeat(50));
    
    const expectedIndexes = [
      'idx_discovered_sites_url_hash',
      'idx_discovered_sites_status_pending', 
      'idx_discovered_sites_found_at_desc',
      'idx_discovered_sites_status_found_at',
      'idx_search_terms_success_rate_desc'
    ];
    
    expectedIndexes.forEach(expectedIndex => {
      const found = indexes.find(idx => idx.indexname === expectedIndex);
      if (found) {
        console.log(`   ✅ ${expectedIndex} - EXISTS`);
      } else {
        console.log(`   ❌ ${expectedIndex} - MISSING`);
      }
    });

    // Get table row counts for context
    console.log('\n📊 TABLE SIZES:');
    console.log('='.repeat(30));
    
    const { data: discoveredCount } = await supabase
      .from('discovered_sites')
      .select('id', { count: 'exact', head: true });
    
    const { data: termsCount } = await supabase
      .from('search_terms')
      .select('id', { count: 'exact', head: true });
    
    console.log(`   discovered_sites: ${discoveredCount?.length || 'Unknown'} rows`);
    console.log(`   search_terms: ${termsCount?.length || 'Unknown'} rows`);

  } catch (error) {
    console.error('❌ Error checking indexes:', error);
  }
}

// Run the check
checkIndexes().catch(console.error);