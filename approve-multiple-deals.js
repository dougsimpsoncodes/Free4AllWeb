// Approve multiple authentic deals and create deal pages
async function approveMultipleDeals() {
  console.log('Approving multiple authentic deals...\n');
  
  // Get precision filtered sites
  const response = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const data = await response.json();
  console.log(`Found ${data.sites.length} authentic sites for approval`);
  
  let approvedCount = 0;
  
  // Process sites that haven't been approved yet
  for (const site of data.sites.slice(1, 4)) { // Skip the first one (already approved), take next 3
    console.log(`\nProcessing site: ${site.title.substring(0, 80)}...`);
    
    // First extract deal if not already extracted
    if (!site.dealExtracted) {
      console.log('  Extracting deal...');
      try {
        const extractResponse = await fetch(`http://localhost:5000/api/admin/discovery/extract-deal/${site.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
          }
        });
        
        const extractResult = await extractResponse.json();
        if (!extractResult.success) {
          console.log('  ❌ Extraction failed, skipping');
          continue;
        }
        console.log('  ✅ Deal extracted successfully');
      } catch (error) {
        console.log('  ❌ Extraction error, skipping');
        continue;
      }
    }
    
    // Get the updated site data with extraction
    const siteResponse = await fetch(`http://localhost:5000/api/admin/discovery/sites/${site.id}`, {
      headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
    });
    
    const siteData = await siteResponse.json();
    
    if (siteData.site.dealExtracted) {
      const extractedDeal = JSON.parse(siteData.site.dealExtracted);
      
      // Create deal page data
      const dealPageData = {
        title: extractedDeal.title,
        restaurant: siteData.site.restaurantDetected || 'Panda Express',
        offerDescription: extractedDeal.offer,
        triggerCondition: extractedDeal.trigger,
        dealValue: extractedDeal.value,
        promoCode: extractedDeal.promoCode || null,
        instructions: extractedDeal.instructions || 'Visit restaurant to redeem this offer',
        terms: extractedDeal.terms || 'Terms and conditions apply. Valid while supplies last.',
        imageUrl: extractedDeal.imageUrl || null,
        sourceUrl: siteData.site.url,
        isActive: true,
        slug: `deal-${site.id}-${Date.now()}`
      };
      
      console.log(`  Creating deal page: ${dealPageData.title}`);
      
      try {
        const approvalResponse = await fetch('http://localhost:5000/api/admin/discovery/approve-and-create-deal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
          },
          body: JSON.stringify({
            siteId: site.id,
            dealPageData: dealPageData
          })
        });
        
        const approvalResult = await approvalResponse.json();
        
        if (approvalResult.success) {
          approvedCount++;
          console.log(`  ✅ Deal approved: /deal/${approvalResult.dealPage.slug}`);
          console.log(`     ${approvalResult.dealPage.restaurant}: ${approvalResult.dealPage.offerDescription}`);
        } else {
          console.log(`  ❌ Approval failed: ${approvalResult.error}`);
        }
        
      } catch (error) {
        console.log(`  ❌ Approval error: ${error.message}`);
      }
    }
  }
  
  // Final verification
  const finalResponse = await fetch('http://localhost:5000/api/deal-pages', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  
  const finalData = await finalResponse.json();
  
  console.log(`\n🎯 APPROVAL COMPLETE!`);
  console.log(`   Approved this session: ${approvedCount} deals`);
  console.log(`   Total deal pages: ${finalData.length}`);
  
  finalData.forEach((deal, index) => {
    console.log(`   ${index + 1}. ${deal.restaurant}: ${deal.offerDescription} (${deal.triggerCondition})`);
  });
}

// Run the approval
approveMultipleDeals().catch(console.error);