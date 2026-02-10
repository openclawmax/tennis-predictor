/**
 * Backtesting & Validation Framework
 * 
 * Features:
 * - Walk-forward testing (no random splits)
 * - Metrics: log loss, ROI, price improvement vs closing
 * - Separate ATP/WTA reporting
 * - Configurable betting thresholds
 */

import { logLoss, brierScore } from '../calibration/ensemble.js';

// =============================================
// BETTING LOGIC
// =============================================

/**
 * Calculate edge (fair prob - implied market prob)
 * Positive edge = value bet opportunity
 */
export function calculateEdge(fairProb, marketOdds) {
  const impliedProb = 1 / marketOdds;
  return fairProb - impliedProb;
}

/**
 * Calculate Kelly criterion bet size
 * f* = (bp - q) / b
 * where b = odds - 1, p = prob of win, q = prob of loss
 */
export function kellyFraction(fairProb, odds) {
  const b = odds - 1;
  const p = fairProb;
  const q = 1 - p;
  
  if (b <= 0) return 0;
  
  const kelly = (b * p - q) / b;
  return Math.max(0, kelly);
}

/**
 * Apply fractional Kelly with bankroll cap
 */
export function calculateBetSize(fairProb, odds, fraction = 0.25, maxPctBankroll = 0.01) {
  const fullKelly = kellyFraction(fairProb, odds);
  const fractionalKelly = fullKelly * fraction;
  
  return Math.min(fractionalKelly, maxPctBankroll);
}

/**
 * Determine bet decision based on edge thresholds
 */
export function getBetDecision(prediction, marketOdds, thresholds = {}) {
  const {
    minMatchEdge = 0.03,    // 3% edge required for match bets
    minSet1Edge = 0.04,     // 4% edge required for Set 1 bets
    kellyFraction = 0.25,   // Quarter Kelly
    maxBetPct = 0.01        // 1% max bankroll per bet
  } = thresholds;
  
  const decisions = [];
  
  // Check P1 match bet
  if (marketOdds.ml_p1) {
    const edge = calculateEdge(prediction.pMatch, marketOdds.ml_p1);
    if (edge >= minMatchEdge) {
      decisions.push({
        side: 'P1_MATCH',
        edge,
        odds: marketOdds.ml_p1,
        fairProb: prediction.pMatch,
        impliedProb: 1 / marketOdds.ml_p1,
        betSize: calculateBetSize(prediction.pMatch, marketOdds.ml_p1, kellyFraction, maxBetPct)
      });
    }
  }
  
  // Check P2 match bet
  if (marketOdds.ml_p2) {
    const p2FairProb = 1 - prediction.pMatch;
    const edge = calculateEdge(p2FairProb, marketOdds.ml_p2);
    if (edge >= minMatchEdge) {
      decisions.push({
        side: 'P2_MATCH',
        edge,
        odds: marketOdds.ml_p2,
        fairProb: p2FairProb,
        impliedProb: 1 / marketOdds.ml_p2,
        betSize: calculateBetSize(p2FairProb, marketOdds.ml_p2, kellyFraction, maxBetPct)
      });
    }
  }
  
  // Check P1 Set 1 bet
  if (marketOdds.set1_p1) {
    const edge = calculateEdge(prediction.pSet1, marketOdds.set1_p1);
    if (edge >= minSet1Edge) {
      decisions.push({
        side: 'P1_SET1',
        edge,
        odds: marketOdds.set1_p1,
        fairProb: prediction.pSet1,
        impliedProb: 1 / marketOdds.set1_p1,
        betSize: calculateBetSize(prediction.pSet1, marketOdds.set1_p1, kellyFraction, maxBetPct)
      });
    }
  }
  
  // Check P2 Set 1 bet
  if (marketOdds.set1_p2) {
    const p2FairProb = 1 - prediction.pSet1;
    const edge = calculateEdge(p2FairProb, marketOdds.set1_p2);
    if (edge >= minSet1Edge) {
      decisions.push({
        side: 'P2_SET1',
        edge,
        odds: marketOdds.set1_p2,
        fairProb: p2FairProb,
        impliedProb: 1 / marketOdds.set1_p2,
        betSize: calculateBetSize(p2FairProb, marketOdds.set1_p2, kellyFraction, maxBetPct)
      });
    }
  }
  
  // Return best bet if any, otherwise PASS
  if (decisions.length === 0) {
    return { action: 'PASS', reason: 'No sufficient edge found' };
  }
  
  // Pick highest edge bet
  decisions.sort((a, b) => b.edge - a.edge);
  return { action: 'BET', ...decisions[0], alternatives: decisions.slice(1) };
}

/**
 * Generate "why" explanation (3 bullets max)
 */
