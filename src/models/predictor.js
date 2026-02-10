/**
 * Tennis Set Predictor - Main Orchestrator
 * 
 * Combines:
 * - Elo Engine (surface-specific ratings)
 * - Point Skill Model (Bayesian serve/return)
 * - Scoring Engine (Markov probabilities)
 * - Ensemble Calibration
 */

import EloEngine from './elo-engine.js';
import PointSkillModel from './point-skill-model.js';
import TennisScoringEngine from '../engine/scoring-engine.js';
import EnsembleCalibrator from '../calibration/ensemble.js';
import { getBetDecision, generateExplanation } from '../backtest/backtester.js';

// =============================================
// PREDICTOR CLASS
// =============================================

export class TennisPredictor {
  constructor(tour = 'ATP') {
    this.tour = tour;
    
    // Initialize components
    this.eloEngine = new EloEngine(tour);
    this.pointModel = new PointSkillModel(tour);
    this.scoringEngine = new TennisScoringEngine();
    this.calibrator = new EnsembleCalibrator(tour);
    
    // Betting thresholds
    this.thresholds = {
      minMatchEdge: 0.03,  // 3% edge for match bets
      minSet1Edge: 0.04,   // 4% edge for Set 1 bets
      kellyFraction: 0.25, // Quarter Kelly
      maxBetPct: 0.01      // 1% max per bet
    };
  }
  
  /**
   * Train models on historical data
   */
  async train(matches) {
    console.log(`Training ${this.tour} models on ${matches.length} matches...`);
    
    // Sort chronologically
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Process through Elo engine
    console.log('Processing Elo ratings...');
    this.eloEngine.processMatches(sorted);
    
    // Process through point skill model
    console.log('Building point skill estimates...');
    this.pointModel.processMatches(sorted);
    
    // Build calibration data
    console.log('Collecting calibration data...');
    const calibrationData = [];
    
    for (let i = 100; i < sorted.length; i++) {
      const match = sorted[i];
      if (match.retirement || match.walkover) continue;
      
      // Get Elo prediction (at time of match)
      const eloPred = this.eloEngine.predictMatch(
        match.player1_id, 
        match.player2_id,
        match.surface,
        match.date
      );
      
      // Get point model prediction
      const p1Serve = this.pointModel.getServePointWon(match.player1_id, match.surface);
      const p1Return = this.pointModel.getReturnPointWon(match.player1_id, match.surface);
      const scoringResult = this.scoringEngine.predict(p1Serve, p1Return, match.best_of || 3);
      
      // Actual outcomes
      const p1WonMatch = match.winner_id === match.player1_id;
      const p1WonSet1 = match.set1_p1 > match.set1_p2;
      
      // Add match calibration sample
      calibrationData.push({
        pElo: eloPred.pWinA,
        pPoint: scoringResult.pMatch,
        actual: p1WonMatch ? 1 : 0,
        date: match.date,
        isSet1: false
      });
      
      // Add Set 1 calibration sample
      if (match.set1_p1 != null && match.set1_p2 != null) {
        calibrationData.push({
          pElo: eloPred.pWinA,
          pPoint: scoringResult.pSet1,
          actual: p1WonSet1 ? 1 : 0,
          date: match.date,
          isSet1: true
        });
      }
    }
    
    // Fit calibrator
    console.log('Fitting ensemble calibration...');
    for (const sample of calibrationData) {
      this.calibrator.addTrainingSample(
        sample.pElo, 
        sample.pPoint, 
        sample.actual, 
        sample.date, 
        sample.isSet1
      );
    }
    this.calibrator.fit({ verbose: true });
    
    console.log(`Training complete. Processed ${sorted.length} matches.`);
  }
  
