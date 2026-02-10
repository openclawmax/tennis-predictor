import React, { useState, useEffect } from 'react';
import PredictionPanel from './components/PredictionPanel';
import ResultsPanel from './components/ResultsPanel';
import RatingsTable from './components/RatingsTable';

const API_BASE = '/api';

function App() {
  const [tour, setTour] = useState('ATP');
  const [players, setPlayers] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Odds API state
  const [apiKey, setApiKey] = useState(localStorage.getItem('oddsApiKey') || '');
  const [oddsStatus, setOddsStatus] = useState(null);
  const [updatingOdds, setUpdatingOdds] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  
  // Match input state
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [surface, setSurface] = useState('Hard');
  const [bestOf, setBestOf] = useState(3);
  const [odds, setOdds] = useState({
    ml_p1: '',
    ml_p2: '',
    set1_p1: '',
    set1_p2: ''
  });
  
  // Load players and ratings when tour changes
  useEffect(() => {
    loadPlayers();
    loadRatings();
    setPrediction(null);
    setPlayer1('');
    setPlayer2('');
  }, [tour]);
  
  async function loadPlayers() {
    try {
      const res = await fetch(`${API_BASE}/${tour}/players`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (err) {
      console.error('Failed to load players:', err);
    }
  }
  
  async function loadRatings() {
    try {
      const res = await fetch(`${API_BASE}/${tour}/ratings?surface=${surface}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setRatings(data);
      }
    } catch (err) {
      console.error('Failed to load ratings:', err);
    }
  }
  
  async function configureOddsApi() {
    if (!apiKey) {
      setError('Please enter an API key');
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/odds/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      if (res.ok) {
        localStorage.setItem('oddsApiKey', apiKey);
        setShowApiConfig(false);
        setError(null);
        alert('API configured successfully!');
        checkOddsStatus();
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (err) {
      setError('Failed to configure API: ' + err.message);
    }
  }
  
  async function checkOddsStatus() {
    try {
      const res = await fetch(`${API_BASE}/odds/status`);
      if (res.ok) {
        const data = await res.json();
        setOddsStatus(data);
      }
    } catch (err) {
      console.error('Failed to check odds status:', err);
    }
  }
  
  async function updateOdds() {
    if (!apiKey) {
      setError('Please configure API key first');
      setShowApiConfig(true);
      return;
    }
    
    setUpdatingOdds(true);
    setError(null);
    
    try {
      // First configure if not already done
      await fetch(`${API_BASE}/odds/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      // Then update
      const res = await fetch(`${API_BASE}/odds/update`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      
      const data = await res.json();
      
      // Reload players and show success
      await loadPlayers();
      alert(`Updated successfully!\nATP: ${data.atp.stored} matches\nWTA: ${data.wta.stored} matches\nAPI Requests Remaining: ${data.quota.remaining || 'Unknown'}`);
      
      checkOddsStatus();
    } catch (err) {
      setError('Odds update failed: ' + err.message);
    } finally {
      setUpdatingOdds(false);
    }
  }
  
  useEffect(() => {
    if (apiKey) {
      checkOddsStatus();
    }
  }, []);
  
  async function handlePredict() {
    if (!player1 || !player2) {
      setError('Please select both players');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const marketOdds = {
        ml_p1: odds.ml_p1 ? parseFloat(odds.ml_p1) : null,
        ml_p2: odds.ml_p2 ? parseFloat(odds.ml_p2) : null,
        set1_p1: odds.set1_p1 ? parseFloat(odds.set1_p1) : null,
        set1_p2: odds.set1_p2 ? parseFloat(odds.set1_p2) : null
      };
      
      const res = await fetch(`${API_BASE}/${tour}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: {
            player1_id: player1,
            player2_id: player2,
            surface,
            best_of: bestOf
          },
          marketOdds: Object.values(marketOdds).some(v => v) ? marketOdds : null
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Prediction failed');
      }
      
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  const player1Name = players.find(p => p.player_id === player1)?.name || 'Player 1';
  const player2Name = players.find(p => p.player_id === player2)?.name || 'Player 2';
  
  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>🎾</span>
          Tennis Set Predictor
        </h1>
        <div className="header-controls">
          <div className="tour-tabs">
            <button 
              className={`tour-tab ${tour === 'ATP' ? 'active' : ''}`}
              onClick={() => setTour('ATP')}
            >
              ATP
            </button>
            <button 
              className={`tour-tab ${tour === 'WTA' ? 'active' : ''}`}
              onClick={() => setTour('WTA')}
            >
              WTA
            </button>
          </div>
          <div className="odds-controls">
            <button 
              className="btn-update-odds"
              onClick={updateOdds}
              disabled={updatingOdds}
            >
              {updatingOdds ? '⏳ Updating...' : '🔄 Update Live Odds'}
            </button>
            <button 
              className="btn-config"
              onClick={() => setShowApiConfig(true)}
              title="Configure API Key"
            >
              ⚙️
            </button>
            {oddsStatus && oddsStatus.quota && (
              <span className="quota-info">
                API: {oddsStatus.quota.remaining || '?'} requests left
              </span>
            )}
          </div>
        </div>
      </header>
      
      {showApiConfig && (
        <div className="modal-overlay" onClick={() => setShowApiConfig(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Configure Odds API</h2>
            <p>Get your free API key at: <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer">the-odds-api.com</a></p>
            <input
              type="text"
              placeholder="Enter API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="api-key-input"
            />
            <div className="modal-actions">
              <button onClick={configureOddsApi} className="btn-primary">
                Save
              </button>
              <button onClick={() => setShowApiConfig(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="error">
          {error}
        </div>
      )}
      
      <div className="main-content">
        <PredictionPanel
          players={players}
          player1={player1}
          player2={player2}
          setPlayer1={setPlayer1}
          setPlayer2={setPlayer2}
          surface={surface}
          setSurface={setSurface}
          bestOf={bestOf}
          setBestOf={setBestOf}
          odds={odds}
          setOdds={setOdds}
          onPredict={handlePredict}
          loading={loading}
          tour={tour}
        />
        
        <ResultsPanel
          prediction={prediction}
          player1Name={player1Name}
          player2Name={player2Name}
          loading={loading}
        />
      </div>
      
      <RatingsTable
        ratings={ratings}
        tour={tour}
        surface={surface}
      />
    </div>
  );
}

export default App;
