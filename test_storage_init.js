/**
 * Initialize evidence storage for testing
 */

import { initializeStorage } from './server/services/evidence/storage.js';

console.log('🔧 Initializing evidence storage for testing...');

try {
  await initializeStorage();
  console.log('✅ Evidence storage initialized successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to initialize storage:', error);
  process.exit(1);
}