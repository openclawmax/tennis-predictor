/**
 * Surface-Specific Elo Engine
 * 
 * Features:
 * - Global + Surface-specific Elo (Hard, Clay, Grass)
 * - Separate ATP/WTA ladders
 * - Time decay for inactive players
 * - Weighted blending of global and surface ratings
 * - K-factor scaling based on match importance and rating confidence
 */

// =============================================
// CONSTANTS
// =============================================

const DEFAULT_ELO = 1500;
const SURFACE_WEIGHT = 0.65; // Weight for surface-specific Elo vs global
const TIME_DECAY_FACTOR = 0.95; // Per month decay toward mean
const MONTHS_UNTIL_DECAY = 3; // Start decay after this many months inactive

// K-factor settings
const BASE_K = 32;
const SLAM_K_MULTIPLIER = 1.25;
const MASTERS_K_MULTIPLIER = 1.15;
const MIN_K = 12;
const MAX_K = 48;

// Rating confidence thresholds
const PROVISIONAL_MATCHES = 30;
const SURFACE_PROVISIONAL_MATCHES = 15;

// =============================================
// ELO CALCULATION FUNCTIONS
// =============================================

/**
 * Expected score using Elo formula
 * @param {number} ratingA - Player A's rating
 * @param {number} ratingB - Player B's rating
 * @returns {number} Expected probability of A winning
 */
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new Elo rating after a match
 * @param {number} rating - Current rating
 * @param {number} expected - Expected score
 * @param {number} actual - Actual score (1 for win, 0 for loss)
 * @param {number} K - K-factor
 * @returns {number} New rating
 */
export function updateRating(rating, expected, actual, K) {
  return rating + K * (actual - expected);
}

/**
 * Calculate K-factor based on match context and player experience
 * @param {object} match - Match data
 * @param {number} matchesPlayed - Player's total matches
 * @returns {number} K-factor to use
 */
export function calculateKFactor(match, matchesPlayed) {
  let K = BASE_K;
  
  // Adjust for match importance
  if (match.tournament_level === 'G') {
    K *= SLAM_K_MULTIPLIER;
  } else if (match.tournament_level === 'M') {
    K *= MASTERS_K_MULTIPLIER;
  }
  
  // Adjust for player experience (higher K for provisional players)
  if (matchesPlayed < PROVISIONAL_MATCHES) {
    K *= 1.5 - (matchesPlayed / PROVISIONAL_MATCHES) * 0.5;
  }
  
  return Math.max(MIN_K, Math.min(MAX_K, K));
}

/**
 * Apply time decay to rating (regress toward mean for inactive players)
 * @param {number} rating - Current rating
 * @param {number} monthsInactive - Months since last match
 * @returns {number} Decayed rating
 */
export function applyTimeDecay(rating, monthsInactive) {
  if (monthsInactive <= MONTHS_UNTIL_DECAY) return rating;
  
  const decayMonths = monthsInactive - MONTHS_UNTIL_DECAY;
  const decayFactor = Math.pow(TIME_DECAY_FACTOR, decayMonths);
  
  // Regress toward default Elo
  return DEFAULT_ELO + (rating - DEFAULT_ELO) * decayFactor;
}

/**
 * Blend global and surface-specific Elo ratings
 * @param {number} globalElo - Global Elo rating
 * @param {number} surfaceElo - Surface-specific Elo rating
 * @param {number} surfaceMatches - Number of matches on this surface
 * @returns {number} Blended rating
 */
export function blendElo(globalElo, surfaceElo, surfaceMatches) {
  // Use more surface weight as player has more surface matches
  const surfaceConfidence = Math.min(1, surfaceMatches / SURFACE_PROVISIONAL_MATCHES);
  const effectiveSurfaceWeight = SURFACE_WEIGHT * surfaceConfidence;
  
  return (effectiveSurfaceWeight * surfaceElo) + ((1 - effectiveSurfaceWeight) * globalElo);
}

// =============================================
// ELO ENGINE CLASS
// =============================================

export class EloEngine {
  constructor(tour = 'ATP') {
    this.tour = tour;
    this.ratings = new Map(); // player_id -> { global, hard, clay, grass, lastMatch, matches }
  }
  
  /**
   * Get or initialize player ratings
   */
  getPlayerRatings(playerId) {
    if (!this.ratings.has(playerId)) {
      this.ratings.set(playerId, {
        global: DEFAULT_ELO,
        hard: DEFAULT_ELO,
        clay: DEFAULT_ELO,
        grass: DEFAULT_ELO,
        lastMatch: null,
        matches: { global: 0, hard: 0, clay: 0, grass: 0 }
      });
    }
    return this.ratings.get(playerId);
  }
  
  /**
   * Get effective rating for a player on a specific surface
   */
  getEffectiveRating(playerId, surface, matchDate = null) {
    const player = this.getPlayerRatings(playerId);
    
    // Apply time decay if needed
    let globalElo = player.global;
    let surfaceElo = player[surface.toLowerCase()] || player.hard;
    
    if (matchDate && player.lastMatch) {
      const monthsInactive = this.monthsBetween(player.lastMatch, matchDate);
      globalElo = applyTimeDecay(globalElo, monthsInactive);
      surfaceElo = applyTimeDecay(surfaceElo, monthsInactive);
    }
    
    const surfaceMatches = player.matches[surface.toLowerCase()] || 0;
    return blendElo(globalElo, surfaceElo, surfaceMatches);
  }
  
