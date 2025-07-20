// Test API response format
async function testApiResponse() {
  console.log('🔍 TESTING API RESPONSE FORMAT\n');
  
  try {
    // Test precision mode endpoint
    const response = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=3');
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response structure:');
      console.log(`- success: ${data.success}`);
      console.log(`- sites array length: ${data.sites?.length || 0}`);
      
      if (data.sites && data.sites.length > 0) {
        console.log('\nFirst site structure:');
        const firstSite = data.sites[0];
        console.log(`- id: ${firstSite.id}`);
        console.log(`- title: ${firstSite.title?.substring(0, 50)}...`);
        console.log(`- confidence: ${firstSite.confidence}`);
        console.log(`- status: ${firstSite.status}`);
        console.log(`- restaurantDetected: ${firstSite.restaurantDetected}`);
      }
    } else {
      console.log('❌ API response failed');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test pending endpoint
  try {
    const pendingResponse = await fetch('http://localhost:5000/api/admin/discovery/pending?limit=3');
    console.log(`\nPending endpoint status: ${pendingResponse.status}`);
    
    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json();
      console.log(`- pending sites: ${pendingData.sites?.length || 0}`);
    }
  } catch (error) {
    console.log(`❌ Pending error: ${error.message}`);
  }
}

testApiResponse().catch(console.error);