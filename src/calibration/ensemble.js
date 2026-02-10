/**
 * Ensemble Calibration Module
 * 
 * Combines Elo predictions + Point-based model predictions
 * via logistic regression calibration.
 * 
 * Optimizes for log loss (not accuracy) as per specification.
 * Outputs calibrated P_final(match) and P_final(Set1)
 */

// =============================================
// LOG LOSS OPTIMIZATION
// =============================================

/**
 * Calculate log loss (cross-entropy) for a single prediction
 * @param {number} predicted - Predicted probability (0-1)
 * @param {number} actual - Actual outcome (0 or 1)
 * @returns {number} Log loss (lower is better)
 */
export function logLoss(predicted, actual) {
  // Clip to avoid log(0)
  const eps = 1e-15;
  const p = Math.max(eps, Math.min(1 - eps, predicted));
  
  if (actual === 1) {
    return -Math.log(p);
  } else {
    return -Math.log(1 - p);
  }
}

/**
 * Calculate average log loss for a batch of predictions
 */
export function avgLogLoss(predictions, actuals) {
  if (predictions.length === 0) return 0;
  
  let total = 0;
  for (let i = 0; i < predictions.length; i++) {
    total += logLoss(predictions[i], actuals[i]);
  }
  return total / predictions.length;
}

/**
 * Calculate Brier score (mean squared error for probabilities)
 */
export function brierScore(predicted, actual) {
  return Math.pow(predicted - actual, 2);
}

/**
 * Calculate average Brier score
 */
export function avgBrierScore(predictions, actuals) {
  if (predictions.length === 0) return 0;
  
  let total = 0;
  for (let i = 0; i < predictions.length; i++) {
    total += brierScore(predictions[i], actuals[i]);
  }
  return total / predictions.length;
}

// =============================================
// LOGISTIC COMBINATION
// =============================================

/**
 * Sigmoid function
 */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Logit function (inverse sigmoid)
 */
function logit(p) {
  const eps = 1e-15;
  const clipped = Math.max(eps, Math.min(1 - eps, p));
  return Math.log(clipped / (1 - clipped));
}

/**
 * Combine probabilities using logistic regression weights
 * 
 * P_combined = sigmoid(w0 + w1*logit(pElo) + w2*logit(pPoint))
 * 
 * @param {number} pElo - Elo-based probability
 * @param {number} pPoint - Point-model probability
 * @param {object} weights - { intercept, wElo, wPoint }
 * @returns {number} Combined probability
 */
export function combineProbabilities(pElo, pPoint, weights) {
  const logOdds = weights.intercept + 
                  weights.wElo * logit(pElo) + 
                  weights.wPoint * logit(pPoint);
  return sigmoid(logOdds);
}

/**
 * Simple weighted average combination (fallback)
 */
export function weightedAverage(pElo, pPoint, wElo = 0.4) {
  return wElo * pElo + (1 - wElo) * pPoint;
}

// =============================================
// CALIBRATION FITTING
// =============================================

/**
 * Fit ensemble weights using gradient descent on log loss
 * 
 * Uses simple batch gradient descent to minimize log loss
 * Could be upgraded to BFGS or Adam for production
 */
export function fitEnsembleWeights(trainingData, options = {}) {
  const {
    learningRate = 0.1,
    maxIterations = 1000,
    tolerance = 1e-6,
    regularization = 0.01, // L2 regularization strength
    verbose = false
  } = options;
  
  // Initialize weights
  let intercept = 0;
  let wElo = 0.5;
  let wPoint = 0.5;
  
  // Training data: [{ pElo, pPoint, actual }]
  const n = trainingData.length;
  if (n === 0) {
    return { intercept: 0, wElo: 0.5, wPoint: 0.5 };
  }
  
  let prevLoss = Infinity;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // Calculate predictions and gradients
    let gradIntercept = 0;
    let gradWElo = 0;
    let gradWPoint = 0;
    let totalLoss = 0;
    
    for (const { pElo, pPoint, actual } of trainingData) {
      const logitElo = logit(pElo);
      const logitPoint = logit(pPoint);
      
      const logOdds = intercept + wElo * logitElo + wPoint * logitPoint;
      const predicted = sigmoid(logOdds);
      
      // Error (predicted - actual) for log loss gradient
      const error = predicted - actual;
      
      // Accumulate gradients
      gradIntercept += error;
      gradWElo += error * logitElo;
      gradWPoint += error * logitPoint;
      
      totalLoss += logLoss(predicted, actual);
    }
    
    // Average gradients
    gradIntercept /= n;
    gradWElo /= n;
    gradWPoint /= n;
    
    // Add L2 regularization gradients (not on intercept)
    gradWElo += regularization * wElo;
    gradWPoint += regularization * wPoint;
    
    // Update weights
    intercept -= learningRate * gradIntercept;
    wElo -= learningRate * gradWElo;
    wPoint -= learningRate * gradWPoint;
    
    // Calculate current loss
    const currentLoss = totalLoss / n + regularization * (wElo * wElo + wPoint * wPoint) / 2;
    
    if (verbose && iter % 100 === 0) {
      console.log(`Iteration ${iter}: Loss = ${currentLoss.toFixed(6)}`);
    }
    
    // Check convergence
    if (Math.abs(prevLoss - currentLoss) < tolerance) {
      if (verbose) console.log(`Converged at iteration ${iter}`);
      break;
    }
    
    prevLoss = currentLoss;
  }
  
  // Normalize weights so they're more interpretable
  // Scale so they roughly sum to 1 (excluding intercept)
  const totalWeight = Math.abs(wElo) + Math.abs(wPoint);
  if (totalWeight > 0) {
    // Keep raw weights for actual predictions
  }
  
  return { intercept, wElo, wPoint };
}

