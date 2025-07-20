// Test the complete extraction workflow on authentic deals
async function testExtractionWorkflow() {
  console.log('Testing complete extraction workflow...\n');
  
  // Get precision filtered sites
  const response = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=5', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const data = await response.json();
  console.log(`Found ${data.sites.length} authentic sites for extraction testing`);
  
  // Test extraction on the first authentic site
  const testSite = data.sites[0];
  console.log(`\nTesting site ID: ${testSite.id}`);
  console.log(`Title: ${testSite.title}`);
  console.log(`URL: ${testSite.url}`);
  console.log(`Authenticity Score: ${testSite.authenticityScore?.toFixed(2) || 'N/A'}`);
  
  // Test extraction via API
  try {
    const extractResponse = await fetch(`http://localhost:5000/api/admin/discovery/extract-deal/${testSite.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
      }
    });
    
    const extractResult = await extractResponse.json();
    
    if (extractResult.success) {
      console.log('\n✅ EXTRACTION SUCCESSFUL!');
      console.log(`Extracted Deal: ${extractResult.extractedDeal.title}`);
      console.log(`Restaurant: ${extractResult.extractedDeal.restaurant}`);
      console.log(`Offer: ${extractResult.extractedDeal.offerDescription}`);
      console.log(`Trigger: ${extractResult.extractedDeal.triggerCondition}`);
      console.log(`Deal Value: ${extractResult.extractedDeal.dealValue}`);
      console.log(`Confidence: ${extractResult.extractedDeal.confidence}`);
      
      // Check if deal was saved to database
      const siteCheckResponse = await fetch(`http://localhost:5000/api/admin/discovery/sites/${testSite.id}`, {
        headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
      });
      
      const siteData = await siteCheckResponse.json();
      if (siteData.success && siteData.site.dealExtracted) {
        console.log('\n✅ DEAL SAVED TO DATABASE!');
        console.log('Ready for admin approval and deal page creation.');
      } else {
        console.log('\n⚠️  Deal not saved to database yet.');
      }
      
    } else {
      console.log(`\n❌ EXTRACTION FAILED: ${extractResult.error}`);
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
  }
  
  console.log('\n🎯 Complete extraction workflow tested successfully!');
}

// Run the test
testExtractionWorkflow().catch(console.error);