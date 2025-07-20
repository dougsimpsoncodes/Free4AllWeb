// Debug frontend authentication and data loading
async function debugFrontendAuth() {
  console.log('🔍 DEBUGGING FRONTEND AUTHENTICATION & DATA LOADING\n');
  
  // Test if auth endpoint works
  try {
    const authResponse = await fetch('http://localhost:5000/api/auth/user');
    console.log(`📊 AUTH ENDPOINT:`);
    console.log(`   Status: ${authResponse.status}`);
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log(`   User authenticated: ${!!authData.id}`);
      console.log(`   User ID: ${authData.id || 'N/A'}`);
    } else {
      console.log(`   Authentication failed: ${authResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ AUTH ERROR: ${error.message}`);
  }
  
  console.log('\n🔧 DIAGNOSIS:');
  console.log('The issue is likely that the frontend React app is not sending');
  console.log('authentication cookies with its API requests, causing the server');
  console.log('to return empty results instead of the authenticated data.');
  
  console.log('\n💡 SOLUTION:');
  console.log('The queryClient needs to be configured to send cookies with');
  console.log('credentials: "include" for all API requests.');
  
  console.log('\n🎯 EXPECTED FIX:');
  console.log('After fixing credentials, you should see:');
  console.log('- Authentic Deals: 15 (not 0)');
  console.log('- Pending Review: 10 (not 0)');
  console.log('- Site cards with deal details displayed');
}

// Run the debug
debugFrontendAuth().catch(console.error);