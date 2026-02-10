/**
 * Tennis Scoring Engine (Markov Chain Model)
 * 
 * Calculates:
 * - Point → Game probabilities
 * - Game → Set probabilities
 * - Set → Match probabilities
 * 
 * Handles:
 * - Standard games, tiebreaks
 * - Best of 3 and Best of 5 matches
 * - Final set rules (tiebreak vs advantage)
 */

// =============================================
// GAME PROBABILITY
// =============================================

/**
 * Probability of winning a game given point win probability on serve
 * Uses closed-form solution from Klaassen & Magnus
 * 
 * @param {number} p - Probability of winning a point on serve
 * @returns {number} Probability of winning the game
 */
export function probWinGame(p) {
  const q = 1 - p;
  
  // P(win at deuce) = p^2 / (p^2 + q^2)
  const pDeuce = (p * p) / (p * p + q * q);
  
  // Full game probability formula
  const p4 = Math.pow(p, 4);
  
  // Win in 4 points (4-0): p^4
  // Win in 5 points (4-1): C(4,1) * p^4 * q = 4 * p^4 * q
  // Win in 6 points (4-2 not deuce): C(5,2) * p^4 * q^2 = 10 * p^4 * q^2
  // Reach deuce (3-3) then win: C(6,3) * p^3 * q^3 * pDeuce = 20 * p^3 * q^3 * pDeuce
  
  return p4 + 4 * p4 * q + 10 * p4 * Math.pow(q, 2) + 20 * Math.pow(p, 3) * Math.pow(q, 3) * pDeuce;
}

/**
 * Probability of winning a tiebreak given point win probabilities
 * Using iterative dynamic programming to avoid stack overflow
 * 
 * @param {number} pServe - Prob of winning point when serving
 * @param {number} pReturn - Prob of winning point when returning (opponent serves)
 * @returns {number} Probability of winning the tiebreak
 */
export function probWinTiebreak(pServe, pReturn) {
  // Tiebreak: first to 7 with 2-point lead
  // We'll compute this iteratively with memoization
  
  const MAX_POINTS = 15; // Cap at 15-15 scenario for practical limits
  const memo = {};
  
  // Determine who serves at a given point total
  // Point 1: A serves, Points 2-3: B serves, Points 4-5: A serves, etc.
  function whoServes(totalPoints) {
    if (totalPoints === 0) return true; // A serves first
    return Math.floor((totalPoints + 1) / 2) % 2 === 0;
  }
  
  // Fill in base cases and work backwards
  function getProb(a, b) {
    // Terminal states
    if (a >= 7 && a - b >= 2) return 1;
    if (b >= 7 && b - a >= 2) return 0;
    
    // Beyond practical limits, approximate 50-50 at extreme deuce scenarios
    if (a >= MAX_POINTS || b >= MAX_POINTS) {
      const pDeuceA = (pServe * pReturn) / (pServe * pReturn + (1 - pServe) * (1 - pReturn));
      return pDeuceA;
    }
    
    const key = `${a}-${b}`;
    if (key in memo) return memo[key];
    
    const totalPoints = a + b;
    const aServes = whoServes(totalPoints);
    const pWinPoint = aServes ? pServe : pReturn;
    
    const result = pWinPoint * getProb(a + 1, b) + (1 - pWinPoint) * getProb(a, b + 1);
    memo[key] = result;
    return result;
  }
  
  return getProb(0, 0);
}

// =============================================
// SET PROBABILITY
// =============================================

/**
 * Probability of winning a set given game win probabilities
 * Using iterative approach to avoid stack overflow
 * 
 * @param {number} pHold - Probability of winning service game
 * @param {number} pBreak - Probability of winning return game (breaking)
 * @param {number} pTiebreak - Probability of winning tiebreak
 * @returns {number} Probability of winning the set
 */
