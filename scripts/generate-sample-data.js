/**
 * Sample Data Generator for Tennis Set Predictor
 * 
 * Generates realistic tennis data for testing since we don't have real odds feeds.
 * Creates:
 * - Players with realistic skill distributions
 * - Match results based on skill differences
 * - Realistic serve/return statistics
 * - Sample odds data
 */

import db from '../src/db/database.js';

// =============================================
// PLAYER GENERATION
// =============================================

const FIRST_NAMES_MALE = [
  'Carlos', 'Jannik', 'Daniil', 'Novak', 'Alexander', 'Andrey', 'Stefanos', 
  'Holger', 'Casper', 'Taylor', 'Hubert', 'Felix', 'Tommy', 'Ben', 'Grigor',
  'Frances', 'Sebastian', 'Ugo', 'Karen', 'Lorenzo', 'Denis', 'Cameron', 'Alex',
  'Jiri', 'Alejandro', 'Nicolas', 'Matteo', 'Roberto', 'Jan-Lennard', 'Arthur'
];

const LAST_NAMES_MALE = [
  'Alcaraz', 'Sinner', 'Medvedev', 'Djokovic', 'Zverev', 'Rublev', 'Tsitsipas',
  'Rune', 'Ruud', 'Fritz', 'Hurkacz', 'Auger-Aliassime', 'Paul', 'Shelton', 'Dimitrov',
  'Tiafoe', 'Korda', 'Humbert', 'Khachanov', 'Musetti', 'Shapovalov', 'Norrie', 'de Minaur',
  'Lehecka', 'Davidovich', 'Jarry', 'Berrettini', 'Carballes', 'Struff', 'Fils'
];

const FIRST_NAMES_FEMALE = [
  'Iga', 'Aryna', 'Coco', 'Elena', 'Jessica', 'Ons', 'Qinwen', 'Maria',
  'Jasmine', 'Daria', 'Karolina', 'Madison', 'Emma', 'Liudmila', 'Beatriz',
  'Jelena', 'Petra', 'Barbora', 'Danielle', 'Caroline', 'Ekaterina', 'Anna',
  'Veronika', 'Victoria', 'Donna', 'Paula', 'Leylah', 'Sloane', 'Amanda', 'Linda'
];

const LAST_NAMES_FEMALE = [
  'Swiatek', 'Sabalenka', 'Gauff', 'Rybakina', 'Pegula', 'Jabeur', 'Zheng', 'Sakkari',
  'Paolini', 'Kasatkina', 'Muchova', 'Keys', 'Navarro', 'Samsonova', 'Haddad',
  'Ostapenko', 'Kvitova', 'Krejcikova', 'Collins', 'Garcia', 'Alexandrova', 'Kalinskaya',
  'Kudermetova', 'Azarenka', 'Vekic', 'Badosa', 'Fernandez', 'Stephens', 'Anisimova', 'Noskova'
];

const COUNTRIES = ['ESP', 'ITA', 'RUS', 'SRB', 'GER', 'GRE', 'DEN', 'NOR', 'USA', 'POL', 'CAN', 'GBR', 'AUS', 'FRA', 'CZE', 'ARG', 'CHI', 'TUN', 'CHN', 'JPN', 'BRA'];

const SURFACES = ['Hard', 'Clay', 'Grass'];
const TOURNAMENTS = {
  Hard: ['Australian Open', 'US Open', 'Miami', 'Indian Wells', 'Toronto', 'Cincinnati'],
  Clay: ['French Open', 'Rome', 'Madrid', 'Barcelona', 'Monte Carlo'],
  Grass: ['Wimbledon', 'Queens', 'Halle', 'Eastbourne']
};

// =============================================
// PLAYER SKILL GENERATION
// =============================================

