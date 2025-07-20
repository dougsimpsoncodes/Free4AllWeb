// Test the complete deal approval workflow with proper data parsing
async function testDealApprovalFixed() {
  console.log('Testing deal approval workflow with proper data parsing...\n');
  
  // Get the extracted deal from site 464 (Panda Express)
  const siteResponse = await fetch('http://localhost:5000/api/admin/discovery/sites/464', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const siteData = await siteResponse.json();
  console.log('Site data:', siteData.site.title);
  console.log('Deal extracted:', !!siteData.site.dealExtracted);
  
  if (siteData.site.dealExtracted) {
    const extractedDeal = JSON.parse(siteData.site.dealExtracted);
    console.log('Extracted deal details:');
    console.log(`  Title: ${extractedDeal.title}`);
    console.log(`  Offer: ${extractedDeal.offer}`);
    console.log(`  Trigger: ${extractedDeal.trigger}`);
    console.log(`  Value: ${extractedDeal.value}`);
    console.log(`  Instructions: ${extractedDeal.instructions}`);
    console.log(`  Terms: ${extractedDeal.terms}`);
    console.log(`  Image URL: ${extractedDeal.imageUrl}`);
    
    // Create deal page data using the correct field names
    const dealPageData = {
      title: extractedDeal.title,
      restaurant: siteData.site.restaurantDetected || 'Panda Express',
      description: extractedDeal.offer,
      triggerCondition: extractedDeal.trigger,
      dealValue: extractedDeal.value,
      promoCode: extractedDeal.promoCode || null,
      instructions: extractedDeal.instructions || 'Visit restaurant to redeem this offer',
      terms: extractedDeal.terms || 'Terms and conditions apply. Valid while supplies last.',
      imageUrl: extractedDeal.imageUrl || null,
      sourceUrl: siteData.site.url,
      isActive: true,
      teamId: 1, // LA Dodgers
      restaurantId: 1, // Panda Express
      slug: `panda-express-dodgers-win-deal-${Date.now()}`
    };
    
    console.log('\nCreating deal page with data:', dealPageData);
    
    // Approve and create deal page
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
        console.log(`Status: ${approvalResult.message}`);
        
        // Test accessing the deal page
        const dealPageResponse = await fetch(`http://localhost:5000/api/deal-pages/${approvalResult.dealPage.id}`, {
          headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
        });
        
        const dealPageData = await dealPageResponse.json();
        if (dealPageData.success) {
          console.log('✅ DEAL PAGE ACCESSIBLE!');
          console.log(`Deal: ${dealPageData.dealPage.title}`);
          console.log(`Restaurant: ${dealPageData.dealPage.restaurant}`);
          console.log(`Description: ${dealPageData.dealPage.description}`);
        }
        
      } else {
        console.log('❌ APPROVAL FAILED:', approvalResult.error);
      }
      
    } catch (error) {
      console.log('❌ ERROR:', error.message);
    }
  }
  
  console.log('\n🎯 Deal approval workflow test complete!');
}

// Run the test
testDealApprovalFixed().catch(console.error);