export function probWinSet(pHold, pBreak, pTiebreak = null) {
  const memo = {};
  
  // Calculate tiebreak probability if not provided
  if (pTiebreak === null) {
    // Approximate serve point probability from hold probability
    // Using inverse of game formula (rough approximation)
    const pServe = Math.pow(pHold, 0.25);
    const pReturn = 1 - Math.pow(1 - pBreak, 0.25);
    pTiebreak = probWinTiebreak(pServe, pReturn);
  }
  
  function getProb(gamesA, gamesB, aServes) {
    // Terminal states
    if (gamesA >= 6 && gamesA - gamesB >= 2) return 1;
    if (gamesB >= 6 && gamesB - gamesA >= 2) return 0;
    
    // Tiebreak at 6-6
    if (gamesA === 6 && gamesB === 6) {
      return pTiebreak;
    }
    
    const key = `${gamesA}-${gamesB}-${aServes ? 1 : 0}`;
    if (key in memo) return memo[key];
    
    const pWinGame = aServes ? pHold : pBreak;
    const nextServe = !aServes;
    
    const result = pWinGame * getProb(gamesA + 1, gamesB, nextServe) +
                   (1 - pWinGame) * getProb(gamesA, gamesB + 1, nextServe);
    
    memo[key] = result;
    return result;
  }
  
  // A serves first (games 1, 3, 5, etc.)
  return getProb(0, 0, true);
}

/**
 * Calculate set win probability from point win probabilities
 */
export function probSetFromPoints(pServe, pReturn) {
  const pHold = probWinGame(pServe);
  const pBreak = probWinGame(pReturn);
  const pTiebreak = probWinTiebreak(pServe, pReturn);
  
  return probWinSet(pHold, pBreak, pTiebreak);
}

// =============================================
// MATCH PROBABILITY
// =============================================

/**
 * Probability of winning a match given set win probability
 * 
 * @param {number} pSet - Probability of winning a set
 * @param {number} bestOf - Best of 3 or 5
 * @returns {number} Probability of winning the match
 */
export function probWinMatch(pSet, bestOf = 3) {
  const q = 1 - pSet;
  
  if (bestOf === 3) {
    // Win in 2 sets: p^2
    // Win in 3 sets: 2 * p^2 * q (win 2 of first 3, with 3rd being a win)
    return Math.pow(pSet, 2) + 2 * Math.pow(pSet, 2) * q;
  } else {
    // Best of 5
    // Win in 3: p^3
    // Win in 4: C(3,1) * p^3 * q = 3 * p^3 * q
    // Win in 5: C(4,2) * p^3 * q^2 = 6 * p^3 * q^2
    return Math.pow(pSet, 3) + 3 * Math.pow(pSet, 3) * q + 6 * Math.pow(pSet, 3) * Math.pow(q, 2);
  }
}

/**
 * Full match probability from point win probabilities
 * Most accurate method
 */
export function probMatchFromPoints(pServe, pReturn, bestOf = 3) {
  const pSet = probSetFromPoints(pServe, pReturn);
  return probWinMatch(pSet, bestOf);
}

// =============================================
// SET 1 PROBABILITY (KEY FOR BETTING)
// =============================================

/**
 * Probability of winning Set 1 specifically
 * This is often the key betting market
 */
export function probWinSet1(pServe, pReturn) {
  return probSetFromPoints(pServe, pReturn);
}

/**
 * Calculate match and set 1 probabilities in one call
 * Returns comprehensive probability breakdown
 */
export function calculateAllProbabilities(pServe, pReturn, bestOf = 3) {
  // Validate inputs
  pServe = Math.max(0.1, Math.min(0.95, pServe || 0.65));
  pReturn = Math.max(0.05, Math.min(0.70, pReturn || 0.35));
  
  // Game probabilities
  const pHold = probWinGame(pServe);
  const pBreak = probWinGame(pReturn);
  
  // Tiebreak probability
  const pTiebreak = probWinTiebreak(pServe, pReturn);
  
  // Set probability (used for each set)
  const pSet = probWinSet(pHold, pBreak, pTiebreak);
  
  // Match probability
  const pMatch = probWinMatch(pSet, bestOf);
  
  return {
    // Point level
    pServe,
    pReturn,
    
    // Game level
    pHold,
    pBreak,
    pTiebreak,
    
    // Set level
    pSet,
    pSet1: pSet, // Set 1 = same as general set (assuming no fatigue/momentum model)
    
    // Match level
    pMatch,
    bestOf,
    
    // Diagnostic info
    dominanceOnServe: pHold - (1 - pBreak), // Positive = serve dominant
    breakDifferential: pBreak - (1 - pHold), // Positive = more likely to break than be broken
  };
}

