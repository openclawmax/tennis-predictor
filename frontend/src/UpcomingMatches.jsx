import React, { useState } from 'react';

function UpcomingMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Import the prediction check function
      const response = await fetch('/api/upcoming-matches');
      
      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }
      
      const data = await response.json();
      setMatches(data.matches || []);
      setLastUpdate(new Date().toLocaleString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px', borderBottom: '2px solid #2c5282', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '32px', color: '#1a365d', marginBottom: '10px' }}>
          🎾 Tennis Predictions
        </h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button 
            onClick={fetchMatches}
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: loading ? '#cbd5e0' : '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Update Matches'}
          </button>
          {lastUpdate && (
            <span style={{ color: '#718096', fontSize: '14px' }}>
              Last updated: {lastUpdate}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fed7d7',
          border: '1px solid #fc8181',
          borderRadius: '6px',
          color: '#742a2a',
          marginBottom: '20px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {matches.length === 0 && !loading && !error && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f7fafc',
          borderRadius: '8px',
          color: '#4a5568'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>No upcoming matches found</p>
          <p style={{ fontSize: '14px', color: '#718096' }}>
            Click "Update Matches" to fetch matches in the optimal betting window (3-12 hours from now)
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        {matches.map((match, idx) => (
          <div 
            key={idx}
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '15px'
            }}>
              <div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#718096', 
                  fontWeight: '600',
                  marginBottom: '8px' 
                }}>
                  {match.sport}
                </div>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: '#2d3748',
                  marginBottom: '5px' 
                }}>
                  {match.player1} vs {match.player2}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#4a5568' 
                }}>
                  📅 {match.matchTime}
                </div>
              </div>
              {match.shouldBet && (
                <span style={{
                  padding: '6px 12px',
                  backgroundColor: '#c6f6d5',
                  color: '#22543d',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  ✓ RECOMMENDED
                </span>
              )}
            </div>

            <div style={{
              backgroundColor: '#f7fafc',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '15px'
            }}>
              <div style={{ 
                fontSize: '14px', 
                color: '#4a5568',
                marginBottom: '8px' 
              }}>
                ✅ <strong>Prediction:</strong> {match.favorite}
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#4a5568',
                marginBottom: '8px' 
              }}>
                📊 <strong>Confidence:</strong> {match.confidence}%
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#4a5568' 
              }}>
                💰 <strong>Odds:</strong> {match.player1} ({match.odds.player1}) | {match.player2} ({match.odds.player2})
              </div>
            </div>

            {!match.shouldBet && (
              <div style={{
                fontSize: '13px',
                color: '#718096',
                fontStyle: 'italic'
              }}>
                ℹ️ Low confidence - tracking only
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default UpcomingMatches;
