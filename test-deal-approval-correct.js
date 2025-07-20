// Test deal approval with correct field mapping
async function testDealApprovalCorrect() {
  console.log('Testing deal approval with correct field mapping...\n');
  
  // Get the extracted deal from site 464
  const siteResponse = await fetch('http://localhost:5000/api/admin/discovery/sites/464', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const siteData = await siteResponse.json();
  const extractedDeal = JSON.parse(siteData.site.dealExtracted);
  
  console.log('Creating deal page with correct field mapping...');
  
  // Use correct field names matching schema
  const dealPageData = {
    title: extractedDeal.title,
    restaurant: siteData.site.restaurantDetected || 'Panda Express',
    offerDescription: extractedDeal.offer, // Correct field name
    triggerCondition: extractedDeal.trigger,
    dealValue: extractedDeal.value,
    promoCode: extractedDeal.promoCode || null,
    instructions: extractedDeal.instructions || 'Visit restaurant to redeem this offer',
    terms: extractedDeal.terms || 'Terms and conditions apply. Valid while supplies last.',
    imageUrl: extractedDeal.imageUrl || null,
    sourceUrl: siteData.site.url,
    isActive: true,
    slug: `panda-express-dodgers-win-deal-${Date.now()}`
  };
  
  console.log('Deal page data:', dealPageData);
  
  try {
    const approvalResponse = await fetch('http://localhost:5000/api/admin/discovery/approve-and-create-deal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
      },
      body: JSON.stringify({
        siteId: 464,
        dealPageData: dealPageData
      })
    });
    
    const approvalResult = await approvalResponse.json();
    
    if (approvalResult.success) {
      console.log('✅ DEAL APPROVED AND PAGE CREATED!');
      console.log(`Deal page URL: /deal/${approvalResult.dealPage.slug}`);
      console.log(`Deal page ID: ${approvalResult.dealPage.id}`);
      console.log(`Title: ${approvalResult.dealPage.title}`);
      console.log(`Restaurant: ${approvalResult.dealPage.restaurant}`);
      console.log(`Offer: ${approvalResult.dealPage.offerDescription}`);
      console.log(`Trigger: ${approvalResult.dealPage.triggerCondition}`);
      console.log(`Value: ${approvalResult.dealPage.dealValue}`);
      
      // Verify the deal page was created
      const dealPagesResponse = await fetch('http://localhost:5000/api/deal-pages', {
        headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
      });
      
      const dealPagesData = await dealPagesResponse.json();
      console.log(`\n✅ VERIFICATION: ${dealPagesData.length} deal pages now exist`);
      
    } else {
      console.log('❌ APPROVAL FAILED:', approvalResult.error);
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  
  console.log('\n🎯 Deal approval workflow complete!');
}

// Run the test
testDealApprovalCorrect().catch(console.error);