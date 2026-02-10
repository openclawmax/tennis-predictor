/**
 * Bayesian Point-Skill Model
 * 
 * Estimates serve and return skills per player with:
 * - Surface/tournament conditioning
 * - WTA emphasis on 2nd serve weakness and double faults
 * - Regularization for sparse data (shrinkage toward population mean)
 * - Bayesian updating with prior from historical data
 */

// =============================================
// POPULATION PRIORS (Tour-specific baselines)
// =============================================

const ATP_PRIORS = {
  // Serve skills
  firstServePct: { mean: 0.62, variance: 0.003 },
  firstServeWon: { mean: 0.73, variance: 0.004 },
  secondServeWon: { mean: 0.52, variance: 0.006 },
  aceRate: { mean: 0.08, variance: 0.004 },
  doubleFaultRate: { mean: 0.03, variance: 0.002 },
  
  // Return skills
  firstReturnWon: { mean: 0.27, variance: 0.003 },
  secondReturnWon: { mean: 0.48, variance: 0.005 },
  breakPointConversion: { mean: 0.40, variance: 0.008 },
  
  // Combined serve/return point won
  servePointWon: { mean: 0.65, variance: 0.004 },
  returnPointWon: { mean: 0.35, variance: 0.004 }
};

const WTA_PRIORS = {
  // Serve skills (generally lower than ATP)
  firstServePct: { mean: 0.60, variance: 0.004 },
  firstServeWon: { mean: 0.65, variance: 0.005 },
  secondServeWon: { mean: 0.45, variance: 0.008 }, // Notable weakness in WTA
  aceRate: { mean: 0.04, variance: 0.003 },
  doubleFaultRate: { mean: 0.05, variance: 0.003 }, // Higher in WTA
  
  // Return skills (generally stronger in WTA)
  firstReturnWon: { mean: 0.35, variance: 0.005 },
  secondReturnWon: { mean: 0.55, variance: 0.006 },
  breakPointConversion: { mean: 0.42, variance: 0.010 },
  
  // Combined
  servePointWon: { mean: 0.58, variance: 0.005 },
  returnPointWon: { mean: 0.42, variance: 0.005 }
};

// Surface adjustments (multipliers for baseline skills)
const SURFACE_ADJUSTMENTS = {
  Hard: {
    firstServeWon: 1.0,
    secondServeWon: 1.0,
    aceRate: 1.0,
    doubleFaultRate: 1.0
  },
  Clay: {
    firstServeWon: 0.95, // Serve less dominant on clay
    secondServeWon: 0.95,
    aceRate: 0.70,       // Fewer aces
    doubleFaultRate: 1.1  // Slightly more DFs
  },
  Grass: {
    firstServeWon: 1.08, // Serve more dominant on grass
    secondServeWon: 1.02,
    aceRate: 1.35,       // More aces
    doubleFaultRate: 0.9
  }
};

// =============================================
// BAYESIAN UPDATING
// =============================================

/**
 * Update belief using conjugate normal-normal update
 * Prior: N(μ₀, σ₀²)
 * Data: n observations with mean x̄
 * Posterior: N(μ₁, σ₁²)
 */
function bayesianUpdate(priorMean, priorVariance, dataMean, dataVariance, n) {
  if (n === 0) return { mean: priorMean, variance: priorVariance };
  
  // Precision (inverse variance)
  const priorPrecision = 1 / priorVariance;
  const dataPrecision = n / dataVariance;
  
  // Posterior precision
  const postPrecision = priorPrecision + dataPrecision;
  const postVariance = 1 / postPrecision;
  
  // Posterior mean (weighted average)
  const postMean = (priorMean * priorPrecision + dataMean * dataPrecision) / postPrecision;
  
  return { mean: postMean, variance: postVariance };
}

/**
 * Calculate shrinkage factor based on sample size
 * Larger samples = less shrinkage toward prior
 */
function shrinkageFactor(n, minN = 50) {
  return Math.min(1, n / minN);
}

/**
 * Regularized estimate with shrinkage toward prior
 */
function regularizedEstimate(observed, prior, n, minN = 50) {
  const alpha = shrinkageFactor(n, minN);
  return alpha * observed + (1 - alpha) * prior;
}

// =============================================
// POINT SKILL MODEL CLASS
// =============================================

export class PointSkillModel {
  constructor(tour = 'ATP') {
    this.tour = tour;
    this.priors = tour === 'ATP' ? ATP_PRIORS : WTA_PRIORS;
    this.playerSkills = new Map(); // player_id -> skills object
    this.minMatchesForConfidence = tour === 'ATP' ? 20 : 15;
  }
  