  /**
   * Generate prediction for a match
   */
  predict(match, marketOdds = null) {
    // Get Elo-based probability
    const eloPred = this.eloEngine.predictMatch(
      match.player1_id,
      match.player2_id,
      match.surface,
      match.date
    );
    
    // Get point model components
    const p1Serve = this.pointModel.getServePointWon(match.player1_id, match.surface);
    const p1Return = this.pointModel.getReturnPointWon(match.player1_id, match.surface);
    const p2Serve = this.pointModel.getServePointWon(match.player2_id, match.surface);
    const p2Return = this.pointModel.getReturnPointWon(match.player2_id, match.surface);
    
    // Combined point probabilities
    const p1ServeVsP2 = (p1Serve + (1 - p2Return)) / 2;
    const p1ReturnVsP2 = (p1Return + (1 - p2Serve)) / 2;
    
    // Get scoring engine probabilities
    const scoringResult = this.scoringEngine.predict(p1ServeVsP2, p1ReturnVsP2, match.best_of || 3);
    
    // Get calibrated ensemble prediction
    const calibrated = this.calibrator.predict(
      eloPred.pWinA,
      scoringResult.pMatch
    );
    
    // Build full prediction object
    const prediction = {
      match_id: match.match_id,
      tour: this.tour,
      timestamp: new Date().toISOString(),
      
      // Final predictions
      pMatch: calibrated.pMatch,
      pSet1: calibrated.pSet1,
      
      // Component predictions
      pElo: eloPred.pWinA,
      pPoint: scoringResult.pMatch,
      pPointSet1: scoringResult.pSet1,
      
      // Confidence bands
      pMatchLower: calibrated.pMatchLower,
      pMatchUpper: calibrated.pMatchUpper,
      pSet1Lower: calibrated.pSet1Lower,
      pSet1Upper: calibrated.pSet1Upper,
      
      // Fair odds
      fairOddsP1Match: calibrated.fairOddsP1Match,
      fairOddsP2Match: calibrated.fairOddsP2Match,
      fairOddsP1Set1: calibrated.fairOddsP1Set1,
      fairOddsP2Set1: calibrated.fairOddsP2Set1,
      
      // Detailed breakdowns
      elo: {
        player1Rating: eloPred.ratingA,
        player2Rating: eloPred.ratingB,
        ratingDiff: eloPred.globalDiff,
        surfaceRatingDiff: eloPred.surfaceDiff,
        player1Matches: eloPred.matchesA,
        player2Matches: eloPred.matchesB
      },
      
      pointModel: {
        player1Serve: p1Serve,
        player1Return: p1Return,
        player2Serve: p2Serve,
        player2Return: p2Return,
        combinedServe: p1ServeVsP2,
        combinedReturn: p1ReturnVsP2
      },
      
      scoring: {
        pHold: scoringResult.pHold,
        pBreak: scoringResult.pBreak,
        pTiebreak: scoringResult.pTiebreak,
        dominanceOnServe: scoringResult.dominanceOnServe,
        breakDifferential: scoringResult.breakDifferential
      },
      
      // Calibration status
      isCalibrated: calibrated.isCalibrated
    };
    
    // Add bet decision if market odds provided
    if (marketOdds) {
      prediction.marketOdds = marketOdds;
      prediction.decision = getBetDecision(prediction, marketOdds, this.thresholds);
      prediction.explanation = generateExplanation(prediction, match, prediction.decision);
      
      // Calculate edges
      if (marketOdds.ml_p1) {
        prediction.edgeP1Match = prediction.pMatch - (1 / marketOdds.ml_p1);
      }
      if (marketOdds.ml_p2) {
        prediction.edgeP2Match = (1 - prediction.pMatch) - (1 / marketOdds.ml_p2);
      }
      if (marketOdds.set1_p1) {
        prediction.edgeP1Set1 = prediction.pSet1 - (1 / marketOdds.set1_p1);
      }
      if (marketOdds.set1_p2) {
        prediction.edgeP2Set1 = (1 - prediction.pSet1) - (1 / marketOdds.set1_p2);
      }
    }
    
    return prediction;
  }
  
  /**
   * Get player info for display
   */
  getPlayerInfo(playerId) {
    const elo = this.eloEngine.getPlayerRatings(playerId);
    const skills = this.pointModel.getPlayerSkills(playerId);
    
    return {
      playerId,
      elo: {
        global: Math.round(elo.global),
        hard: Math.round(elo.hard),
        clay: Math.round(elo.clay),
        grass: Math.round(elo.grass),
        matches: elo.matches
      },
      skills: {
        serve: {
          firstPct: (skills.firstServePct.mean * 100).toFixed(1) + '%',
          firstWon: (skills.firstServeWon.mean * 100).toFixed(1) + '%',
          secondWon: (skills.secondServeWon.mean * 100).toFixed(1) + '%'
        },
        return: {
          firstWon: (skills.firstReturnWon.mean * 100).toFixed(1) + '%',
          secondWon: (skills.secondReturnWon.mean * 100).toFixed(1) + '%'
        },
        confidence: this.pointModel.getConfidence(playerId),
        matches: skills.firstServeWon.n
      }
    };
  }
  
  /**
   * Update models after a match result
   */
  updateFromResult(match) {
    // Update Elo
    this.eloEngine.updateMatch(match);
    
    // Update point model for both players
    this.pointModel.updateFromMatch(match.player1_id, match, match.surface, true, match.date);
    this.pointModel.updateFromMatch(match.player2_id, match, match.surface, false, match.date);
  }
  
  /**
   * Set betting thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
  
  /**
   * Export model state for persistence
   */
  exportState() {
    return {
      tour: this.tour,
      eloRatings: this.eloEngine.exportRatings(),
      calibration: this.calibrator.exportWeights(),
      thresholds: this.thresholds
    };
  }
  
  /**
   * Import model state
   */
  importState(state) {
    if (state.eloRatings) {
      this.eloEngine.importRatings(state.eloRatings);
    }
    if (state.calibration) {
      this.calibrator.importWeights(state.calibration);
    }
    if (state.thresholds) {
      this.thresholds = state.thresholds;
    }
  }
}

export default TennisPredictor;
