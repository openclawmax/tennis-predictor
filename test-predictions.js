/**
 * Manual test runner for predictions
 */

import { checkAndSendPredictions } from './telegram-predictions.js';

console.log('Running prediction check...\n');

checkAndSendPredictions()
  .then(result => {
    console.log('\n✅ Prediction check complete');
    console.log(`Sent: ${result.sent} predictions`);
    console.log(`Tracked: ${result.tracked} matches`);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
