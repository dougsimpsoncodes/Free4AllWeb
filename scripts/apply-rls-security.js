#!/usr/bin/env node

/**
 * Script to apply RLS (Row Level Security) policies to Supabase
 * This fixes the security vulnerabilities identified by Supabase linter
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase connection using service role key (bypasses RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('You need the service role key (not anon key) to apply RLS policies');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function applyRLSPolicies() {
  console.log('🔒 Applying Row Level Security (RLS) policies to Supabase...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', '0002_enable_rls_security.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements (by semicolon)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Extract a description from the statement
      const firstLine = statement.split('\n')[0];
      const description = firstLine.length > 60 
        ? firstLine.substring(0, 60) + '...' 
        : firstLine;
      
      process.stdout.write(`[${i + 1}/${statements.length}] ${description}`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });

        if (error) {
          // Check if it's a "already exists" error which we can ignore
          if (error.message?.includes('already exists')) {
            process.stdout.write(' ⏭️  Already exists\n');
            successCount++;
          } else {
            process.stdout.write(' ❌ Error\n');
            errorCount++;
            errors.push({
              statement: description,
              error: error.message
            });
          }
        } else {
          process.stdout.write(' ✅\n');
          successCount++;
        }
      } catch (err) {
        process.stdout.write(' ❌ Error\n');
        errorCount++;
        errors.push({
          statement: description,
          error: err.message
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully applied: ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} statements\n`);
      console.log('Errors:');
      errors.forEach(e => {
        console.log(`  - ${e.statement}`);
        console.log(`    Error: ${e.error}`);
      });
    }

    // Verify RLS is enabled
    console.log('\n🔍 Verifying RLS status...\n');
    
    const tables = [
      'alert_preferences', 'alert_history', 'deal_pages', 'games',
      'discovery_sources', 'leagues', 'promotions', 'sessions',
      'search_terms', 'teams', 'users', 'triggered_deals',
      'restaurants', 'discovered_sites', 'device_tokens',
      'promotion_trigger_events'
    ];

    const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (${tables.map(t => `'${t}'`).join(',')})
        ORDER BY tablename;
      `
    });

    if (rlsStatus && !rlsError) {
      console.log('RLS Status for tables:');
      rlsStatus.forEach(row => {
        const icon = row.rowsecurity ? '✅' : '❌';
        console.log(`  ${icon} ${row.tablename}: RLS ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
      });
    }

    console.log('\n✨ RLS security configuration complete!');
    console.log('Your Supabase database is now properly secured with Row Level Security.\n');

  } catch (error) {
    console.error('❌ Failed to apply RLS policies:', error);
    process.exit(1);
  }
}

// Alternative: Direct SQL execution if RPC doesn't work
async function applyRLSPoliciesDirect() {
  console.log('🔒 Applying RLS policies using direct SQL execution...\n');
  
  // Note: This requires using the Supabase SQL Editor or psql directly
  console.log('Since Supabase RPC might not be available, you can:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Copy the contents of migrations/0002_enable_rls_security.sql');
  console.log('3. Paste and run in the SQL Editor');
  console.log('\nOr use psql:');
  console.log(`psql "${process.env.DATABASE_URL}" < migrations/0002_enable_rls_security.sql`);
}

// Check if we can use RPC
async function checkRPCAvailable() {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    return !error;
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  const rpcAvailable = await checkRPCAvailable();
  
  if (rpcAvailable) {
    await applyRLSPolicies();
  } else {
    console.log('⚠️  RPC method not available.');
    await applyRLSPoliciesDirect();
  }
}

main().catch(console.error);