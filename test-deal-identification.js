// Complete deal identification system test
async function testDealIdentification() {
  console.log('🔍 TESTING DEAL IDENTIFICATION SYSTEM\n');
  
  // Step 1: Test Discovery Engine
  console.log('1. Testing Discovery Engine...');
  
  const discoveryResponse = await fetch('http://localhost:5000/api/admin/discovery/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
    }
  });
  
  const discoveryResult = await discoveryResponse.json();
  console.log(`   ✅ Discovery found ${discoveryResult.sitesFound || 0} sites`);
  
  // Step 2: Test Precision Filter
  console.log('\n2. Testing Precision Filter...');
  
  const precisionResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const precisionData = await precisionResponse.json();
  console.log(`   ✅ Precision filter identified ${precisionData.sites.length} authentic deals`);
  
  // Show top 3 authentic deals
  console.log('\n   Top 3 Authentic Deals:');
  precisionData.sites.slice(0, 3).forEach((site, index) => {
    console.log(`   ${index + 1}. ${site.title.substring(0, 60)}...`);
    console.log(`      Confidence: ${site.confidence} | Restaurant: ${site.restaurantDetected}`);
    console.log(`      URL: ${site.url.substring(0, 60)}...`);
  });
  
  // Step 3: Test AI Extraction
  console.log('\n3. Testing AI Extraction...');
  
  const testSite = precisionData.sites.find(site => !site.dealExtracted);
  if (testSite) {
    console.log(`   Testing extraction on: ${testSite.title.substring(0, 50)}...`);
    
    const extractResponse = await fetch(`http://localhost:5000/api/admin/discovery/extract-deal/${testSite.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
      }
    });
    
    const extractResult = await extractResponse.json();
    if (extractResult.success) {
      console.log(`   ✅ Extraction successful`);
      console.log(`      Title: ${extractResult.extracted.title}`);
      console.log(`      Offer: ${extractResult.extracted.offer}`);
      console.log(`      Trigger: ${extractResult.extracted.trigger}`);
      console.log(`      Value: ${extractResult.extracted.value}`);
      console.log(`      Confidence: ${extractResult.extracted.confidence}`);
    } else {
      console.log(`   ❌ Extraction failed: ${extractResult.error}`);
    }
  } else {
    console.log(`   ℹ️  All top deals already extracted`);
  }
  
  // Step 4: Test Deal Page Creation
  console.log('\n4. Testing Deal Page Creation...');
  
  const currentDealsResponse = await fetch('http://localhost:5000/api/deal-pages', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const currentDeals = await currentDealsResponse.json();
  console.log(`   ✅ Current live deal pages: ${currentDeals.length}`);
  
  currentDeals.forEach((deal, index) => {
    console.log(`   ${index + 1}. ${deal.restaurant}: ${deal.offerDescription}`);
    console.log(`      Trigger: ${deal.triggerCondition}`);
    console.log(`      Value: ${deal.dealValue}`);
    console.log(`      URL: /deal/${deal.slug}`);
  });
  
  // Step 5: Test System Statistics
  console.log('\n5. System Statistics...');
  
  const allSitesResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?limit=1000', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const allSites = await allSitesResponse.json();
  const extractedSites = allSites.sites.filter(site => site.dealExtracted);
  const approvedSites = allSites.sites.filter(site => site.status === 'approved');
  
  console.log(`   📊 Total sites discovered: ${allSites.sites.length}`);
  console.log(`   📊 Precision filtered (authentic): ${precisionData.sites.length}`);
  console.log(`   📊 Deals extracted: ${extractedSites.length}`);
  console.log(`   📊 Deals approved: ${approvedSites.length}`);
  console.log(`   📊 Live deal pages: ${currentDeals.length}`);
  
  const precisionReduction = ((allSites.sites.length - precisionData.sites.length) / allSites.sites.length * 100).toFixed(1);
  console.log(`   📊 Precision reduction: ${precisionReduction}% false positives eliminated`);
  
  console.log('\n🎯 DEAL IDENTIFICATION SYSTEM TEST COMPLETE!');
  console.log('\nYou can now:');
  console.log('1. Visit the admin panel to see discovered deals');
  console.log('2. Toggle precision mode to see authentic vs all deals');
  console.log('3. Extract deals from authentic sites');
  console.log('4. Approve deals to create live deal pages');
  console.log('5. View live deals on the user-facing website');
}

// Run the test
testDealIdentification().catch(console.error);