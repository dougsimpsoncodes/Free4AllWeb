// Comprehensive extraction test for all discovered deal types
const testUrls = [
  // News articles (known to work)
  'https://www.sbsun.com/2025/04/02/2025-dodger-deals-free-food-and-discounts-for-fans-when-the-dodgers-win/',
  'https://dodgersnation.com/dodgers-food-deals-everything-fans-can-get-after-a-dodgers-win-or-standout-performance/2025/05/08/',
  
  // Social media posts
  'https://x.com/JackBox/status/1918289369653297425',
  'https://www.reddit.com/r/Dodgers/comments/1cm5tmp/panda_express_5_plate_coupon_code/',
  
  // Official restaurant social media
  'https://x.com/pandaexpress',
  'https://twitter.com/PandaExpress'
];

async function testExtractionSystem() {
  console.log('Testing extraction system with comprehensive URL list...\n');
  
  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    
    try {
      const response = await fetch('http://localhost:5000/api/admin/discovery/test-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'connect.sid=s%3AOx6a0iE1zAPyB8ZLuWdnTMhB4r5nF56p.72e6TjQQ9YSLEhTaG9xwBuEGsaE9oCh3E8dO1gTBR4E'
        },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ SUCCESS: ${result.extractedDeal.title} (${result.extractedDeal.confidence} confidence)`);
        console.log(`   Offer: ${result.extractedDeal.offerDescription}`);
        console.log(`   Trigger: ${result.extractedDeal.triggerCondition}`);
        console.log(`   Value: ${result.extractedDeal.dealValue}`);
        if (result.extractedDeal.promoCode) {
          console.log(`   Code: ${result.extractedDeal.promoCode}`);
        }
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('Testing complete!\n');
}

// Run the test
testExtractionSystem();