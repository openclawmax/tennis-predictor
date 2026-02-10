/**
 * Initialize Database Script
 */

import db from '../src/db/database.js';

async function main() {
  console.log('Initializing Tennis Set Predictor database...');
  await db.initDb();
  console.log('Database initialized successfully!');
  db.closeDb();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