function generatePlayerSkills(tour) {
  const isATP = tour === 'ATP';
  
  const baseServe = isATP ? 0.65 : 0.58;
  const serveStd = isATP ? 0.04 : 0.05;
  const baseReturn = isATP ? 0.35 : 0.42;
  const returnStd = isATP ? 0.03 : 0.04;
  
  const talent = gaussian(0, 1);
  
  return {
    serveSkill: clamp(baseServe + talent * 0.03 + gaussian(0, serveStd), 0.45, 0.80),
    returnSkill: clamp(baseReturn + talent * 0.02 + gaussian(0, returnStd), 0.25, 0.55),
    firstServePct: clamp(gaussian(isATP ? 0.62 : 0.60, 0.05), 0.50, 0.75),
    firstServeWon: clamp(gaussian(isATP ? 0.73 : 0.65, 0.04), 0.60, 0.85),
    secondServeWon: clamp(gaussian(isATP ? 0.52 : 0.45, 0.05), 0.35, 0.65),
    aceRate: clamp(gaussian(isATP ? 0.08 : 0.04, 0.03), 0.01, 0.20),
    dfRate: clamp(gaussian(isATP ? 0.03 : 0.05, 0.015), 0.01, 0.10),
    consistency: clamp(gaussian(0.75, 0.10), 0.5, 0.95),
    surfaceStrength: {
      Hard: clamp(gaussian(1.0, 0.1), 0.8, 1.2),
      Clay: clamp(gaussian(1.0, 0.15), 0.7, 1.3),
      Grass: clamp(gaussian(1.0, 0.12), 0.75, 1.25)
    }
  };
}

function gaussian(mean, std) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// =============================================
// MATCH SIMULATION
// =============================================

function simulateMatch(player1Skills, player2Skills, surface, bestOf = 3) {
  const p1Surface = player1Skills.surfaceStrength[surface] || 1;
  const p2Surface = player2Skills.surfaceStrength[surface] || 1;
  
  const p1ServePoint = (player1Skills.serveSkill * p1Surface + (1 - player2Skills.returnSkill * p2Surface)) / 2;
  const p2ServePoint = (player2Skills.serveSkill * p2Surface + (1 - player1Skills.returnSkill * p1Surface)) / 2;
  
  const p1Var = gaussian(0, 0.03) * (1 - player1Skills.consistency);
  const p2Var = gaussian(0, 0.03) * (1 - player2Skills.consistency);
  
  const p1Effective = clamp(p1ServePoint + p1Var, 0.3, 0.85);
  const p2Effective = clamp(p2ServePoint + p2Var, 0.3, 0.85);
  
  const setsToWin = bestOf === 5 ? 3 : 2;
  let p1Sets = 0;
  let p2Sets = 0;
  const setScores = [];
  const stats = {
    p1: createEmptyStats(),
    p2: createEmptyStats()
  };
  
  while (p1Sets < setsToWin && p2Sets < setsToWin) {
    const setResult = simulateSet(p1Effective, p2Effective, stats);
    setScores.push([setResult.p1Games, setResult.p2Games]);
    
    if (setResult.p1Games > setResult.p2Games) {
      p1Sets++;
    } else {
      p2Sets++;
    }
  }
  
  return {
    winner: p1Sets > p2Sets ? 1 : 2,
    sets: [p1Sets, p2Sets],
    setScores,
    stats
  };
}

function simulateSet(p1ServeProb, p2ServeProb, stats) {
  let p1Games = 0;
  let p2Games = 0;
  let serverIsP1 = Math.random() < 0.5;
  
  while (true) {
    if (p1Games >= 6 && p1Games - p2Games >= 2) return { p1Games, p2Games };
    if (p2Games >= 6 && p2Games - p1Games >= 2) return { p1Games, p2Games };
    
    if (p1Games === 6 && p2Games === 6) {
      const tbWinner = simulateTiebreak(p1ServeProb, p2ServeProb, stats);
      if (tbWinner === 1) {
        return { p1Games: 7, p2Games: 6 };
      } else {
        return { p1Games: 6, p2Games: 7 };
      }
    }
    
    const serverProb = serverIsP1 ? p1ServeProb : p2ServeProb;
    const gameWinner = simulateGame(serverProb, serverIsP1, stats);
    
    if (gameWinner === 1) {
      p1Games++;
    } else {
      p2Games++;
    }
    
    if (serverIsP1) {
      stats.p1.serviceGamesTotal++;
      if (gameWinner === 1) stats.p1.serviceGamesWon++;
      stats.p2.returnGamesTotal++;
      if (gameWinner === 2) stats.p2.returnGamesWon++;
    } else {
      stats.p2.serviceGamesTotal++;
      if (gameWinner === 2) stats.p2.serviceGamesWon++;
      stats.p1.returnGamesTotal++;
      if (gameWinner === 1) stats.p1.returnGamesWon++;
    }
    
    serverIsP1 = !serverIsP1;
  }
}