  /**
   * Get or initialize player skills
   */
  getPlayerSkills(playerId) {
    if (!this.playerSkills.has(playerId)) {
      // Initialize with priors
      this.playerSkills.set(playerId, {
        // Serve metrics
        firstServePct: { ...this.priors.firstServePct, n: 0 },
        firstServeWon: { ...this.priors.firstServeWon, n: 0 },
        secondServeWon: { ...this.priors.secondServeWon, n: 0 },
        aceRate: { ...this.priors.aceRate, n: 0 },
        doubleFaultRate: { ...this.priors.doubleFaultRate, n: 0 },
        
        // Return metrics
        firstReturnWon: { ...this.priors.firstReturnWon, n: 0 },
        secondReturnWon: { ...this.priors.secondReturnWon, n: 0 },
        breakPointConversion: { ...this.priors.breakPointConversion, n: 0 },
        
        // Surface-specific (lazy initialized)
        surfaces: {},
        
        // Match history for recency weighting
        lastUpdate: null
      });
    }
    return this.playerSkills.get(playerId);
  }
  
  /**
   * Update player skills from a match result
   * Uses exponential weighting for recent matches
   */
  updateFromMatch(playerId, matchStats, surface, isPlayerOne, date) {
    const skills = this.getPlayerSkills(playerId);
    
    // Extract relevant stats based on player position
    const prefix = isPlayerOne ? 'p1_' : 'p2_';
    
    // Only update if we have valid stats
    if (matchStats[`${prefix}first_serve_pct`] == null) return skills;
    
    // Serve stats
    const firstServePct = matchStats[`${prefix}first_serve_pct`];
    const firstServeWon = matchStats[`${prefix}first_serve_won_pct`];
    const secondServeWon = matchStats[`${prefix}second_serve_won_pct`];
    
    // Return stats
    const firstReturnWon = matchStats[`${prefix}first_return_won_pct`];
    const secondReturnWon = matchStats[`${prefix}second_return_won_pct`];
    
    // Ace and DF rates (approximate from total points)
    const totalServiceGames = matchStats[`${prefix}service_games_total`] || 0;
    const aces = matchStats[`${prefix}aces`] || 0;
    const dfs = matchStats[`${prefix}double_faults`] || 0;
    const approxServePoints = totalServiceGames * 6; // Rough estimate
    
    const aceRate = approxServePoints > 0 ? aces / approxServePoints : null;
    const dfRate = approxServePoints > 0 ? dfs / approxServePoints : null;
    
    // Update each skill using Bayesian update
    if (firstServePct != null) {
      skills.firstServePct = bayesianUpdate(
        skills.firstServePct.mean,
        skills.firstServePct.variance,
        firstServePct,
        this.priors.firstServePct.variance,
        1
      );
      skills.firstServePct.n++;
    }
    
    if (firstServeWon != null) {
      skills.firstServeWon = bayesianUpdate(
        skills.firstServeWon.mean,
        skills.firstServeWon.variance,
        firstServeWon,
        this.priors.firstServeWon.variance,
        1
      );
      skills.firstServeWon.n++;
    }
    
    if (secondServeWon != null) {
      skills.secondServeWon = bayesianUpdate(
        skills.secondServeWon.mean,
        skills.secondServeWon.variance,
        secondServeWon,
        this.priors.secondServeWon.variance,
        1
      );
      skills.secondServeWon.n++;
    }
    
    if (firstReturnWon != null) {
      skills.firstReturnWon = bayesianUpdate(
        skills.firstReturnWon.mean,
        skills.firstReturnWon.variance,
        firstReturnWon,
        this.priors.firstReturnWon.variance,
        1
      );
      skills.firstReturnWon.n++;
    }
    
    if (secondReturnWon != null) {
      skills.secondReturnWon = bayesianUpdate(
        skills.secondReturnWon.mean,
        skills.secondReturnWon.variance,
        secondReturnWon,
        this.priors.secondReturnWon.variance,
        1
      );
      skills.secondReturnWon.n++;
    }
    
    if (aceRate != null) {
      skills.aceRate = bayesianUpdate(
        skills.aceRate.mean,
        skills.aceRate.variance,
        aceRate,
        this.priors.aceRate.variance,
        1
      );
      skills.aceRate.n++;
    }
    
    if (dfRate != null) {
      skills.doubleFaultRate = bayesianUpdate(
        skills.doubleFaultRate.mean,
        skills.doubleFaultRate.variance,
        dfRate,
        this.priors.doubleFaultRate.variance,
        1
      );
      skills.doubleFaultRate.n++;
    }
    
    // Update surface-specific skills
    this.updateSurfaceSkills(skills, surface, {
      firstServePct,
      firstServeWon,
      secondServeWon,
      firstReturnWon,
      secondReturnWon,
      aceRate,
      dfRate
    });
    
    skills.lastUpdate = date;
    return skills;
  }
  
