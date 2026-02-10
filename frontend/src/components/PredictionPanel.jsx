import React from 'react';

function PredictionPanel({
  players,
  player1,
  player2,
  setPlayer1,
  setPlayer2,
  surface,
  setSurface,
  bestOf,
  setBestOf,
  odds,
  setOdds,
  onPredict,
  loading,
  tour
}) {
  return (
    <div className="card">
      <h2 className="card-header">
        📊 Match Prediction
      </h2>
      
      <div className="match-input">
        {/* Player 1 Selection */}
        <div className="player-select">
          <label>Player 1</label>
          <select 
            value={player1} 
            onChange={(e) => setPlayer1(e.target.value)}
          >
            <option value="">Select player...</option>
            {players.map(p => (
              <option key={p.player_id} value={p.player_id}>
                {p.name} ({p.country})
              </option>
            ))}
          </select>
        </div>
        
        <div className="vs-divider">VS</div>
        
        {/* Player 2 Selection */}
        <div className="player-select">
          <label>Player 2</label>
          <select 
            value={player2} 
            onChange={(e) => setPlayer2(e.target.value)}
          >
            <option value="">Select player...</option>
            {players.filter(p => p.player_id !== player1).map(p => (
              <option key={p.player_id} value={p.player_id}>
                {p.name} ({p.country})
              </option>
            ))}
          </select>
        </div>
        
        {/* Surface Selection */}
        <div className="player-select">
          <label>Surface</label>
          <div className="surface-options">
            {['Hard', 'Clay', 'Grass'].map(s => (
              <button
                key={s}
                className={`surface-btn ${surface === s ? `active ${s.toLowerCase()}` : ''}`}
                onClick={() => setSurface(s)}
              >
                {s === 'Hard' && '🔵 '}
                {s === 'Clay' && '🟤 '}
                {s === 'Grass' && '🟢 '}
                {s}
              </button>
            ))}
          </div>
        </div>
        
        {/* Best Of Selection */}
        <div className="player-select">
          <label>Match Format</label>
          <div className="surface-options">
            <button
              className={`surface-btn ${bestOf === 3 ? 'active hard' : ''}`}
              onClick={() => setBestOf(3)}
            >
              Best of 3
            </button>
            <button
              className={`surface-btn ${bestOf === 5 ? 'active hard' : ''}`}
              onClick={() => setBestOf(5)}
            >
              Best of 5
            </button>
          </div>
        </div>
        
        {/* Market Odds (Optional) */}
        <div className="player-select">
          <label>Market Odds (Optional - for edge calculation)</label>
          <div className="odds-input">
            <div className="odds-group">
              <label>P1 Match</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 1.65"
                value={odds.ml_p1}
                onChange={(e) => setOdds({...odds, ml_p1: e.target.value})}
              />
            </div>
            <div className="odds-group">
              <label>P2 Match</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 2.20"
                value={odds.ml_p2}
                onChange={(e) => setOdds({...odds, ml_p2: e.target.value})}
              />
            </div>
            <div className="odds-group">
              <label>P1 Set 1</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 1.75"
                value={odds.set1_p1}
                onChange={(e) => setOdds({...odds, set1_p1: e.target.value})}
              />
            </div>
            <div className="odds-group">
              <label>P2 Set 1</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 2.05"
                value={odds.set1_p2}
                onChange={(e) => setOdds({...odds, set1_p2: e.target.value})}
              />
            </div>
          </div>
        </div>
        
        {/* Predict Button */}
        <button 
          className="predict-btn"
          onClick={onPredict}
          disabled={loading || !player1 || !player2}
        >
          {loading ? 'Calculating...' : '🎯 Generate Prediction'}
        </button>
      </div>
    </div>
  );
}

export default PredictionPanel;