function simulateGame(serverWinProb, serverIsP1, stats) {
  let serverPoints = 0;
  let returnerPoints = 0;
  
  while (true) {
    const serverWins = Math.random() < serverWinProb;
    
    const serverStats = serverIsP1 ? stats.p1 : stats.p2;
    const isFirstServe = Math.random() < 0.62;
    
    if (isFirstServe) {
      serverStats.firstServeIn++;
      if (serverWins) serverStats.firstServeWon++;
    } else {
      if (serverWins) serverStats.secondServeWon++;
      else serverStats.secondServeFault++;
    }
    
    if (serverWins) {
      serverPoints++;
    } else {
      returnerPoints++;
    }
    
    if (serverPoints >= 4 && serverPoints - returnerPoints >= 2) {
      return serverIsP1 ? 1 : 2;
    }
    if (returnerPoints >= 4 && returnerPoints - serverPoints >= 2) {
      return serverIsP1 ? 2 : 1;
    }
  }
}

function simulateTiebreak(p1ServeProb, p2ServeProb, stats) {
  let p1Points = 0;
  let p2Points = 0;
  let serverIsP1 = true;
  let pointsPlayed = 0;
  
  while (true) {
    const serverProb = serverIsP1 ? p1ServeProb : p2ServeProb;
    const serverWins = Math.random() < serverProb;
    
    if (serverWins) {
      if (serverIsP1) p1Points++; else p2Points++;
    } else {
      if (serverIsP1) p2Points++; else p1Points++;
    }
    
    if (p1Points >= 7 && p1Points - p2Points >= 2) return 1;
    if (p2Points >= 7 && p2Points - p1Points >= 2) return 2;
    
    pointsPlayed++;
    if (pointsPlayed === 1 || pointsPlayed % 2 === 1) {
      serverIsP1 = !serverIsP1;
    }
  }
}

function createEmptyStats() {
  return {
    firstServeIn: 0,
    firstServeWon: 0,
    secondServeWon: 0,
    secondServeFault: 0,
    aces: 0,
    doubleFaults: 0,
    serviceGamesWon: 0,
    serviceGamesTotal: 0,
    returnGamesWon: 0,
    returnGamesTotal: 0
  };
}

// =============================================
// ODDS GENERATION
// =============================================

function generateOdds(p1WinProb, vig = 0.05) {
  const adjustedP1 = p1WinProb * (1 + vig / 2);
  const adjustedP2 = (1 - p1WinProb) * (1 + vig / 2);
  
  const odds1 = 1 / adjustedP1;
  const odds2 = 1 / adjustedP2;
  
  const noise1 = 1 + gaussian(0, 0.02);
  const noise2 = 1 + gaussian(0, 0.02);
  
  return {
    ml_p1: Math.round(odds1 * noise1 * 100) / 100,
    ml_p2: Math.round(odds2 * noise2 * 100) / 100,
    set1_p1: Math.round((odds1 * 0.95 + 0.1) * noise1 * 100) / 100,
    set1_p2: Math.round((odds2 * 0.95 + 0.1) * noise2 * 100) / 100,
    vig
  };
}

// =============================================
// MAIN GENERATION
// =============================================