  /**
   * Update surface-specific skill estimates
   */
  updateSurfaceSkills(skills, surface, stats) {
    const surfaceKey = (surface || 'Hard').toLowerCase();
    
    if (!skills.surfaces[surfaceKey]) {
      skills.surfaces[surfaceKey] = {
        servePointWon: { mean: this.priors.servePointWon.mean, variance: this.priors.servePointWon.variance, n: 0 },
        returnPointWon: { mean: this.priors.returnPointWon.mean, variance: this.priors.returnPointWon.variance, n: 0 },
        matches: 0
      };
    }
    
    const surfaceSkills = skills.surfaces[surfaceKey];
    
    // Calculate overall serve point won
    if (stats.firstServePct != null && stats.firstServeWon != null && stats.secondServeWon != null) {
      const servePointWon = stats.firstServePct * stats.firstServeWon +
                            (1 - stats.firstServePct) * stats.secondServeWon;
      
      surfaceSkills.servePointWon = bayesianUpdate(
        surfaceSkills.servePointWon.mean,
        surfaceSkills.servePointWon.variance,
        servePointWon,
        this.priors.servePointWon.variance,
        1
      );
      surfaceSkills.servePointWon.n++;
    }
    
    // Calculate overall return point won
    if (stats.firstReturnWon != null && stats.secondReturnWon != null) {
      // Approximate opponent's first serve %
      const oppFirstServePct = this.priors.firstServePct.mean;
      const returnPointWon = oppFirstServePct * stats.firstReturnWon +
                              (1 - oppFirstServePct) * stats.secondReturnWon;
      
      surfaceSkills.returnPointWon = bayesianUpdate(
        surfaceSkills.returnPointWon.mean,
        surfaceSkills.returnPointWon.variance,
        returnPointWon,
        this.priors.returnPointWon.variance,
        1
      );
      surfaceSkills.returnPointWon.n++;
    }
    
    surfaceSkills.matches++;
  }
  
  /**
   * Get effective serve point win probability for a player
   * Surface-adjusted with regularization
   */
  getServePointWon(playerId, surface = 'Hard') {
    const skills = this.getPlayerSkills(playerId);
    const surfaceKey = (surface || 'Hard').toLowerCase();
    const surfaceAdj = SURFACE_ADJUSTMENTS[surface] || SURFACE_ADJUSTMENTS.Hard;
    
    // Get surface-specific if available
    let baseEstimate;
    if (skills.surfaces[surfaceKey] && skills.surfaces[surfaceKey].servePointWon.n > 5) {
      baseEstimate = skills.surfaces[surfaceKey].servePointWon.mean;
    } else {
      // Calculate from components
      const firstPct = skills.firstServePct.mean;
      const firstWon = skills.firstServeWon.mean * surfaceAdj.firstServeWon;
      const secondWon = skills.secondServeWon.mean * surfaceAdj.secondServeWon;
      
      baseEstimate = firstPct * firstWon + (1 - firstPct) * secondWon;
    }
    
    // Apply regularization based on sample size
    const n = skills.firstServeWon.n;
    return regularizedEstimate(baseEstimate, this.priors.servePointWon.mean, n, this.minMatchesForConfidence);
  }
  
  /**
   * Get effective return point win probability for a player
   */
  getReturnPointWon(playerId, surface = 'Hard') {
    const skills = this.getPlayerSkills(playerId);
    const surfaceKey = (surface || 'Hard').toLowerCase();
    const surfaceAdj = SURFACE_ADJUSTMENTS[surface] || SURFACE_ADJUSTMENTS.Hard;
    
    // Get surface-specific if available
    let baseEstimate;
    if (skills.surfaces[surfaceKey] && skills.surfaces[surfaceKey].returnPointWon.n > 5) {
      baseEstimate = skills.surfaces[surfaceKey].returnPointWon.mean;
    } else {
      // Use component skills
      const firstReturn = skills.firstReturnWon.mean;
      const secondReturn = skills.secondReturnWon.mean;
      
      // Adjust for surface (inverse of serve adjustment)
      const oppFirstPct = this.priors.firstServePct.mean;
      baseEstimate = oppFirstPct * firstReturn / surfaceAdj.firstServeWon +
                     (1 - oppFirstPct) * secondReturn / surfaceAdj.secondServeWon;
    }
    
    const n = skills.firstReturnWon.n;
    return regularizedEstimate(baseEstimate, this.priors.returnPointWon.mean, n, this.minMatchesForConfidence);
  }
  
