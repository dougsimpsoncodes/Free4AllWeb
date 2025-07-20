// Complete workflow walkthrough: Discovery → Precision Filter → AI Extraction → Approval
async function walkthroughCompleteWorkflow() {
  console.log('🎯 COMPLETE DEAL DISCOVERY TO APPROVAL WALKTHROUGH\n');
  
  // STEP 1: Show current discovery status
  console.log('📊 STEP 1: DISCOVERY STATUS');
  const allSitesResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?limit=100', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  const allSites = await allSitesResponse.json();
  console.log(`   Total discovered sites: ${allSites.sites.length}`);
  
  // STEP 2: Apply precision filter
  console.log('\n🎯 STEP 2: PRECISION FILTER');
  const precisionResponse = await fetch('http://localhost:5000/api/admin/discovery/sites?precision=true&limit=20', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  const precisionData = await precisionResponse.json();
  const reductionRate = ((allSites.sites.length - precisionData.sites.length) / allSites.sites.length * 100).toFixed(1);
  console.log(`   Authentic deals identified: ${precisionData.sites.length}`);
  console.log(`   False positive reduction: ${reductionRate}%`);
  
  // Show top authentic deals
  console.log('\n   TOP 3 AUTHENTIC DEALS:');
  precisionData.sites.slice(0, 3).forEach((site, index) => {
    console.log(`   ${index + 1}. ${site.title.substring(0, 60)}...`);
    console.log(`      Confidence: ${site.confidence} | Status: ${site.status}`);
    console.log(`      Restaurant: ${site.restaurantDetected || 'Unknown'}`);
    console.log(`      URL: ${site.url.substring(0, 60)}...`);
  });
  
  // STEP 3: Find an unextracted deal to demonstrate extraction
  console.log('\n🤖 STEP 3: AI EXTRACTION DEMO');
  const unextractedSite = precisionData.sites.find(site => !site.dealExtracted && site.confidence > 0.7);
  
  if (unextractedSite) {
    console.log(`   Selected site for extraction:`);
    console.log(`   Title: ${unextractedSite.title}`);
    console.log(`   Confidence: ${unextractedSite.confidence}`);
    console.log(`   URL: ${unextractedSite.url}`);
    
    try {
      const extractResponse = await fetch(`http://localhost:5000/api/admin/discovery/extract/${unextractedSite.id}`, {
        method: 'POST',
        headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
      });
      
      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        console.log(`   ✅ EXTRACTION SUCCESSFUL!`);
        console.log(`   📝 Deal Title: ${extractData.deal?.title || 'N/A'}`);
        console.log(`   🍽️ Restaurant: ${extractData.deal?.restaurant || 'N/A'}`);
        console.log(`   💰 Offer: ${extractData.deal?.offer || 'N/A'}`);
        console.log(`   🎯 Trigger: ${extractData.deal?.triggerCondition || 'N/A'}`);
        console.log(`   💵 Value: ${extractData.deal?.dealValue || 'N/A'}`);
      } else {
        console.log(`   ⚠️ Extraction failed: ${extractResponse.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Extraction error: ${error.message}`);
    }
  } else {
    console.log(`   All high-confidence deals already extracted!`);
  }
  
  // STEP 4: Show pending sites for approval
  console.log('\n⏳ STEP 4: PENDING APPROVAL QUEUE');
  const pendingResponse = await fetch('http://localhost:5000/api/admin/discovery/pending?limit=10', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  const pendingData = await pendingResponse.json();
  console.log(`   Sites pending approval: ${pendingData.sites.length}`);
  
  if (pendingData.sites.length > 0) {
    console.log('\n   PENDING SITES READY FOR APPROVAL:');
    pendingData.sites.slice(0, 3).forEach((site, index) => {
      console.log(`   ${index + 1}. ${site.title.substring(0, 50)}...`);
      console.log(`      Confidence: ${site.confidence} | ID: ${site.id}`);
      console.log(`      Restaurant: ${site.restaurantDetected || 'Unknown'}`);
    });
  }
  
  // STEP 5: Show approved deals and live pages
  console.log('\n✅ STEP 5: APPROVED DEALS & LIVE PAGES');
  const approvedSites = allSites.sites.filter(site => site.status === 'approved');
  console.log(`   Approved deals: ${approvedSites.length}`);
  
  // Check live deal pages
  const dealPagesResponse = await fetch('http://localhost:5000/api/deal-pages', {
    headers: { 'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E' }
  });
  const dealPages = await dealPagesResponse.json();
  console.log(`   Live deal pages: ${dealPages.length}`);
  
  if (dealPages.length > 0) {
    console.log('\n   LIVE DEAL PAGES:');
    dealPages.slice(0, 3).forEach((deal, index) => {
      console.log(`   ${index + 1}. ${deal.title}`);
      console.log(`      Restaurant: ${deal.restaurant} | Value: ${deal.dealValue || 'N/A'}`);
      console.log(`      URL: /deal/${deal.slug}`);
    });
  }
  
  console.log('\n🎯 COMPLETE WORKFLOW SUMMARY:');
  console.log(`   1. Discovery: ${allSites.sites.length} sites found`);
  console.log(`   2. Precision Filter: ${precisionData.sites.length} authentic deals (${reductionRate}% reduction)`);
  console.log(`   3. AI Extraction: ${precisionData.sites.filter(s => s.dealExtracted).length} deals extracted`);
  console.log(`   4. Pending Approval: ${pendingData.sites.length} sites waiting`);
  console.log(`   5. Live Pages: ${dealPages.length} deal pages accessible to users`);
  
  console.log('\n📱 USER INTERFACE STEPS:');
  console.log('   1. Go to /deal-discovery');
  console.log('   2. Toggle "Precision Mode ON" to see authentic deals');
  console.log('   3. Click "Extract Deal" on unextracted sites');
  console.log('   4. Review extracted details in popup');
  console.log('   5. Click "Approve" to create live deal page');
  console.log('   6. View live deals on homepage');
}

// Run the complete walkthrough
walkthroughCompleteWorkflow().catch(console.error);