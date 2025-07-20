// Test the complete deal approval and deal page creation workflow
async function testDealApproval() {
  console.log('Testing deal approval and page creation workflow...\n');
  
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
    console.log(`  Restaurant: ${extractedDeal.restaurant}`);
    console.log(`  Offer: ${extractedDeal.offerDescription}`);
    console.log(`  Trigger: ${extractedDeal.triggerCondition}`);
    console.log(`  Value: ${extractedDeal.dealValue}`);
    
    // Create deal page data
    const dealPageData = {
      title: extractedDeal.title,
      restaurant: extractedDeal.restaurant,
      description: extractedDeal.offerDescription,
      triggerCondition: extractedDeal.triggerCondition,
      dealValue: extractedDeal.dealValue,
      promoCode: extractedDeal.promoCode || null,
      instructions: extractedDeal.instructions || 'Visit restaurant to redeem this offer',
      terms: extractedDeal.terms || 'Terms and conditions apply. Valid while supplies last.',
      imageUrl: extractedDeal.imageUrl || null,
      sourceUrl: extractedDeal.sourceUrl,
      isActive: true,
      teamId: 1, // LA Dodgers
      restaurantId: 1, // Panda Express
      slug: `panda-express-dodgers-win-deal-${Date.now()}`
    };
    
    console.log('\nCreating deal page...');
    
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
testDealApproval().catch(console.error);