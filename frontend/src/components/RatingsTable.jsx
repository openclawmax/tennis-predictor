import React from 'react';

// Simple country to flag emoji mapping
const countryFlags = {
  'ESP': '🇪🇸', 'ITA': '🇮🇹', 'RUS': '🇷🇺', 'SRB': '🇷🇸', 'GER': '🇩🇪',
  'GRE': '🇬🇷', 'DEN': '🇩🇰', 'NOR': '🇳🇴', 'USA': '🇺🇸', 'POL': '🇵🇱',
  'CAN': '🇨🇦', 'GBR': '🇬🇧', 'AUS': '🇦🇺', 'FRA': '🇫🇷', 'CZE': '🇨🇿',
  'ARG': '🇦🇷', 'CHI': '🇨🇱', 'TUN': '🇹🇳', 'CHN': '🇨🇳', 'JPN': '🇯🇵',
  'BRA': '🇧🇷', 'BEL': '🇧🇪', 'NED': '🇳🇱', 'SUI': '🇨🇭', 'KAZ': '🇰🇿'
};

function RatingsTable({ ratings, tour, surface }) {
  if (!ratings || ratings.length === 0) {
    return (
      <div className="card ratings-section">
        <h2 className="card-header">🏆 {tour} Elo Rankings ({surface})</h2>
        <div className="empty-state">
          <span>📊</span>
          <p>No rating data available.<br/>Generate sample data to see rankings.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card ratings-section">
      <h2 className="card-header">🏆 {tour} Elo Rankings ({surface})</h2>
      
      <table className="ratings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Elo Rating</th>
            <th>Matches</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((player, idx) => (
            <tr key={player.playerId}>
              <td className="rank-cell">{idx + 1}</td>
              <td className="player-cell">
                <span className="country-flag">
                  {countryFlags[player.country] || '🏳️'}
                </span>
                {player.name || player.playerId}
              </td>
              <td className="rating-cell">{player.rating}</td>
              <td>{player.matches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RatingsTable;