async function generateSampleData(options = {}) {
  const {
    numATPPlayers = 50,
    numWTAPlayers = 50,
    numATPMatches = 1000,
    numWTAMatches = 1000,
    startYear = 2022,
    endYear = 2025
  } = options;
  
  console.log('Initializing database...');
  await db.initDb();
  
  // Generate ATP players
  console.log(`Generating ${numATPPlayers} ATP players...`);
  const atpPlayers = [];
  for (let i = 0; i < numATPPlayers; i++) {
    const firstName = FIRST_NAMES_MALE[i % FIRST_NAMES_MALE.length];
    const lastName = LAST_NAMES_MALE[i % LAST_NAMES_MALE.length];
    const playerId = `atp_${firstName.toLowerCase()}_${lastName.toLowerCase()}`.replace(/[^a-z0-9_]/g, '');
    
    const player = {
      player_id: playerId,
      name: `${firstName} ${lastName}`,
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      hand: Math.random() < 0.88 ? 'R' : 'L',
      birth_year: 1990 + Math.floor(Math.random() * 15),
      skills: generatePlayerSkills('ATP')
    };
    
    db.upsertPlayer('ATP', player);
    atpPlayers.push(player);
  }
  
  // Generate WTA players
  console.log(`Generating ${numWTAPlayers} WTA players...`);
  const wtaPlayers = [];
  for (let i = 0; i < numWTAPlayers; i++) {
    const firstName = FIRST_NAMES_FEMALE[i % FIRST_NAMES_FEMALE.length];
    const lastName = LAST_NAMES_FEMALE[i % LAST_NAMES_FEMALE.length];
    const playerId = `wta_${firstName.toLowerCase()}_${lastName.toLowerCase()}`.replace(/[^a-z0-9_]/g, '');
    
    const player = {
      player_id: playerId,
      name: `${firstName} ${lastName}`,
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      hand: Math.random() < 0.88 ? 'R' : 'L',
      birth_year: 1995 + Math.floor(Math.random() * 12),
      skills: generatePlayerSkills('WTA')
    };
    
    db.upsertPlayer('WTA', player);
    wtaPlayers.push(player);
  }
  
  // Generate ATP matches
  console.log(`Generating ${numATPMatches} ATP matches...`);
  generateMatches('ATP', atpPlayers, numATPMatches, startYear, endYear);
  
  // Generate WTA matches
  console.log(`Generating ${numWTAMatches} WTA matches...`);
  generateMatches('WTA', wtaPlayers, numWTAMatches, startYear, endYear);
  
  console.log('Sample data generation complete!');
  db.closeDb();
}