export function generateExplanation(prediction, matchData, decision) {
  const bullets = [];
  
  // Bullet 1: Elo/rating advantage
  const eloDiff = prediction.pElo - 0.5;
  if (Math.abs(eloDiff) > 0.05) {
    const favored = eloDiff > 0 ? (matchData.player1_name || 'Player 1') : (matchData.player2_name || 'Player 2');
    bullets.push(`Elo favors ${favored} (${(Math.abs(eloDiff) * 100).toFixed(0)}% edge)`);
  }
  
  // Bullet 2: Surface/serve advantage
  if (prediction.dominanceOnServe !== undefined) {
    if (prediction.dominanceOnServe > 0.05) {
      bullets.push(`Strong serve advantage on ${matchData.surface}`);
    } else if (prediction.dominanceOnServe < -0.05) {
      bullets.push(`Return-oriented matchup favors breaks`);
    }
  }
  
  // Bullet 3: Edge vs market
  if (decision.action === 'BET') {
    bullets.push(`${(decision.edge * 100).toFixed(1)}% edge vs market at ${decision.odds.toFixed(2)} odds`);
  } else {
    bullets.push(`No actionable edge (market efficient)`);
  }
  
  return bullets.slice(0, 3);
}

// =============================================
// BACKTESTER CLASS
// =============================================

export class Backtester {
  constructor(options = {}) {
    this.options = {
      minMatchEdge: 0.03,
      minSet1Edge: 0.04,
      kellyFraction: 0.25,
      maxBetPct: 0.01,
      startingBankroll: 1000,
      ...options
    };
    
    this.results = [];
    this.runId = null;
  }
  
  /**
   * Run walk-forward backtest
   * 
   * @param {Array} matches - Historical matches sorted by date
   * @param {Function} predictFn - Function(match, historicalData) => prediction
   * @param {Function} getOddsFn - Function(match) => market odds
   */
  async runWalkForward(matches, predictFn, getOddsFn = null) {
    this.runId = `bt_${Date.now()}`;
    this.results = [];
    
    let bankroll = this.options.startingBankroll;
    
    // Sort matches chronologically
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (let i = 0; i < sorted.length; i++) {
      const match = sorted[i];
      const historicalMatches = sorted.slice(0, i); // All matches before this one
      
      // Skip if not enough history
      if (historicalMatches.length < 100) continue;
      
      // Skip retirements
      if (match.retirement || match.walkover) continue;
      
      try {
        // Get prediction (should only use historical data)
        const prediction = await predictFn(match, historicalMatches);
        if (!prediction) continue;
        
        // Get market odds
        const odds = getOddsFn ? getOddsFn(match) : {
          ml_p1: match.ml_p1 || null,
          ml_p2: match.ml_p2 || null,
          set1_p1: match.set1_p1 || null,
          set1_p2: match.set1_p2 || null
        };
        
        // Make bet decision
        const decision = getBetDecision(prediction, odds, this.options);
        
        // Determine actual outcomes
        const p1WonMatch = match.winner_id === match.player1_id;
        const p1WonSet1 = match.set1_p1 > match.set1_p2;
        
        // Calculate PnL
        let pnl = 0;
        let stake = 0;
        let betPlaced = false;
        
        if (decision.action === 'BET') {
          stake = bankroll * decision.betSize;
          betPlaced = true;
          
          const betWon = 
            (decision.side === 'P1_MATCH' && p1WonMatch) ||
            (decision.side === 'P2_MATCH' && !p1WonMatch) ||
            (decision.side === 'P1_SET1' && p1WonSet1) ||
            (decision.side === 'P2_SET1' && !p1WonSet1);
          
          if (betWon) {
            pnl = stake * (decision.odds - 1);
          } else {
            pnl = -stake;
          }
          
          bankroll += pnl;
        }
        
        // Calculate metrics
        const result = {
          run_id: this.runId,
          match_id: match.match_id,
          tour: match.tour || 'ATP',
          date: match.date,
          
          // Predictions
          p_match_p1: prediction.pMatch,
          p_set1_p1: prediction.pSet1,
          p_elo_p1: prediction.pElo,
          p_point_p1: prediction.pPoint,
          
          // Market
          market_ml_p1: odds.ml_p1,
          market_set1_p1: odds.set1_p1,
          
          // Actuals
          actual_winner: p1WonMatch ? 'P1' : 'P2',
          actual_set1_winner: p1WonSet1 ? 'P1' : 'P2',
          
          // Accuracy
          match_correct: (prediction.pMatch >= 0.5) === p1WonMatch ? 1 : 0,
          set1_correct: (prediction.pSet1 >= 0.5) === p1WonSet1 ? 1 : 0,
          
          // Log loss
          log_loss_match: logLoss(prediction.pMatch, p1WonMatch ? 1 : 0),
          log_loss_set1: logLoss(prediction.pSet1, p1WonSet1 ? 1 : 0),
          
          // Brier score
          brier_match: brierScore(prediction.pMatch, p1WonMatch ? 1 : 0),
          brier_set1: brierScore(prediction.pSet1, p1WonSet1 ? 1 : 0),
          
          // Betting
          bet_placed: betPlaced ? 1 : 0,
          bet_side: decision.side || 'PASS',
          edge: decision.edge || 0,
          odds_taken: decision.odds || 0,
          stake,
          pnl,
          roi: stake > 0 ? pnl / stake : 0,
          bankroll
        };
        
        this.results.push(result);
      } catch (err) {
        console.error(`Error processing match ${match.match_id}:`, err.message);
      }
    }
    
    return this.generateReport();
  }
  
