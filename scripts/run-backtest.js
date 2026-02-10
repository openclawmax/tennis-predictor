/**
 * Run Backtest Script
 */

import db from '../src/db/database.js';
import TennisPredictor from '../src/models/predictor.js';
import Backtester from '../src/backtest/backtester.js';

async function runBacktest() {
  console.log('Starting backtest...');
  
  // Initialize DB
  await db.initDb();
  
  // Get all matches
  const atpMatches = db.getMatchesByDateRange('ATP', '2022-01-01', '2026-12-31');
  const wtaMatches = db.getMatchesByDateRange('WTA', '2022-01-01', '2026-12-31');
  
  console.log(`Found ${atpMatches.length} ATP matches and ${wtaMatches.length} WTA matches`);
  
  if (atpMatches.length === 0 && wtaMatches.length === 0) {
    console.log('No matches found. Please run generate-sample-data.js first.');
    db.closeDb();
    return;
  }
  
  // Run ATP backtest
  if (atpMatches.length > 100) {
    console.log('\n=== ATP BACKTEST ===');
    const atpPredictor = new TennisPredictor('ATP');
    const atpBacktester = new Backtester({
      minMatchEdge: 0.03,
      minSet1Edge: 0.04,
      kellyFraction: 0.25,
      maxBetPct: 0.01,
      startingBankroll: 1000
    });
    
    const atpReport = await atpBacktester.runWalkForward(
      atpMatches,
      (match, historical) => {
        atpPredictor.eloEngine.processMatches(historical.slice(-500));
        atpPredictor.pointModel.processMatches(historical.slice(-500));
        return atpPredictor.predict(match, db.getOddsForMatch('ATP', match.match_id));
      },
      (match) => db.getOddsForMatch('ATP', match.match_id) || {}
    );
    
    console.log('\nATP Results:');
    console.log(`  Matches: ${atpReport.overall.n}`);
    console.log(`  Match Accuracy: ${(atpReport.overall.matchAccuracy * 100).toFixed(1)}%`);
    console.log(`  Set 1 Accuracy: ${(atpReport.overall.set1Accuracy * 100).toFixed(1)}%`);
    console.log(`  Avg Log Loss (Match): ${atpReport.overall.avgLogLossMatch.toFixed(4)}`);
    console.log(`  Avg Log Loss (Set 1): ${atpReport.overall.avgLogLossSet1.toFixed(4)}`);
    console.log(`  Bets Placed: ${atpReport.overall.totalBets}`);
    console.log(`  Total PnL: $${atpReport.overall.totalPnL.toFixed(2)}`);
    console.log(`  ROI: ${(atpReport.overall.roi * 100).toFixed(2)}%`);
    console.log(`  Win Rate: ${(atpReport.overall.winRate * 100).toFixed(1)}%`);
  }
  
  // Run WTA backtest
  if (wtaMatches.length > 100) {
    console.log('\n=== WTA BACKTEST ===');
    const wtaPredictor = new TennisPredictor('WTA');
    const wtaBacktester = new Backtester({
      minMatchEdge: 0.03,
      minSet1Edge: 0.04,
      kellyFraction: 0.25,
      maxBetPct: 0.01,
      startingBankroll: 1000
    });
    
    const wtaReport = await wtaBacktester.runWalkForward(
      wtaMatches,
      (match, historical) => {
        wtaPredictor.eloEngine.processMatches(historical.slice(-500));
        wtaPredictor.pointModel.processMatches(historical.slice(-500));
        return wtaPredictor.predict(match, db.getOddsForMatch('WTA', match.match_id));
      },
      (match) => db.getOddsForMatch('WTA', match.match_id) || {}
    );
    
    console.log('\nWTA Results:');
    console.log(`  Matches: ${wtaReport.overall.n}`);
    console.log(`  Match Accuracy: ${(wtaReport.overall.matchAccuracy * 100).toFixed(1)}%`);
    console.log(`  Set 1 Accuracy: ${(wtaReport.overall.set1Accuracy * 100).toFixed(1)}%`);
    console.log(`  Avg Log Loss (Match): ${wtaReport.overall.avgLogLossMatch.toFixed(4)}`);
    console.log(`  Avg Log Loss (Set 1): ${wtaReport.overall.avgLogLossSet1.toFixed(4)}`);
    console.log(`  Bets Placed: ${wtaReport.overall.totalBets}`);
    console.log(`  Total PnL: $${wtaReport.overall.totalPnL.toFixed(2)}`);
    console.log(`  ROI: ${(wtaReport.overall.roi * 100).toFixed(2)}%`);
    console.log(`  Win Rate: ${(wtaReport.overall.winRate * 100).toFixed(1)}%`);
  }
  
  db.closeDb();
  console.log('\nBacktest complete!');
}

runBacktest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
