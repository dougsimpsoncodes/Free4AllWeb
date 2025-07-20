// Test the deal extraction engine directly
const { dealExtractionEngine } = require('./server/services/dealExtractionEngine.js');

async function testPandaExtraction() {
  try {
    console.log('Testing Panda Express deal extraction...');
    const result = await dealExtractionEngine.extractDealFromUrl('https://www.pandaexpress.com/promo/dodgerswin');
    console.log('Extraction result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error during extraction:', error);
  } finally {
    await dealExtractionEngine.closeBrowser();
  }
}

testPandaExtraction();