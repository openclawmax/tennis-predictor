/**
 * Tennis Set Predictor - Main Entry Point
 */

import { startServer } from './api/server.js';

const PORT = process.env.PORT || 3001;

startServer(PORT).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
