#!/usr/bin/env node

/**
 * Deal Discovery System Test Script
 * This script will:
 * 1. Clear existing discovered deals
 * 2. Run fresh discovery
 * 3. Display results for review
 */

const readline = require('readline');
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5001';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = { 
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  return response.json();
}

async function getCurrentDeals() {
  const result = await apiCall('/api/admin/discovery/sites');
  return result.sites || [];
}

async function clearDatabase() {
  console.log(`\n${colors.yellow}⚠️  WARNING: This will delete all discovered deals from the database${colors.reset}`);
  const confirm = await question('Are you sure you want to proceed? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Operation cancelled');
    return false;
  }
  
  // Since we don't have a direct delete endpoint, we'll need to create one
  // For now, we'll document what needs to be done
  console.log(`\n${colors.red}📝 To clear the database, run this SQL command:${colors.reset}`);
  console.log(`${colors.cyan}DELETE FROM discovered_sites;${colors.reset}`);
  console.log(`${colors.cyan}ALTER SEQUENCE discovered_sites_id_seq RESTART WITH 1;${colors.reset}\n`);
  
  const manualConfirm = await question('Have you manually cleared the database? (yes/no): ');
  return manualConfirm.toLowerCase() === 'yes';
}

async function runDiscovery() {
  console.log(`\n${colors.blue}🔍 Starting Deal Discovery...${colors.reset}`);
  console.log('This will search Reddit, Google, and News APIs for deals\n');
  
  try {
    const result = await apiCall('/api/admin/discovery/run', 'POST');
    
    if (result.success) {
      console.log(`${colors.green}✅ Discovery completed successfully!${colors.reset}`);
      console.log(`Found ${result.sitesDiscovered || 0} new deals\n`);
      
      if (result.summary) {
        console.log(`${colors.bold}Discovery Summary:${colors.reset}`);
        console.log(`• Reddit: ${result.summary.bySource?.reddit || 0} deals`);
        console.log(`• Google: ${result.summary.bySource?.google || 0} deals`);
        console.log(`• News: ${result.summary.bySource?.news || 0} deals`);
        console.log(`• Average Confidence: ${(result.summary.avgConfidence * 100).toFixed(1)}%`);
      }
      
      return result.sitesDiscovered || 0;
    } else {
      console.log(`${colors.red}❌ Discovery failed: ${result.error || 'Unknown error'}${colors.reset}`);
      return 0;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error running discovery: ${error.message}${colors.reset}`);
    return 0;
  }
}

async function displayDeals(deals) {
  console.log(`\n${colors.bold}📊 Discovered Deals Review${colors.reset}`);
  console.log(`Total deals found: ${deals.length}\n`);
  
  // Group by confidence level
  const highConfidence = deals.filter(d => parseFloat(d.confidence) >= 0.6);
  const mediumConfidence = deals.filter(d => parseFloat(d.confidence) >= 0.4 && parseFloat(d.confidence) < 0.6);
  const lowConfidence = deals.filter(d => parseFloat(d.confidence) < 0.4);
  
  console.log(`${colors.green}High Confidence (≥60%): ${highConfidence.length} deals${colors.reset}`);
  console.log(`${colors.yellow}Medium Confidence (40-59%): ${mediumConfidence.length} deals${colors.reset}`);
  console.log(`${colors.red}Low Confidence (<40%): ${lowConfidence.length} deals${colors.reset}\n`);
  
  // Display top deals
  const topDeals = deals
    .sort((a, b) => parseFloat(b.confidence) - parseFloat(a.confidence))
    .slice(0, 10);
  
  console.log(`${colors.bold}Top 10 Deals by Confidence:${colors.reset}`);
  console.log('─'.repeat(80));
  
  topDeals.forEach((deal, index) => {
    const confidence = parseFloat(deal.confidence);
    const confColor = confidence >= 0.6 ? colors.green : confidence >= 0.4 ? colors.yellow : colors.red;
    
    console.log(`\n${colors.bold}#${index + 1}${colors.reset} [${confColor}${(confidence * 100).toFixed(1)}%${colors.reset}] ${deal.title}`);
    console.log(`   ${colors.cyan}URL:${colors.reset} ${deal.url}`);
    console.log(`   ${colors.cyan}Content:${colors.reset} ${deal.content.substring(0, 150)}...`);
    
    if (deal.restaurantDetected || deal.teamDetected) {
      console.log(`   ${colors.magenta}Detected:${colors.reset} ${[deal.restaurantDetected, deal.teamDetected].filter(Boolean).join(' | ')}`);
    }
  });
}

async function monitorContinuous() {
  console.log(`\n${colors.cyan}📡 Starting continuous monitoring...${colors.reset}`);
  console.log('The system will check for new deals every 15 minutes');
  console.log('Press Ctrl+C to stop monitoring\n');
  
  let iteration = 1;
  
  const monitor = async () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n${colors.bold}[${timestamp}] Check #${iteration}${colors.reset}`);
    
    const beforeCount = (await getCurrentDeals()).length;
    await runDiscovery();
    const afterCount = (await getCurrentDeals()).length;
    
    const newDeals = afterCount - beforeCount;
    if (newDeals > 0) {
      console.log(`${colors.green}🎉 Found ${newDeals} new deals!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}No new deals found in this iteration${colors.reset}`);
    }
    
    iteration++;
  };
  
  // Run immediately
  await monitor();
  
  // Then run every 15 minutes
  setInterval(monitor, 15 * 60 * 1000);
}

async function main() {
  console.log(`${colors.bold}${colors.blue}
╔════════════════════════════════════════════╗
║     Free4All Deal Discovery Test Suite     ║
╚════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`${colors.cyan}Current System Status:${colors.reset}`);
  
  // Check current state
  const currentDeals = await getCurrentDeals();
  console.log(`• Existing deals in database: ${currentDeals.length}`);
  
  // Present options
  console.log(`\n${colors.bold}Select an option:${colors.reset}`);
  console.log('1. Clear database and run fresh discovery');
  console.log('2. Run discovery (add to existing deals)');
  console.log('3. View current deals');
  console.log('4. Start continuous monitoring');
  console.log('5. Exit');
  
  const choice = await question('\nEnter your choice (1-5): ');
  
  switch(choice) {
    case '1':
      const cleared = await clearDatabase();
      if (cleared) {
        await runDiscovery();
        const newDeals = await getCurrentDeals();
        await displayDeals(newDeals);
      }
      break;
      
    case '2':
      await runDiscovery();
      const allDeals = await getCurrentDeals();
      await displayDeals(allDeals);
      break;
      
    case '3':
      await displayDeals(currentDeals);
      break;
      
    case '4':
      await monitorContinuous();
      break;
      
    case '5':
      console.log('Goodbye!');
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log('Invalid choice');
  }
  
  // Ask if user wants to continue
  const continue_ = await question('\nWould you like to perform another action? (yes/no): ');
  if (continue_.toLowerCase() === 'yes') {
    await main();
  } else {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Stopping...${colors.reset}`);
  rl.close();
  process.exit(0);
});

// Start the script
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  rl.close();
  process.exit(1);
});