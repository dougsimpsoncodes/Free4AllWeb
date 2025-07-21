#!/usr/bin/env node

/**
 * Simple Setup Validator - checks if services are configured
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Free4AllWeb Setup Validator\n');

// Read .env file
function readEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    });
    
    return env;
  } catch (error) {
    console.log('❌ No .env file found');
    return {};
  }
}

// Test configurations
function validateSetup() {
  const env = readEnvFile();
  const results = [];
  
  // Database check
  console.log('1. Database Configuration...');
  if (!env.DATABASE_URL || env.DATABASE_URL === 'your_neon_database_url_here') {
    console.log('   ❌ DATABASE_URL not configured');
    console.log('   📖 Get one at: https://console.neon.tech/');
    results.push({ service: 'Database', configured: false });
  } else {
    console.log('   ✅ DATABASE_URL configured');
    results.push({ service: 'Database', configured: true });
  }
  
  // Email check
  console.log('\n2. Email Service Configuration...');
  const emailVars = ['EMAIL_FROM', 'SMTP_USER', 'SMTP_PASS'];
  const emailMissing = emailVars.filter(v => 
    !env[v] || env[v].includes('your_') || env[v].includes('_here')
  );
  
  if (emailMissing.length > 0) {
    console.log(`   ❌ Email not configured: ${emailMissing.join(', ')}`);
    console.log('   📖 Get credentials at: https://www.mailersend.com/');
    results.push({ service: 'Email', configured: false });
  } else {
    console.log('   ✅ Email service configured');
    console.log(`   📧 Sender: ${env.EMAIL_FROM}`);
    results.push({ service: 'Email', configured: true });
  }
  
  // SMS check
  console.log('\n3. SMS Service Configuration...');
  const smsVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  const smsMissing = smsVars.filter(v => 
    !env[v] || env[v].includes('your_') || env[v].includes('_here')
  );
  
  if (smsMissing.length > 0) {
    console.log(`   ❌ SMS not configured: ${smsMissing.join(', ')}`);
    console.log('   📖 Get credentials at: https://www.twilio.com/');
    results.push({ service: 'SMS', configured: false });
  } else {
    console.log('   ✅ SMS service configured');
    console.log(`   📱 From: ${env.TWILIO_PHONE_NUMBER}`);
    results.push({ service: 'SMS', configured: true });
  }
  
  // Session secret check
  console.log('\n4. Session Security...');
  if (!env.SESSION_SECRET || env.SESSION_SECRET === 'random_session_secret_12345') {
    console.log('   ⚠️  Using default session secret (insecure for production)');
    results.push({ service: 'Security', configured: false });
  } else {
    console.log('   ✅ Custom session secret configured');
    results.push({ service: 'Security', configured: true });
  }
  
  return results;
}

// Main validation
function main() {
  const results = validateSetup();
  
  console.log('\n📊 Configuration Summary:');
  console.log('=========================');
  
  let configuredCount = 0;
  results.forEach(result => {
    const status = result.configured ? '✅' : '❌';
    console.log(`${status} ${result.service}`);
    if (result.configured) configuredCount++;
  });
  
  const readiness = Math.round((configuredCount / results.length) * 100);
  console.log(`\n🎯 System Readiness: ${readiness}%`);
  
  if (readiness === 100) {
    console.log('\n🚀 Ready for real-world testing!');
    console.log('Next steps:');
    console.log('1. npm run dev');
    console.log('2. Open http://localhost:3000');
    console.log('3. Test with live data');
  } else if (readiness >= 75) {
    console.log('\n⚠️  Almost ready! Configure remaining services for full functionality.');
  } else {
    console.log('\n❌ Please configure missing services before testing.');
    console.log('\n📚 Setup guides available:');
    console.log('- EMAIL_SETUP.md');
    console.log('- SMS_SETUP.md');
    console.log('- REAL_WORLD_TESTING_GUIDE.md');
  }
  
  if (readiness >= 75) {
    console.log('\n🧪 Manual Testing Checklist:');
    console.log('☐ Database connection works');
    console.log('☐ Email notifications deliver');
    console.log('☐ SMS alerts send (if configured)');
    console.log('☐ Deal discovery finds real deals');
    console.log('☐ User signup and alerts work');
    console.log('☐ Admin panel functions properly');
  }
}

main();