function generateMatches(tour, players, numMatches, startYear, endYear) {
  const daysInRange = (endYear - startYear) * 365;
  
  for (let i = 0; i < numMatches; i++) {
    const daysOffset = Math.floor(Math.random() * daysInRange);
    const date = new Date(startYear, 0, 1 + daysOffset);
    const dateStr = date.toISOString().split('T')[0];
    
    const p1Idx = Math.floor(Math.random() * players.length);
    let p2Idx = Math.floor(Math.random() * players.length);
    while (p2Idx === p1Idx) p2Idx = Math.floor(Math.random() * players.length);
    
    const player1 = players[p1Idx];
    const player2 = players[p2Idx];
    
    const surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
    const tournament = TOURNAMENTS[surface][Math.floor(Math.random() * TOURNAMENTS[surface].length)];
    const isSlam = tournament.includes('Open') || tournament === 'Wimbledon';
    const bestOf = (tour === 'ATP' && isSlam) ? 5 : 3;
    
    const result = simulateMatch(player1.skills, player2.skills, surface, bestOf);
    const winnerId = result.winner === 1 ? player1.player_id : player2.player_id;
    
    const scoreStr = result.setScores.map(s => `${s[0]}-${s[1]}`).join(' ');
    
    const p1Stats = result.stats.p1;
    const p2Stats = result.stats.p2;
    const totalP1FirstServe = p1Stats.firstServeIn + p1Stats.secondServeFault;
    const totalP2FirstServe = p2Stats.firstServeIn + p2Stats.secondServeFault;
    
    const match = {
      match_id: `${tour.toLowerCase()}_${dateStr}_${i}`,
      tour,
      date: dateStr,
      tournament,
      tournament_level: isSlam ? 'G' : 'M',
      surface,
      indoor: 0,
      round: 'R32',
      best_of: bestOf,
      player1_id: player1.player_id,
      player2_id: player2.player_id,
      winner_id: winnerId,
      score: scoreStr,
      sets_p1: result.sets[0],
      sets_p2: result.sets[1],
      games_p1: result.setScores.reduce((sum, s) => sum + s[0], 0),
      games_p2: result.setScores.reduce((sum, s) => sum + s[1], 0),
      set1_p1: result.setScores[0][0],
      set1_p2: result.setScores[0][1],
      set2_p1: result.setScores[1] ? result.setScores[1][0] : null,
      set2_p2: result.setScores[1] ? result.setScores[1][1] : null,
      set3_p1: result.setScores[2] ? result.setScores[2][0] : null,
      set3_p2: result.setScores[2] ? result.setScores[2][1] : null,
      p1_first_serve_pct: totalP1FirstServe > 0 ? p1Stats.firstServeIn / totalP1FirstServe : 0.62,
      p1_first_serve_won_pct: p1Stats.firstServeIn > 0 ? p1Stats.firstServeWon / p1Stats.firstServeIn : 0.70,
      p1_second_serve_won_pct: p1Stats.secondServeFault > 0 ? p1Stats.secondServeWon / (p1Stats.secondServeFault + p1Stats.secondServeWon) : 0.50,
      p1_service_games_won: p1Stats.serviceGamesWon,
      p1_service_games_total: p1Stats.serviceGamesTotal,
      p1_first_return_won_pct: 1 - (p2Stats.firstServeIn > 0 ? p2Stats.firstServeWon / p2Stats.firstServeIn : 0.70),
      p1_second_return_won_pct: 1 - (p2Stats.secondServeFault > 0 ? p2Stats.secondServeWon / (p2Stats.secondServeFault + p2Stats.secondServeWon) : 0.50),
      p1_return_games_won: p1Stats.returnGamesWon,
      p1_return_games_total: p1Stats.returnGamesTotal,
      p2_first_serve_pct: totalP2FirstServe > 0 ? p2Stats.firstServeIn / totalP2FirstServe : 0.62,
      p2_first_serve_won_pct: p2Stats.firstServeIn > 0 ? p2Stats.firstServeWon / p2Stats.firstServeIn : 0.70,
      p2_second_serve_won_pct: p2Stats.secondServeFault > 0 ? p2Stats.secondServeWon / (p2Stats.secondServeFault + p2Stats.secondServeWon) : 0.50,
      p2_service_games_won: p2Stats.serviceGamesWon,
      p2_service_games_total: p2Stats.serviceGamesTotal,
      p2_first_return_won_pct: 1 - (p1Stats.firstServeIn > 0 ? p1Stats.firstServeWon / p1Stats.firstServeIn : 0.70),
      p2_second_return_won_pct: 1 - (p1Stats.secondServeFault > 0 ? p1Stats.secondServeWon / (p1Stats.secondServeFault + p1Stats.secondServeWon) : 0.50),
      p2_return_games_won: p2Stats.returnGamesWon,
      p2_return_games_total: p2Stats.returnGamesTotal,
      retirement: 0,
      walkover: 0
    };
    
    db.insertMatch(tour, match);
    
    const p1TrueProb = player1.skills.serveSkill / (player1.skills.serveSkill + player2.skills.serveSkill);
    const odds = generateOdds(p1TrueProb);
    
    db.insertOdds(tour, {
      match_id: match.match_id,
      timestamp: dateStr + 'T12:00:00Z',
      source: 'simulated',
      ...odds,
      implied_p1: 1 / odds.ml_p1,
      implied_p2: 1 / odds.ml_p2,
      implied_set1_p1: 1 / odds.set1_p1,
      implied_set1_p2: 1 / odds.set1_p2
    });
  }
}

// Run
generateSampleData({
  numATPPlayers: 50,
  numWTAPlayers: 50,
  numATPMatches: 1500,
  numWTAMatches: 1500,
  startYear: 2022,
  endYear: 2026
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