/**
 * Cross-validate ensemble weights
 * Uses time-series CV (walk-forward) to avoid look-ahead bias
 */
export function crossValidateWeights(data, nFolds = 5) {
  // Sort by date (walk-forward)
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const foldSize = Math.floor(sorted.length / nFolds);
  const results = [];
  
  for (let fold = 1; fold < nFolds; fold++) {
    // Train on first fold*foldSize samples
    // Test on next foldSize samples
    const trainEnd = fold * foldSize;
    const testEnd = (fold + 1) * foldSize;
    
    const trainData = sorted.slice(0, trainEnd);
    const testData = sorted.slice(trainEnd, testEnd);
    
    if (trainData.length < 50 || testData.length < 10) continue;
    
    // Fit on training data
    const weights = fitEnsembleWeights(trainData);
    
    // Evaluate on test data
    const predictions = testData.map(d => combineProbabilities(d.pElo, d.pPoint, weights));
    const actuals = testData.map(d => d.actual);
    
    results.push({
      fold,
      trainSize: trainData.length,
      testSize: testData.length,
      logLoss: avgLogLoss(predictions, actuals),
      brierScore: avgBrierScore(predictions, actuals),
      weights
    });
  }
  
  return results;
}

// =============================================
// CALIBRATION CLASS
// =============================================

export class EnsembleCalibrator {
  constructor(tour = 'ATP') {
    this.tour = tour;
    
    // Default weights (before calibration)
    this.matchWeights = { intercept: 0, wElo: 0.5, wPoint: 0.5 };
    this.set1Weights = { intercept: 0, wElo: 0.4, wPoint: 0.6 }; // Point model often better for Set 1
    
    // Training data buffer
    this.trainingData = [];
    this.calibrated = false;
  }
  
  /**
   * Add training sample
   */
  addTrainingSample(pElo, pPoint, actualWin, date, isSet1 = false) {
    this.trainingData.push({
      pElo,
      pPoint,
      actual: actualWin ? 1 : 0,
      date,
      isSet1
    });
  }
  
  /**
   * Fit calibration weights from training data
   */
  fit(options = {}) {
    // Separate match and set1 data
    const matchData = this.trainingData.filter(d => !d.isSet1);
    const set1Data = this.trainingData.filter(d => d.isSet1);
    
    // Fit match weights
    if (matchData.length >= 100) {
      this.matchWeights = fitEnsembleWeights(matchData, options);
      console.log(`Fitted match weights: intercept=${this.matchWeights.intercept.toFixed(4)}, wElo=${this.matchWeights.wElo.toFixed(4)}, wPoint=${this.matchWeights.wPoint.toFixed(4)}`);
    }
    
    // Fit set1 weights
    if (set1Data.length >= 100) {
      this.set1Weights = fitEnsembleWeights(set1Data, options);
      console.log(`Fitted Set1 weights: intercept=${this.set1Weights.intercept.toFixed(4)}, wElo=${this.set1Weights.wElo.toFixed(4)}, wPoint=${this.set1Weights.wPoint.toFixed(4)}`);
    }
    
    this.calibrated = true;
  }
  
  /**
   * Get calibrated match probability
   */
  getMatchProbability(pElo, pPoint) {
    if (!this.calibrated) {
      // Use simple average before calibration
      return weightedAverage(pElo, pPoint, 0.4);
    }
    return combineProbabilities(pElo, pPoint, this.matchWeights);
  }
  