  /**
   * Generate summary report
   */
  generateReport() {
    const report = {
      runId: this.runId,
      totalMatches: this.results.length,
      byTour: {},
      overall: this.calculateMetrics(this.results)
    };
    
    // Split by tour
    const tours = [...new Set(this.results.map(r => r.tour))];
    for (const tour of tours) {
      const tourResults = this.results.filter(r => r.tour === tour);
      report.byTour[tour] = this.calculateMetrics(tourResults);
    }
    
    return report;
  }
  
  /**
   * Calculate aggregate metrics
   */
  calculateMetrics(results) {
    if (results.length === 0) {
      return {
        n: 0,
        matchAccuracy: 0,
        set1Accuracy: 0,
        avgLogLossMatch: 0,
        avgLogLossSet1: 0,
        avgBrierMatch: 0,
        avgBrierSet1: 0,
        totalBets: 0,
        totalStake: 0,
        totalPnL: 0,
        roi: 0,
        winRate: 0
      };
    }
    
    const n = results.length;
    const bets = results.filter(r => r.bet_placed === 1);
    
    return {
      n,
      
      // Accuracy
      matchAccuracy: results.reduce((sum, r) => sum + r.match_correct, 0) / n,
      set1Accuracy: results.reduce((sum, r) => sum + r.set1_correct, 0) / n,
      
      // Log loss
      avgLogLossMatch: results.reduce((sum, r) => sum + r.log_loss_match, 0) / n,
      avgLogLossSet1: results.reduce((sum, r) => sum + r.log_loss_set1, 0) / n,
      
      // Brier score
      avgBrierMatch: results.reduce((sum, r) => sum + r.brier_match, 0) / n,
      avgBrierSet1: results.reduce((sum, r) => sum + r.brier_set1, 0) / n,
      
      // Betting
      totalBets: bets.length,
      betRate: bets.length / n,
      totalStake: bets.reduce((sum, r) => sum + r.stake, 0),
      totalPnL: bets.reduce((sum, r) => sum + r.pnl, 0),
      roi: bets.length > 0 
        ? bets.reduce((sum, r) => sum + r.pnl, 0) / bets.reduce((sum, r) => sum + r.stake, 0)
        : 0,
      winRate: bets.length > 0
        ? bets.filter(r => r.pnl > 0).length / bets.length
        : 0,
      
      // Final bankroll
      finalBankroll: results.length > 0 ? results[results.length - 1].bankroll : 0,
      
      // Edge analysis
      avgEdgeOnBets: bets.length > 0
        ? bets.reduce((sum, r) => sum + r.edge, 0) / bets.length
        : 0
    };
  }
  
  /**
   * Get calibration data (for fitting ensemble)
   */
  getCalibrationData(beforeDate = null) {
    let filtered = this.results;
    if (beforeDate) {
      filtered = filtered.filter(r => new Date(r.date) < new Date(beforeDate));
    }
    
    return {
      match: filtered.map(r => ({
        pElo: r.p_elo_p1,
        pPoint: r.p_point_p1,
        actual: r.actual_winner === 'P1' ? 1 : 0,
        date: r.date
      })),
      set1: filtered.map(r => ({
        pElo: r.p_elo_p1,
        pPoint: r.p_point_p1,
        actual: r.actual_set1_winner === 'P1' ? 1 : 0,
        date: r.date,
        isSet1: true
      }))
    };
  }
  
  /**
   * Get price improvement metrics (vs closing line)
   */
  calculatePriceImprovement(results = null) {
    const data = results || this.results;
    const bets = data.filter(r => r.bet_placed === 1 && r.market_ml_p1);
    
    if (bets.length === 0) return { avgImprovement: 0, pctBetsCLV: 0 };
    
    // Would need closing line odds to calculate properly
    // For now, return placeholder
    return {
      avgImprovement: 0, // Would be (betting odds - closing odds) / closing odds
      pctBetsCLV: 0,     // Percentage with positive closing line value
      note: 'Requires closing line odds data for full CLV analysis'
    };
  }
  
  /**
   * Export results for database storage
   */
  exportResults() {
    return this.results;
  }
}

export default Backtester;
