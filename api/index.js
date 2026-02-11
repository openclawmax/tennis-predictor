/**
 * Vercel Serverless Function - API Handler
 */

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Tennis Predictor API is running on Vercel'
  });
});

// Placeholder for other endpoints (will be added incrementally)
app.all('/api/*', (req, res) => {
  res.status(501).json({ 
    error: 'This endpoint is being migrated to serverless',
    path: req.path 
  });
});

// Export for Vercel serverless
export default app;