  /**
   * Get calibrated Set 1 probability
   */
  getSet1Probability(pElo, pPoint) {
    if (!this.calibrated) {
      // Point model slightly more important for Set 1
      return weightedAverage(pElo, pPoint, 0.35);
    }
    return combineProbabilities(pElo, pPoint, this.set1Weights);
  }
  
  /**
   * Get full prediction with confidence bands
   */
  predict(pElo, pPoint, pEloVariance = null, pPointVariance = null) {
    const pMatch = this.getMatchProbability(pElo, pPoint);
    const pSet1 = this.getSet1Probability(pElo, pPoint);
    
    // Calculate confidence bands
    let matchBand = { lower: pMatch - 0.10, upper: pMatch + 0.10 };
    let set1Band = { lower: pSet1 - 0.10, upper: pSet1 + 0.10 };
    
    if (pEloVariance !== null && pPointVariance !== null) {
      // Approximate combined variance
      const matchVar = Math.pow(this.matchWeights.wElo, 2) * pEloVariance +
                       Math.pow(this.matchWeights.wPoint, 2) * pPointVariance;
      const set1Var = Math.pow(this.set1Weights.wElo, 2) * pEloVariance +
                      Math.pow(this.set1Weights.wPoint, 2) * pPointVariance;
      
      const z = 1.645; // 90% CI
      matchBand = {
        lower: Math.max(0.01, pMatch - z * Math.sqrt(matchVar)),
        upper: Math.min(0.99, pMatch + z * Math.sqrt(matchVar))
      };
      set1Band = {
        lower: Math.max(0.01, pSet1 - z * Math.sqrt(set1Var)),
        upper: Math.min(0.99, pSet1 + z * Math.sqrt(set1Var))
      };
    }
    
    return {
      // Final calibrated probabilities
      pMatch,
      pSet1,
      
      // Component probabilities (for transparency)
      pElo,
      pPoint,
      
      // Confidence bands
      pMatchLower: matchBand.lower,
      pMatchUpper: matchBand.upper,
      pSet1Lower: set1Band.lower,
      pSet1Upper: set1Band.upper,
      
      // Fair odds
      fairOddsP1Match: 1 / pMatch,
      fairOddsP2Match: 1 / (1 - pMatch),
      fairOddsP1Set1: 1 / pSet1,
      fairOddsP2Set1: 1 / (1 - pSet1),
      
      // Calibration status
      isCalibrated: this.calibrated
    };
  }
  
  /**
   * Evaluate calibration on held-out data
   */
  evaluate(testData) {
    const matchPreds = testData.filter(d => !d.isSet1);
    const set1Preds = testData.filter(d => d.isSet1);
    
    const results = {
      match: {
        n: matchPreds.length,
        logLoss: 0,
        brierScore: 0,
        accuracy: 0
      },
      set1: {
        n: set1Preds.length,
        logLoss: 0,
        brierScore: 0,
        accuracy: 0
      }
    };
    
    if (matchPreds.length > 0) {
      const predictions = matchPreds.map(d => this.getMatchProbability(d.pElo, d.pPoint));
      const actuals = matchPreds.map(d => d.actual);
      
      results.match.logLoss = avgLogLoss(predictions, actuals);
      results.match.brierScore = avgBrierScore(predictions, actuals);
      results.match.accuracy = predictions.filter((p, i) => 
        (p >= 0.5 && actuals[i] === 1) || (p < 0.5 && actuals[i] === 0)
      ).length / predictions.length;
    }
    
    if (set1Preds.length > 0) {
      const predictions = set1Preds.map(d => this.getSet1Probability(d.pElo, d.pPoint));
      const actuals = set1Preds.map(d => d.actual);
      
      results.set1.logLoss = avgLogLoss(predictions, actuals);
      results.set1.brierScore = avgBrierScore(predictions, actuals);
      results.set1.accuracy = predictions.filter((p, i) =>
        (p >= 0.5 && actuals[i] === 1) || (p < 0.5 && actuals[i] === 0)
      ).length / predictions.length;
    }
    
    return results;
  }
  
  /**
   * Export weights for storage
   */
  exportWeights() {
    return {
      tour: this.tour,
      matchWeights: this.matchWeights,
      set1Weights: this.set1Weights,
      calibrated: this.calibrated,
      trainingSamples: this.trainingData.length
    };
  }
  
  /**
   * Import weights from storage
   */
  importWeights(data) {
    if (data.matchWeights) this.matchWeights = data.matchWeights;
    if (data.set1Weights) this.set1Weights = data.set1Weights;
    this.calibrated = data.calibrated || false;
  }
}

export default EnsembleCalibrator;
