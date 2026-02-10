import React from 'react';

function ResultsPanel({ prediction, player1Name, player2Name, loading }) {
  if (loading) {
    return (
      <div className="card">
        <h2 className="card-header">📈 Prediction Results</h2>
        <div className="loading">
          <div className="spinner"></div>
          <p>Calculating probabilities...</p>
        </div>
      </div>
    );
  }
  
  if (!prediction) {
    return (
      <div className="card">
        <h2 className="card-header">📈 Prediction Results</h2>
        <div className="empty-state">
          <span>🎾</span>
          <p>Select two players and click "Generate Prediction"<br/>to see match probabilities and betting analysis.</p>
        </div>
      </div>
    );
  }
  
  const { summary, fairOdds, recommendation, prediction: pred } = prediction;
  
  const p1MatchProb = parseFloat(summary.player1WinProb);
  const p1Set1Prob = parseFloat(summary.player1Set1Prob);
  const p1Favored = p1MatchProb > 50;
  
  return (
    <div className="card">
      <h2 className="card-header">📈 Prediction Results</h2>
      
      <div className="prediction-results">
        {/* Match Win Probability */}
        <div>
          <div className="confidence-band">
            <div className="label">MATCH WIN PROBABILITY</div>
          </div>
          <div className="prob-display">
            <div className={`prob-player ${p1Favored ? 'favored' : ''}`}>
              <div className="name">{player1Name}</div>
              <div className="prob">{summary.player1WinProb}</div>
            </div>
            <div className="prob-vs">VS</div>
            <div className={`prob-player ${!p1Favored ? 'favored' : ''}`}>
              <div className="name">{player2Name}</div>
              <div className="prob">{summary.player2WinProb}</div>
            </div>
          </div>
        </div>
        
        {/* Confidence Band */}
        <div className="confidence-band">
          <div className="label">Confidence Band (90%): {summary.confidenceBand.match}</div>
          <div className="band-bar">
            <div 
              className="band-fill" 
              style={{ 
                left: `${pred.pMatchLower * 100}%`,
                width: `${(pred.pMatchUpper - pred.pMatchLower) * 100}%`
              }}
            />
            <div 
              className="band-marker" 
              style={{ left: `${pred.pMatch * 100}%` }}
            />
          </div>
        </div>
        
        {/* Set 1 Probability */}
        <div>
          <div className="confidence-band">
            <div className="label">SET 1 WIN PROBABILITY</div>
          </div>
          <div className="prob-display">
            <div className={`prob-player ${p1Set1Prob > 50 ? 'favored' : ''}`}>
              <div className="name">{player1Name}</div>
              <div className="prob">{summary.player1Set1Prob}</div>
            </div>
            <div className="prob-vs">VS</div>
            <div className={`prob-player ${p1Set1Prob <= 50 ? 'favored' : ''}`}>
              <div className="name">{player2Name}</div>
              <div className="prob">{summary.player2Set1Prob}</div>
            </div>
          </div>
        </div>
        
        {/* Fair Odds */}
        <div className="fair-odds">
          <div className="odds-item">
            <div className="label">{player1Name} Match</div>
            <div className="value">{fairOdds.player1Match}</div>
            {pred.edgeP1Match !== undefined && (
              <div className={`edge ${pred.edgeP1Match > 0 ? 'positive' : 'negative'}`}>
                {pred.edgeP1Match > 0 ? '+' : ''}{(pred.edgeP1Match * 100).toFixed(1)}% edge
              </div>
            )}
          </div>
          <div className="odds-item">
            <div className="label">{player2Name} Match</div>
            <div className="value">{fairOdds.player2Match}</div>
            {pred.edgeP2Match !== undefined && (
              <div className={`edge ${pred.edgeP2Match > 0 ? 'positive' : 'negative'}`}>
                {pred.edgeP2Match > 0 ? '+' : ''}{(pred.edgeP2Match * 100).toFixed(1)}% edge
              </div>
            )}
          </div>
          <div className="odds-item">
            <div className="label">{player1Name} Set 1</div>
            <div className="value">{fairOdds.player1Set1}</div>
            {pred.edgeP1Set1 !== undefined && (
              <div className={`edge ${pred.edgeP1Set1 > 0 ? 'positive' : 'negative'}`}>
                {pred.edgeP1Set1 > 0 ? '+' : ''}{(pred.edgeP1Set1 * 100).toFixed(1)}% edge
              </div>
            )}
          </div>
          <div className="odds-item">
            <div className="label">{player2Name} Set 1</div>
            <div className="value">{fairOdds.player2Set1}</div>
            {pred.edgeP2Set1 !== undefined && (
              <div className={`edge ${pred.edgeP2Set1 > 0 ? 'positive' : 'negative'}`}>
                {pred.edgeP2Set1 > 0 ? '+' : ''}{(pred.edgeP2Set1 * 100).toFixed(1)}% edge
              </div>
            )}
          </div>
        </div>
        
        {/* Bet Recommendation */}
        {recommendation && (
          <div className={`bet-recommendation ${recommendation.action === 'BET' ? 'bet' : 'pass'}`}>
            <div className="bet-header">
              <div className="bet-action">
                {recommendation.action === 'BET' ? '✅ BET' : '❌ PASS'}
              </div>
              {recommendation.side && recommendation.side !== 'PASS' && (
                <div className="bet-side">{recommendation.side.replace('_', ' ')}</div>
              )}
            </div>
            
            {recommendation.action === 'BET' && (
              <div className="bet-details">
                <div className="bet-detail">
                  <div className="label">Edge</div>
                  <div className="value">{recommendation.edge}</div>
                </div>
                <div className="bet-detail">
                  <div className="label">Suggested Stake</div>
                  <div className="value">{recommendation.suggestedStake}</div>
                </div>
                <div className="bet-detail">
                  <div className="label">Kelly Sizing</div>
                  <div className="value">¼ Kelly</div>
                </div>
              </div>
            )}
            
            {recommendation.why && recommendation.why.length > 0 && (
              <div className="why-section">
                <h4>Why?</h4>
                <ul className="why-list">
                  {recommendation.why.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Model Details */}
        <div className="model-details">
          <div className="detail-section">
            <h4>Elo Ratings</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">{player1Name}</span>
                <span className="value">{pred.elo?.player1Rating?.toFixed(0) || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">{player2Name}</span>
                <span className="value">{pred.elo?.player2Rating?.toFixed(0) || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">Rating Diff</span>
                <span className="value">{pred.elo?.ratingDiff?.toFixed(0) || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">Elo Prob</span>
                <span className="value">{(pred.pElo * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          <div className="detail-section">
            <h4>Point Model</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">P1 Serve %</span>
                <span className="value">{(pred.pointModel?.player1Serve * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span className="label">P1 Return %</span>
                <span className="value">{(pred.pointModel?.player1Return * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span className="label">P2 Serve %</span>
                <span className="value">{(pred.pointModel?.player2Serve * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span className="label">P2 Return %</span>
                <span className="value">{(pred.pointModel?.player2Return * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          <div className="detail-section">
            <h4>Game Dynamics</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">P1 Hold %</span>
                <span className="value">{(pred.scoring?.pHold * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span className="label">P1 Break %</span>
                <span className="value">{(pred.scoring?.pBreak * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span className="label">Tiebreak %</span>
                <span className="value">{(pred.scoring?.pTiebreak * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span className="label">Point Model Prob</span>
                <span className="value">{(pred.pPoint * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResultsPanel;
