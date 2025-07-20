// Test precision filter to reduce 332 discovered sites to authentic deals
async function testPrecisionFilter() {
  console.log('Testing precision filter system...\n');
  
  // Test regular discovery (all sites)
  console.log('1. Testing regular discovery (all sites):');
  const regularResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  const regularData = await regularResponse.json();
  console.log(`   Found ${regularData.count} sites (showing top 10)`);
  
  // Test precision filter (authentic deals only)
  console.log('\n2. Testing precision filter (authentic deals only):');
  const precisionResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  const precisionData = await precisionResponse.json();
  console.log(`   Found ${precisionData.count} authentic deals`);
  
  // Show the top authentic deals
  console.log('\n3. Top authentic deals:');
  if (precisionData.sites && precisionData.sites.length > 0) {
    precisionData.sites.slice(0, 5).forEach((site, index) => {
      console.log(`   ${index + 1}. ${site.title}`);
      console.log(`      URL: ${site.url}`);
      console.log(`      Authenticity Score: ${site.authenticityScore?.toFixed(2) || 'N/A'}`);
      console.log(`      Source Trust: ${site.trustScore?.toFixed(2) || 'N/A'}`);
      console.log(`      Deal Score: ${site.dealScore?.toFixed(2) || 'N/A'}`);
      console.log('');
    });
  }
  
  console.log(`\n🎯 Result: Reduced from 332 sites to ${precisionData.count} authentic deals!`);
}

// Run the test
testPrecisionFilter().catch(console.error);