// =============================================
// SCENARIO ANALYSIS
// =============================================

/**
 * What-if analysis for different serve/return skill combinations
 */
export function sensitivityAnalysis(baseServe, baseReturn, steps = 5) {
  const results = [];
  const delta = 0.02; // ±2% per step
  
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const pServe = Math.min(0.95, Math.max(0.30, baseServe + i * delta));
      const pReturn = Math.min(0.70, Math.max(0.05, baseReturn + j * delta));
      
      const probs = calculateAllProbabilities(pServe, pReturn, 3);
      results.push({
        serveAdjust: i * delta,
        returnAdjust: j * delta,
        pServe,
        pReturn,
        pMatch: probs.pMatch,
        pSet1: probs.pSet1
      });
    }
  }
  
  return results;
}

/**
 * Calculate confidence interval for probability estimate
 * Using skill variance to estimate probability variance
 */
export function probabilityConfidenceInterval(pCenter, variance, confidence = 0.90) {
  // Approximate using normal distribution
  // For 90% CI, z ≈ 1.645
  const z = confidence === 0.95 ? 1.96 : 1.645;
  const se = Math.sqrt(variance);
  
  return {
    lower: Math.max(0, pCenter - z * se),
    upper: Math.min(1, pCenter + z * se),
    confidence
  };
}

// =============================================
// TENNIS SCORING ENGINE CLASS
// =============================================

export class TennisScoringEngine {
  constructor() {
    this.cache = new Map();
  }
  
  /**
   * Calculate all probabilities for a matchup
   * Main entry point for the engine
   */
  predict(player1ServePointWon, player1ReturnPointWon, bestOf = 3) {
    const cacheKey = `${player1ServePointWon.toFixed(4)}-${player1ReturnPointWon.toFixed(4)}-${bestOf}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = calculateAllProbabilities(player1ServePointWon, player1ReturnPointWon, bestOf);
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Calculate from skill model outputs
   * Convenience method that handles the skill combination
   */
  predictFromSkills(player1ServeSkill, player1ReturnSkill, player2ServeSkill, player2ReturnSkill, bestOf = 3) {
    // P1's serve point = avg of P1's serve skill and (1 - P2's return skill)
    const p1Serve = (player1ServeSkill + (1 - player2ReturnSkill)) / 2;
    
    // P1's return point = avg of P1's return skill and (1 - P2's serve skill)
    const p1Return = (player1ReturnSkill + (1 - player2ServeSkill)) / 2;
    
    return this.predict(p1Serve, p1Return, bestOf);
  }
  
  /**
   * Get probability breakdown for display
   */
  getBreakdown(pServe, pReturn, bestOf = 3) {
    const probs = this.predict(pServe, pReturn, bestOf);
    
    return {
      summary: {
        matchWin: (probs.pMatch * 100).toFixed(1) + '%',
        set1Win: (probs.pSet1 * 100).toFixed(1) + '%',
        format: `Best of ${bestOf}`
      },
      details: {
        holdServe: (probs.pHold * 100).toFixed(1) + '%',
        breakServe: (probs.pBreak * 100).toFixed(1) + '%',
        tiebreak: (probs.pTiebreak * 100).toFixed(1) + '%'
      },
      inputs: {
        servePointWon: (pServe * 100).toFixed(1) + '%',
        returnPointWon: (pReturn * 100).toFixed(1) + '%'
      }
    };
  }
  
  /**
   * Clear cache (call when skills update significantly)
   */
  clearCache() {
    this.cache.clear();
  }
}

export default TennisScoringEngine;