  /**
   * Calculate match probability using Elo
   * @returns {object} { pWinA, pWinB, globalDiff, surfaceDiff }
   */
  predictMatch(player1Id, player2Id, surface, matchDate = null) {
    const p1Rating = this.getEffectiveRating(player1Id, surface, matchDate);
    const p2Rating = this.getEffectiveRating(player2Id, surface, matchDate);
    
    const p1 = this.getPlayerRatings(player1Id);
    const p2 = this.getPlayerRatings(player2Id);
    
    const pWinA = expectedScore(p1Rating, p2Rating);
    
    return {
      pWinA,
      pWinB: 1 - pWinA,
      ratingA: p1Rating,
      ratingB: p2Rating,
      globalDiff: p1.global - p2.global,
      surfaceDiff: (p1[surface.toLowerCase()] || p1.hard) - (p2[surface.toLowerCase()] || p2.hard),
      matchesA: p1.matches.global,
      matchesB: p2.matches.global,
      surfaceMatchesA: p1.matches[surface.toLowerCase()] || 0,
      surfaceMatchesB: p2.matches[surface.toLowerCase()] || 0
    };
  }
  
  /**
   * Update ratings after a match result
   */
  updateMatch(match) {
    const p1 = this.getPlayerRatings(match.player1_id);
    const p2 = this.getPlayerRatings(match.player2_id);
    const surface = (match.surface || 'Hard').toLowerCase();
    
    // Determine winner
    const p1Won = match.winner_id === match.player1_id;
    const actualP1 = p1Won ? 1 : 0;
    const actualP2 = p1Won ? 0 : 1;
    
    // Get current effective ratings
    const p1Rating = this.getEffectiveRating(match.player1_id, match.surface, match.date);
    const p2Rating = this.getEffectiveRating(match.player2_id, match.surface, match.date);
    
    // Calculate expected scores
    const expectedP1 = expectedScore(p1Rating, p2Rating);
    const expectedP2 = 1 - expectedP1;
    
    // Calculate K-factors
    const K1 = calculateKFactor(match, p1.matches.global);
    const K2 = calculateKFactor(match, p2.matches.global);
    
    // Update global ratings
    p1.global = updateRating(p1.global, expectedP1, actualP1, K1);
    p2.global = updateRating(p2.global, expectedP2, actualP2, K2);
    
    // Update surface-specific ratings
    if (['hard', 'clay', 'grass'].includes(surface)) {
      p1[surface] = updateRating(p1[surface], expectedP1, actualP1, K1);
      p2[surface] = updateRating(p2[surface], expectedP2, actualP2, K2);
      
      p1.matches[surface]++;
      p2.matches[surface]++;
    }
    
    // Update match counts and dates
    p1.matches.global++;
    p2.matches.global++;
    p1.lastMatch = match.date;
    p2.lastMatch = match.date;
    
    return {
      player1: {
        oldRating: p1Rating,
        newRating: this.getEffectiveRating(match.player1_id, match.surface),
        ratingChange: p1.global - (p1Rating + (p1[surface] - p1Rating) * SURFACE_WEIGHT)
      },
      player2: {
        oldRating: p2Rating,
        newRating: this.getEffectiveRating(match.player2_id, match.surface),
        ratingChange: p2.global - (p2Rating + (p2[surface] - p2Rating) * SURFACE_WEIGHT)
      }
    };
  }
  
  /**
   * Process multiple matches chronologically
   */
  processMatches(matches) {
    // Sort by date
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const updates = [];
    for (const match of sorted) {
      // Skip retirements and walkovers
      if (match.retirement || match.walkover) continue;
      
      const update = this.updateMatch(match);
      updates.push({ match, update });
    }
    
    return updates;
  }
  
  /**
   * Export current ratings as array
   */
  exportRatings(date = null) {
    const ratings = [];
    for (const [playerId, data] of this.ratings.entries()) {
      ratings.push({
        player_id: playerId,
        date: date || new Date().toISOString().split('T')[0],
        elo_global: Math.round(data.global),
        elo_hard: Math.round(data.hard),
        elo_clay: Math.round(data.clay),
        elo_grass: Math.round(data.grass),
        matches_global: data.matches.global,
        matches_hard: data.matches.hard,
        matches_clay: data.matches.clay,
        matches_grass: data.matches.grass
      });
    }
    return ratings;
  }
  
  /**
   * Import ratings from database records
   */
  importRatings(ratings) {
    for (const r of ratings) {
      this.ratings.set(r.player_id, {
        global: r.elo_global || DEFAULT_ELO,
        hard: r.elo_hard || DEFAULT_ELO,
        clay: r.elo_clay || DEFAULT_ELO,
        grass: r.elo_grass || DEFAULT_ELO,
        lastMatch: r.date,
        matches: {
          global: r.matches_global || 0,
          hard: r.matches_hard || 0,
          clay: r.matches_clay || 0,
          grass: r.matches_grass || 0
        }
      });
    }
  }
  
  /**
   * Calculate months between two dates
   */
  monthsBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.max(0, (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()));
  }
  
  /**
   * Get top rated players
   */
  getTopPlayers(surface = 'global', limit = 20) {
    const surfaceKey = surface === 'global' ? 'global' : surface.toLowerCase();
    
    return Array.from(this.ratings.entries())
      .filter(([_, data]) => data.matches.global >= 10)
      .map(([playerId, data]) => ({
        playerId,
        rating: Math.round(data[surfaceKey]),
        matches: data.matches[surfaceKey] || data.matches.global
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }
}

export default EloEngine;
