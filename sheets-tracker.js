/**
 * Google Sheets Tracker for Tennis Predictions
 * Simple CSV-based tracking until we set up full Google Sheets API
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRACKING_FILE = join(process.cwd(), 'data', 'predictions-log.csv');

/**
 * Initialize tracking file
 */
export function initTracker() {
  if (!existsSync(TRACKING_FILE)) {
    const header = 'Date,Player1,Player2,Prediction,Confidence,Odds1,Odds2,MatchTime,Sent,Result,Correct\n';
    writeFileSync(TRACKING_FILE, header);
  }
}

/**
 * Log a prediction
 */
export function logPrediction(prediction) {
  initTracker();
  
  const row = [
    new Date().toISOString(),
    prediction.player1,
    prediction.player2,
    prediction.favorite,
    prediction.confidence,
    prediction.odds.player1,
    prediction.odds.player2,
    prediction.matchTime,
    prediction.shouldBet ? 'YES' : 'NO',
    '', // Result - to be filled later
    ''  // Correct - to be filled later
  ].join(',') + '\n';
  
  appendFileSync(TRACKING_FILE, row);
  console.log('Logged prediction to CSV');
}

/**
 * Get all predictions from this week
 */
export function getWeeklyPredictions() {
  if (!existsSync(TRACKING_FILE)) return [];
  
  const content = readFileSync(TRACKING_FILE, 'utf-8');
  const lines = content.split('\n').slice(1); // Skip header
  
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return lines
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(',');
      return {
        date: new Date(parts[0]),
        player1: parts[1],
        player2: parts[2],
        prediction: parts[3],
        confidence: parts[4],
        sent: parts[8] === 'YES',
        result: parts[9],
        correct: parts[10]
      };
    })
    .filter(pred => pred.date >= oneWeekAgo);
}

/**
 * Generate weekly recap message
 */
export function generateWeeklyRecap() {
  const predictions = getWeeklyPredictions();
  const sent = predictions.filter(p => p.sent);
  
  if (sent.length === 0) {
    return `📊 **Weekly Tennis Predictions Recap**

No predictions sent this week.

The model is monitoring matches but hasn't found any high-confidence bets in the optimal timing window (3-12 hours before match start).`;
  }
  
  // Count results (for now, all will be pending until we add result tracking)
  const withResults = sent.filter(p => p.result);
  const correct = withResults.filter(p => p.correct === 'YES').length;
  
  let recap = `📊 **Weekly Tennis Predictions Recap**\n\n`;
  recap += `🎾 Predictions sent: ${sent.length}\n`;
  
  if (withResults.length > 0) {
    const accuracy = ((correct / withResults.length) * 100).toFixed(1);
    recap += `✅ Correct: ${correct}/${withResults.length} (${accuracy}%)\n`;
    recap += `❌ Incorrect: ${withResults.length - correct}\n`;
  } else {
    recap += `⏳ Results pending (matches not completed yet)\n`;
  }
  
  recap += `\n**This Week's Predictions:**\n`;
  sent.forEach(pred => {
    const status = pred.result ? 
      (pred.correct === 'YES' ? '✅' : '❌') : 
      '⏳';
    recap += `${status} ${pred.prediction} (${pred.confidence}% conf)\n`;
  });
  
  recap += `\n_Next recap: Next Sunday_`;
  
  return recap;
}
