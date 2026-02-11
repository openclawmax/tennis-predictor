# Tennis Prediction System - Documentation

## Overview
Automated tennis match prediction system that sends Telegram notifications for high-confidence betting opportunities.

## Components

### 1. Prediction Engine (`telegram-predictions.js`)
- Fetches upcoming tennis matches from The Odds API
- Filters for matches in optimal betting window (3-12 hours before start)
- Runs prediction model based on bookmaker odds analysis
- Sends Telegram messages for high-confidence picks (>60% probability)
- Logs all predictions to CSV tracker

**Key Functions:**
- `fetchUpcomingMatches()` - Gets matches from Odds API
- `getPrediction(matchData)` - Runs prediction algorithm
- `sendTelegramPrediction(prediction)` - Formats and sends to Telegram
- `checkAndSendPredictions()` - Main entry point

### 2. Tracking System (`sheets-tracker.js`)
- Logs all predictions to CSV file (`data/predictions-log.csv`)
- Tracks: Date, players, prediction, confidence, odds, sent status
- Generates weekly recap summaries
- Ready for Google Sheets API integration

**Key Functions:**
- `logPrediction(prediction)` - Logs to CSV
- `getWeeklyPredictions()` - Retrieves last 7 days
- `generateWeeklyRecap()` - Creates summary message

### 3. Automated Scheduling (OpenClaw Cron Jobs)

#### Daily Prediction Checks
- **Schedule:** Every 6 hours
- **Job ID:** f22e1871-bd78-47f1-9e0d-0ce855f589ad
- **Action:** Run prediction check, send high-confidence picks

#### Weekly Recap
- **Schedule:** Sundays at 6:00 PM MST
- **Job ID:** 1009a9dd-38f5-4536-b301-d8cd992bc31f
- **Action:** Send weekly win/loss summary

## Optimal Betting Window
**Why 3-12 hours before match?**
- <3 hours: Odds moved by sharp money, too close to match start
- >12 hours: Odds still stabilizing, bookmakers adjusting
- 3-12 hours: Sweet spot for value + stability

## Current Prediction Model
**Phase 1 (Current):**
- Analyzes bookmaker odds consensus
- Recommends only clear favorites (>60% implied probability)
- Conservative approach: Quality over quantity

**Future Enhancements:**
- Integrate full Elo + Point-Skill + Markov model
- Add historical data learning
- Track actual results and improve accuracy

## Message Format
```
🎾 WTA Qatar Open

Sakkari vs Gracheva
📅 Feb 12, 10:00 AM MST

✅ Prediction: Sakkari
📊 Confidence: 68.5%
💰 Odds: Sakkari (1.52) | Gracheva (2.65)

✓ Recommended bet
```

## Cost Estimate
- **Odds API:** Free (500 requests/month)
- **OpenClaw Tokens:** ~3,000-5,000/month = $15-25
- **Optimization Target:** <$10/month

## Files
- `telegram-predictions.js` - Main prediction engine
- `sheets-tracker.js` - CSV logging and recap generation
- `test-predictions.js` - Manual test runner
- `data/predictions-log.csv` - Prediction history

## Testing
Run manual prediction check:
```bash
cd C:\Users\Max\.openclaw\workspace\tennis-predictor
node test-predictions.js
```

## Cron Job Management
List jobs:
```bash
openclaw cron list
```

Remove job:
```bash
openclaw cron remove --id <job-id>
```

## Next Steps
1. ✅ Automated predictions LIVE
2. ✅ CSV tracking operational  
3. ✅ Weekly recaps scheduled
4. 🔲 Add result tracking (manual or automated)
5. 🔲 Integrate full prediction model (Elo/Point-Skill)
6. 🔲 Upgrade to Google Sheets API
7. 🔲 Historical data collection for model improvement
