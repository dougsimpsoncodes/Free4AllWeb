// Test extraction on the 10 authentic deals discovered by precision filter
async function testAuthenticDealExtraction() {
  console.log('🎯 Testing AI extraction on authentic Dodgers deals...\n');
  
  // First, get the precision filtered deals
  const precisionResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const precisionData = await precisionResponse.json();
  const authenticDeals = precisionData.sites || [];
  
  console.log(`Found ${authenticDeals.length} authentic deals for extraction testing\n`);
  
  // Test extraction on each authentic deal
  let successCount = 0;
  let totalCount = 0;
  
  for (const deal of authenticDeals.slice(0, 5)) { // Test top 5 deals
    totalCount++;
    console.log(`${totalCount}. Testing: ${deal.title}`);
    console.log(`   URL: ${deal.url}`);
    console.log(`   Authenticity Score: ${deal.authenticityScore?.toFixed(2) || 'N/A'}`);
    
    try {
      const extractResponse = await fetch('http://localhost:5000/api/admin/discovery/test-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
        },
        body: JSON.stringify({ url: deal.url })
      });
      
      const extractResult = await extractResponse.json();
      
      if (extractResult.success) {
        successCount++;
        console.log(`   ✅ EXTRACTION SUCCESS!`);
        console.log(`      Title: ${extractResult.extractedDeal.title}`);
        console.log(`      Restaurant: ${extractResult.extractedDeal.restaurant}`);
        console.log(`      Offer: ${extractResult.extractedDeal.offerDescription}`);
        console.log(`      Trigger: ${extractResult.extractedDeal.triggerCondition}`);
        console.log(`      Value: ${extractResult.extractedDeal.dealValue}`);
        if (extractResult.extractedDeal.promoCode) {
          console.log(`      Promo Code: ${extractResult.extractedDeal.promoCode}`);
        }
        console.log(`      Confidence: ${extractResult.extractedDeal.confidence}`);
      } else {
        console.log(`   ❌ EXTRACTION FAILED: ${extractResult.error}`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
  
  const successRate = ((successCount / totalCount) * 100).toFixed(1);
  console.log(`\n📊 EXTRACTION RESULTS:`);
  console.log(`   Success Rate: ${successRate}% (${successCount}/${totalCount})`);
  console.log(`   Authentic deals discovered: ${authenticDeals.length}`);
  console.log(`   Production-ready extraction: ${successCount} deals with full details`);
  
  if (successCount > 0) {
    console.log(`\n🎉 SUCCESS: AI extraction working on authentic Dodgers deals!`);
    console.log(`   Ready for admin approval and deal page creation.`);
  } else {
    console.log(`\n⚠️  No successful extractions. May need to adjust extraction patterns.`);
  }
}

// Run the test
testAuthenticDealExtraction().catch(console.error);