  /**
   * Get point win probability when player A serves against player B
   * Combines A's serve skills with B's return skills
   */
  getPointWinOnServe(serverPlayerId, returnerPlayerId, surface = 'Hard') {
    const serverServe = this.getServePointWon(serverPlayerId, surface);
    const returnerReturn = this.getReturnPointWon(returnerPlayerId, surface);
    
    // Average approach - a simple but effective combination
    // Server's serve skill + (1 - returner's return skill) / 2
    // This gives a balanced estimate accounting for both players
    const serverContrib = serverServe;
    const returnerContrib = 1 - returnerReturn;
    
    return (serverContrib + returnerContrib) / 2;
  }
  
  /**
   * Get WTA-specific double fault impact
   * Returns additional penalty for high DF players
   */
  getDoubleFaultPenalty(playerId) {
    if (this.tour !== 'WTA') return 0;
    
    const skills = this.getPlayerSkills(playerId);
    const dfRate = skills.doubleFaultRate.mean;
    const baseline = this.priors.doubleFaultRate.mean;
    
    // Penalize players with above-average DF rates
    if (dfRate > baseline) {
      return (dfRate - baseline) * 0.5; // Scale penalty
    }
    return 0;
  }
  
  /**
   * Get confidence level in skill estimates
   */
  getConfidence(playerId) {
    const skills = this.getPlayerSkills(playerId);
    const totalMatches = skills.firstServeWon.n;
    
    if (totalMatches < 5) return 'very_low';
    if (totalMatches < 15) return 'low';
    if (totalMatches < 30) return 'moderate';
    if (totalMatches < 50) return 'good';
    return 'high';
  }
  
  /**
   * Export skills in format suitable for database storage
   */
  exportSkills(playerId, date, surface = null) {
    const skills = this.getPlayerSkills(playerId);
    
    return {
      player_id: playerId,
      date: date,
      surface: surface,
      serve_skill_mean: this.getServePointWon(playerId, surface),
      serve_skill_var: skills.firstServeWon.variance,
      first_serve_pct_mean: skills.firstServePct.mean,
      first_serve_won_mean: skills.firstServeWon.mean,
      second_serve_won_mean: skills.secondServeWon.mean,
      return_skill_mean: this.getReturnPointWon(playerId, surface),
      return_skill_var: skills.firstReturnWon.variance,
      first_return_won_mean: skills.firstReturnWon.mean,
      second_return_won_mean: skills.secondReturnWon.mean,
      serve_n: skills.firstServeWon.n,
      return_n: skills.firstReturnWon.n
    };
  }
  
  /**
   * Import skills from database record
   */
  importSkills(record) {
    const skills = this.getPlayerSkills(record.player_id);
    
    // Update means from record
    if (record.first_serve_pct_mean) skills.firstServePct.mean = record.first_serve_pct_mean;
    if (record.first_serve_won_mean) skills.firstServeWon.mean = record.first_serve_won_mean;
    if (record.second_serve_won_mean) skills.secondServeWon.mean = record.second_serve_won_mean;
    if (record.first_return_won_mean) skills.firstReturnWon.mean = record.first_return_won_mean;
    if (record.second_return_won_mean) skills.secondReturnWon.mean = record.second_return_won_mean;
    
    // Update counts
    if (record.serve_n) {
      skills.firstServePct.n = record.serve_n;
      skills.firstServeWon.n = record.serve_n;
      skills.secondServeWon.n = record.serve_n;
    }
    if (record.return_n) {
      skills.firstReturnWon.n = record.return_n;
      skills.secondReturnWon.n = record.return_n;
    }
    
    skills.lastUpdate = record.date;
  }
  
  /**
   * Process multiple matches chronologically
   */
  processMatches(matches) {
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const match of sorted) {
      if (match.retirement || match.walkover) continue;
      
      // Update player 1
      this.updateFromMatch(match.player1_id, match, match.surface, true, match.date);
      
      // Update player 2
      this.updateFromMatch(match.player2_id, match, match.surface, false, match.date);
    }
  }
}

export default PointSkillModel;
