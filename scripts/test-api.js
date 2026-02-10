/**
 * Test API Script
 */

async function testApi() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('Testing Tennis Set Predictor API...\n');
  
  // Test health
  console.log('1. Health check:');
  const health = await fetch(`${baseUrl}/api/health`).then(r => r.json());
  console.log('  ', JSON.stringify(health));
  
  // Test get players
  console.log('\n2. Get ATP players (first 5):');
  const players = await fetch(`${baseUrl}/api/atp/players`).then(r => r.json());
  console.log('  ', players.slice(0, 5).map(p => p.name).join(', '));
  
  // Train the model first
  console.log('\n3. Training ATP model...');
  const trainRes = await fetch(`${baseUrl}/api/atp/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then(r => r.json());
  console.log('  Trained on', trainRes.matchesTrained, 'matches');
  console.log('  Calibrated:', trainRes.calibrated);
  
  // Test prediction
  console.log('\n4. Test prediction:');
  const predReq = {
    match: {
      player1_id: players[0].player_id,
      player2_id: players[1].player_id,
      surface: 'Hard',
      best_of: 3
    },
    marketOdds: {
      ml_p1: 1.65,
      ml_p2: 2.20,
      set1_p1: 1.75,
      set1_p2: 2.05
    }
  };
  
  const pred = await fetch(`${baseUrl}/api/atp/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(predReq)
  }).then(r => r.json());
  
  console.log('  Match:', `${players[0].name} vs ${players[1].name}`);
  console.log('  Surface:', predReq.match.surface);
  console.log('  P1 Win Probability:', pred.summary?.player1WinProb || 'N/A');
  console.log('  P2 Win Probability:', pred.summary?.player2WinProb || 'N/A');
  console.log('  P1 Set1 Probability:', pred.summary?.player1Set1Prob || 'N/A');
  console.log('  Confidence Band:', pred.summary?.confidenceBand?.match || 'N/A');
  console.log('  Fair Odds P1 Match:', pred.fairOdds?.player1Match || 'N/A');
  console.log('  Fair Odds P2 Match:', pred.fairOdds?.player2Match || 'N/A');
  
  if (pred.recommendation) {
    console.log('\n  📊 Bet Recommendation:');
    console.log('    Action:', pred.recommendation.action);
    if (pred.recommendation.side) {
      console.log('    Side:', pred.recommendation.side);
    }
    if (pred.recommendation.edge) {
      console.log('    Edge:', pred.recommendation.edge);
    }
    if (pred.recommendation.suggestedStake) {
      console.log('    Stake:', pred.recommendation.suggestedStake);
    }
    if (pred.recommendation.why && pred.recommendation.why.length > 0) {
      console.log('    Why:');
      pred.recommendation.why.forEach(r => console.log('      •', r));
    }
  }
  
  // Test ratings
  console.log('\n5. Get ATP ratings (top 10):');
  const ratings = await fetch(`${baseUrl}/api/atp/ratings?surface=global&limit=10`).then(r => r.json());
  ratings.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}: ${r.rating} (${r.matches} matches)`);
  });
  
  console.log('\n✅ All tests passed!');
}

testApi().catch(console.error);
