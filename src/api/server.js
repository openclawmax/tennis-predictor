/**
 * Tennis Set Predictor API Server
 */

import express from 'express';
import cors from 'cors';
import db from '../db/database.js';
import TennisPredictor from '../models/predictor.js';
import Backtester from '../backtest/backtester.js';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize predictors
const atpPredictor = new TennisPredictor('ATP');
const wtaPredictor = new TennisPredictor('WTA');

// =============================================
// HEALTH CHECK
// =============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =============================================
// PLAYERS
// =============================================

app.get('/api/:tour/players', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const players = db.getAllPlayers(tour);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:tour/players/:playerId', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const predictor = tour === 'ATP' ? atpPredictor : wtaPredictor;
    
    const player = db.getPlayer(tour, req.params.playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const info = predictor.getPlayerInfo(req.params.playerId);
    res.json({ ...player, ...info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// MATCHES
// =============================================

app.get('/api/:tour/matches', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const { start, end, surface, limit = 100 } = req.query;
    
    let matches;
    if (start && end) {
      matches = db.getMatchesByDateRange(tour, start, end);
    } else if (surface) {
      matches = db.getMatchesBySurface(tour, surface, parseInt(limit));
    } else {
      matches = db.getMatchesByDateRange(tour, '2020-01-01', '2030-12-31').slice(0, parseInt(limit));
    }
    
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:tour/matches/:matchId', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const match = db.getMatch(tour, req.params.matchId);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    const odds = db.getOddsForMatch(tour, req.params.matchId);
    res.json({ ...match, odds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:tour/h2h/:player1Id/:player2Id', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const matches = db.getHeadToHead(tour, req.params.player1Id, req.params.player2Id);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// PREDICTIONS
// =============================================

app.post('/api/:tour/predict', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const predictor = tour === 'ATP' ? atpPredictor : wtaPredictor;
    
    const { match, marketOdds } = req.body;
    
    if (!match || !match.player1_id || !match.player2_id) {
      return res.status(400).json({ error: 'Match must include player1_id and player2_id' });
    }
    
    // Default surface if not provided
    if (!match.surface) match.surface = 'Hard';
    if (!match.best_of) match.best_of = 3;
    
    const prediction = predictor.predict(match, marketOdds);
    
    // Format response for UI
    const response = {
      prediction,
      summary: {
        player1WinProb: (prediction.pMatch * 100).toFixed(1) + '%',
        player1Set1Prob: (prediction.pSet1 * 100).toFixed(1) + '%',
        player2WinProb: ((1 - prediction.pMatch) * 100).toFixed(1) + '%',
        player2Set1Prob: ((1 - prediction.pSet1) * 100).toFixed(1) + '%',
        confidenceBand: {
          match: `${(prediction.pMatchLower * 100).toFixed(1)}% - ${(prediction.pMatchUpper * 100).toFixed(1)}%`,
          set1: `${(prediction.pSet1Lower * 100).toFixed(1)}% - ${(prediction.pSet1Upper * 100).toFixed(1)}%`
        }
      },
      fairOdds: {
        player1Match: prediction.fairOddsP1Match.toFixed(2),
        player2Match: prediction.fairOddsP2Match.toFixed(2),
        player1Set1: prediction.fairOddsP1Set1.toFixed(2),
        player2Set1: prediction.fairOddsP2Set1.toFixed(2)
      }
    };
    
    // Add bet recommendation if odds provided
    if (prediction.decision) {
      response.recommendation = {
        action: prediction.decision.action,
        side: prediction.decision.side,
        edge: prediction.decision.edge ? (prediction.decision.edge * 100).toFixed(2) + '%' : null,
        suggestedStake: prediction.decision.betSize ? (prediction.decision.betSize * 100).toFixed(2) + '% of bankroll' : null,
        why: prediction.explanation
      };
    }
    
    res.json(response);
  } catch (err) {
    console.error('Prediction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// RATINGS / LEADERBOARD
// =============================================

app.get('/api/:tour/ratings', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const predictor = tour === 'ATP' ? atpPredictor : wtaPredictor;
    const { surface = 'global', limit = 50 } = req.query;
    
    const topPlayers = predictor.eloEngine.getTopPlayers(surface, parseInt(limit));
    
    // Enrich with player names
    const enriched = topPlayers.map(p => {
      const player = db.getPlayer(tour, p.playerId);
      return {
        ...p,
        name: player?.name || p.playerId,
        country: player?.country
      };
    });
    
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// BACKTEST
// =============================================

app.post('/api/:tour/backtest', async (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const { startDate, endDate, options = {} } = req.body;
    
    // Get matches in date range
    const matches = db.getMatchesByDateRange(tour, startDate, endDate);
    
    if (matches.length === 0) {
      return res.status(400).json({ error: 'No matches found in date range' });
    }
    
    // Create fresh predictor for backtesting (to avoid data leakage)
    const btPredictor = new TennisPredictor(tour);
    
    // Prediction function that uses only historical data
    const predictFn = (match, historicalMatches) => {
      // Re-train on historical data only (expensive but correct)
      btPredictor.eloEngine.processMatches(historicalMatches);
      btPredictor.pointModel.processMatches(historicalMatches);
      
      return btPredictor.predict(match, null);
    };
    
    // Run backtest
    const backtester = new Backtester(options);
    const report = await backtester.runWalkForward(matches, predictFn, (m) => {
      const odds = db.getOddsForMatch(tour, m.match_id);
      return odds || {};
    });
    
    res.json(report);
  } catch (err) {
    console.error('Backtest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// MODEL TRAINING
// =============================================

app.post('/api/:tour/train', async (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const predictor = tour === 'ATP' ? atpPredictor : wtaPredictor;
    
    // Get all matches
    const matches = db.getMatchesByDateRange(tour, '2010-01-01', '2030-12-31');
    
    if (matches.length === 0) {
      return res.status(400).json({ error: 'No matches found for training' });
    }
    
    // Train
    await predictor.train(matches);
    
    res.json({ 
      success: true, 
      matchesTrained: matches.length,
      calibrated: predictor.calibrator.calibrated
    });
  } catch (err) {
    console.error('Training error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// DATA MANAGEMENT (for sample data)
// =============================================

app.post('/api/:tour/players', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const player = req.body;
    
    if (!player.player_id || !player.name) {
      return res.status(400).json({ error: 'player_id and name required' });
    }
    
    db.upsertPlayer(tour, player);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:tour/matches', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const match = req.body;
    
    if (!match.match_id) {
      return res.status(400).json({ error: 'match_id required' });
    }
    
    db.insertMatch(tour, match);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:tour/odds', (req, res) => {
  try {
    const tour = req.params.tour.toUpperCase();
    const odds = req.body;
    
    if (!odds.match_id) {
      return res.status(400).json({ error: 'match_id required' });
    }
    
    db.insertOdds(tour, odds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// LIVE ODDS UPDATE
// =============================================

import OddsFetcher from './odds-fetcher.js';

let oddsFetcher = null;

app.post('/api/odds/configure', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    oddsFetcher = new OddsFetcher(apiKey);
    res.json({ success: true, message: 'Odds API configured' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/odds/update', async (req, res) => {
  try {
    if (!oddsFetcher) {
      return res.status(400).json({ 
        error: 'Odds API not configured. Please configure API key first.',
        configured: false
      });
    }

    console.log('Fetching latest matches from The Odds API...');
    
    // Fetch ATP and WTA matches
    const [atpMatches, wtaMatches] = await Promise.all([
      oddsFetcher.fetchTennisMatches(),
      oddsFetcher.fetchWTAMatches()
    ]);

    // Parse and store matches
    const parsedATP = oddsFetcher.parseMatches(atpMatches, 'atp');
    const parsedWTA = oddsFetcher.parseMatches(wtaMatches, 'wta');

    // Store in database
    let atpStored = 0, wtaStored = 0;

    for (const match of parsedATP) {
      try {
        if (!match.player1_name || !match.player2_name) {
          console.warn('Skipping match with missing player names:', match);
          continue;
        }
        
        // Create or get players
        const p1Id = `atp_${match.player1_name.toLowerCase().replace(/\s+/g, '_')}`;
        const p2Id = `atp_${match.player2_name.toLowerCase().replace(/\s+/g, '_')}`;
        
        db.upsertPlayer('ATP', { 
          player_id: p1Id, 
          name: match.player1_name 
        });
        db.upsertPlayer('ATP', { 
          player_id: p2Id, 
          name: match.player2_name 
        });

        // Store match
        const matchId = `atp_${match.id}`;
        db.insertMatch('ATP', {
          match_id: matchId,
          player1_id: p1Id,
          player2_id: p2Id,
          date: match.commence_time,
          surface: match.surface,
          best_of: match.best_of,
          tournament: 'Upcoming'
        });

        // Store odds
        if (match.ml_p1 && match.ml_p2) {
          db.insertOdds('ATP', {
            match_id: matchId,
            bookmaker: match.bookmaker,
            ml_p1: match.ml_p1,
            ml_p2: match.ml_p2,
            timestamp: new Date().toISOString()
          });
        }

        atpStored++;
      } catch (err) {
        console.warn('Error storing ATP match:', err.message);
      }
    }

    for (const match of parsedWTA) {
      try {
        const p1Id = `wta_${match.player1_name.toLowerCase().replace(/\s+/g, '_')}`;
        const p2Id = `wta_${match.player2_name.toLowerCase().replace(/\s+/g, '_')}`;
        
        db.upsertPlayer('WTA', { 
          player_id: p1Id, 
          name: match.player1_name 
        });
        db.upsertPlayer('WTA', { 
          player_id: p2Id, 
          name: match.player2_name 
        });

        const matchId = `wta_${match.id}`;
        db.insertMatch('WTA', {
          match_id: matchId,
          player1_id: p1Id,
          player2_id: p2Id,
          date: match.commence_time,
          surface: match.surface,
          best_of: match.best_of,
          tournament: 'Upcoming'
        });

        if (match.ml_p1 && match.ml_p2) {
          db.insertOdds('WTA', {
            match_id: matchId,
            bookmaker: match.bookmaker,
            ml_p1: match.ml_p1,
            ml_p2: match.ml_p2,
            timestamp: new Date().toISOString()
          });
        }

        wtaStored++;
      } catch (err) {
        console.warn('Error storing WTA match:', err.message);
      }
    }

    // Check quota
    const quota = await oddsFetcher.checkQuota();

    res.json({ 
      success: true, 
      atp: { fetched: parsedATP.length, stored: atpStored },
      wta: { fetched: parsedWTA.length, stored: wtaStored },
      quota: quota,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Odds update error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/odds/status', async (req, res) => {
  try {
    if (!oddsFetcher) {
      return res.json({ 
        configured: false,
        message: 'Odds API not configured'
      });
    }

    const quota = await oddsFetcher.checkQuota();
    res.json({
      configured: true,
      quota: quota
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// START SERVER
// =============================================

export async function startServer(port = 3001) {
  // Initialize database (async)
  await db.initDb();
  
  return app.listen(port, () => {
    console.log(`Tennis Set Predictor API running on http://localhost:${port}`);
  });
}

export default app;
