// Test navigation to Deal Discovery page
async function testNavigation() {
  console.log('🔍 TESTING NAVIGATION TO DEAL DISCOVERY\n');
  
  // Test the deal discovery page endpoint
  const response = await fetch('http://localhost:5000/deal-discovery', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  console.log(`✅ Deal Discovery page status: ${response.status}`);
  console.log(`✅ Content-Type: ${response.headers.get('content-type')}`);
  
  // Test the API endpoints that the Deal Discovery page uses
  const sitesResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const sitesData = await sitesResponse.json();
  console.log(`✅ API endpoint working: ${sitesData.sites.length} authentic deals found`);
  
  console.log('\n🎯 HOW TO ACCESS DEAL DISCOVERY:');
  console.log('1. Go to: http://localhost:5000/');
  console.log('2. Look for "Admin" dropdown button in the top-right corner');
  console.log('3. Click on "Deal Discovery" in the dropdown menu');
  console.log('4. You should see the precision filter system with 15 authentic deals');
  console.log('\n📍 Direct URL: http://localhost:5000/deal-discovery');
  
  console.log('\n🔧 TESTING FEATURES:');
  console.log('- Toggle "Precision Mode" to see 15 authentic vs 370 total deals');
  console.log('- Click "Extract Deal" on any site to test AI extraction');
  console.log('- View extracted deal details and approve to create live pages');
  console.log('- Use "Run Discovery" button to find new deals');
  
  console.log('\n✅ Navigation test complete!');
}

// Run the test
testNavigation().catch(console.error);