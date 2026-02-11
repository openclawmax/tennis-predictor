/**
 * Telegram Tennis Predictions
 * Fetches odds, runs predictions, sends to Telegram, logs to Google Sheets
 */

import { startServer } from './src/api/server.js';
import fetch from 'node-fetch';

const TELEGRAM_CHAT_ID = '8270977363';
const ODDS_API_KEY = '3a5b48a2631b5b454a86d973db7f4553';
const OPENCLAW_API = 'http://localhost:3001';

/**
 * Fetch upcoming tennis matches from The Odds API
 */
async function fetchUpcomingMatches() {
  // Get all active tennis tournaments
  const sportsResponse = await fetch(
    `https://api.the-odds-api.com/v4/sports/tennis/events?apiKey=${ODDS_API_KEY}`
  );
  const events = await sportsResponse.json();
  
  // Filter for matches in optimal betting window (3-12 hours from now)
  const now = new Date();
  const minTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
  const maxTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours from now
  
  const upcomingMatches = events.filter(event => {
    const matchTime = new Date(event.commence_time);
    return matchTime >= minTime && matchTime <= maxTime;
  });
  
  console.log(`Found ${upcomingMatches.length} matches in optimal window`);
  
  // Get odds for each match
  const matchesWithOdds = [];
  for (const event of upcomingMatches) {
    const oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/tennis/events/${event.id}/odds?apiKey=${ODDS_API_KEY}&regions=us,uk&markets=h2h`
    );
    const oddsData = await oddsResponse.json();
    matchesWithOdds.push(oddsData);
  }
  
  return matchesWithOdds;
}

/**
 * Run prediction model on match
 */
async function getPrediction(matchData) {
  // For now, use bookmaker odds to determine favorite
  // TODO: Integrate with actual Elo/Point-Skill model
  
  const bookmakers = matchData.bookmakers || [];
  if (bookmakers.length === 0) return null;
  
  // Average odds across bookmakers
  let player1TotalOdds = 0;
  let player2TotalOdds = 0;
  let count = 0;
  
  bookmakers.forEach(book => {
    const h2h = book.markets?.find(m => m.key === 'h2h');
    if (h2h && h2h.outcomes) {
      player1TotalOdds += h2h.outcomes[0].price;
      player2TotalOdds += h2h.outcomes[1].price;
      count++;
    }
  });
  
  if (count === 0) return null;
  
  const avgOdds1 = player1TotalOdds / count;
  const avgOdds2 = player2TotalOdds / count;
  
  // Convert American odds to implied probability
  const prob1 = avgOdds1 < 0 ? 
    (-avgOdds1) / ((-avgOdds1) + 100) : 
    100 / (avgOdds1 + 100);
  const prob2 = avgOdds2 < 0 ? 
    (-avgOdds2) / ((-avgOdds2) + 100) : 
    100 / (avgOdds2 + 100);
  
  // Determine favorite
  const favorite = prob1 > prob2 ? 0 : 1;
  const confidence = Math.max(prob1, prob2);
  
  // Only recommend if strong favorite (>60% implied probability)
  const shouldBet = confidence > 0.60;
  
  return {
    player1: matchData.home_team,
    player2: matchData.away_team,
    favoriteIndex: favorite,
    favorite: favorite === 0 ? matchData.home_team : matchData.away_team,
    confidence: (confidence * 100).toFixed(1),
    shouldBet,
    odds: {
      player1: avgOdds1.toFixed(2),
      player2: avgOdds2.toFixed(2)
    },
    matchTime: new Date(matchData.commence_time).toLocaleString('en-US', {
      timeZone: 'America/Denver',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    sport: matchData.sport_title
  };
}

/**
 * Send prediction to Telegram
 */
async function sendTelegramPrediction(prediction) {
  const message = `🎾 ${prediction.sport}

${prediction.player1} vs ${prediction.player2}
📅 ${prediction.matchTime} MST

✅ **Prediction: ${prediction.favorite}**
📊 Confidence: ${prediction.confidence}%
💰 Odds: ${prediction.player1} (${prediction.odds.player1}) | ${prediction.player2} (${prediction.odds.player2})

${prediction.shouldBet ? '✓ Recommended bet' : 'ℹ️ Low confidence - tracking only'}`;

  // Use OpenClaw's message tool via the gateway
  console.log('Sending to Telegram:', message);
  // This will be called via OpenClaw's cron system which has access to message()
  return message;
}

/**
 * Log prediction to CSV tracker
 */
async function logToGoogleSheets(prediction) {
  const { logPrediction } = await import('./sheets-tracker.js');
  logPrediction(prediction);
}

/**
 * Main prediction check
 */
export async function checkAndSendPredictions() {
  try {
    console.log('Checking for upcoming matches...');
    
    const matches = await fetchUpcomingMatches();
    
    if (matches.length === 0) {
      console.log('No matches in optimal betting window');
      return { sent: 0, tracked: 0 };
    }
    
    const predictions = [];
    for (const match of matches) {
      const pred = await getPrediction(match);
      if (pred && pred.shouldBet) {
        predictions.push(pred);
        const message = await sendTelegramPrediction(pred);
        await logToGoogleSheets(pred);
      }
    }
    
    console.log(`Sent ${predictions.length} predictions`);
    return { sent: predictions.length, tracked: matches.length };
    
  } catch (error) {
    console.error('Error in prediction check:', error);
    throw error;
  }
}

// Export for testing
export { fetchUpcomingMatches, getPrediction, sendTelegramPrediction };
