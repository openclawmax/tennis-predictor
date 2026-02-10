/**
 * Database Connection and Operations using sql.js
 * Pure JavaScript SQLite implementation
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import schema from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let SQL = null;
let db = null;
let dbPath = null;

/**
 * Initialize SQL.js and get/create database
 */
export async function getDb(path = null) {
  if (db) return db;
  
  // Initialize SQL.js
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  dbPath = path || join(__dirname, '../../data/tennis.db');
  
  // Create data directory if needed
  const dataDir = dirname(dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  
  // Load or create database
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

/**
 * Initialize database with schema
 */
export async function initDb(path = null) {
  const database = await getDb(path);
  database.run(schema);
  saveDb();
  console.log('Database initialized successfully');
  return database;
}

/**
 * Save database to file
 */
export function saveDb() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

/**
 * Close database connection
 */
export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

/**
 * Helper to run a query and return results as array of objects
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

/**
 * Helper to run a query and return first result
 */
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results[0] || null;
}

/**
 * Helper to run an insert/update statement
 */
function run(sql, params = []) {
  db.run(sql, params);
  return { changes: db.getRowsModified() };
}

// =============================================
// PLAYER OPERATIONS
// =============================================

export function upsertPlayer(tour, player) {
  const table = tour === 'ATP' ? 'atp_players' : 'wta_players';
  const sql = `
    INSERT INTO ${table} (player_id, name, country, hand, birth_year)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      name = excluded.name,
      country = COALESCE(excluded.country, ${table}.country),
      hand = COALESCE(excluded.hand, ${table}.hand),
      birth_year = COALESCE(excluded.birth_year, ${table}.birth_year),
      updated_at = CURRENT_TIMESTAMP
  `;
  run(sql, [player.player_id, player.name, player.country, player.hand, player.birth_year]);
  saveDb();
}

export function getPlayer(tour, playerId) {
  const table = tour === 'ATP' ? 'atp_players' : 'wta_players';
  return queryOne(`SELECT * FROM ${table} WHERE player_id = ?`, [playerId]);
}

export function getAllPlayers(tour) {
  const table = tour === 'ATP' ? 'atp_players' : 'wta_players';
  return queryAll(`SELECT * FROM ${table} ORDER BY name`);
}

// =============================================
// MATCH OPERATIONS
// =============================================

export function insertMatch(tour, match) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  const columns = Object.keys(match);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => match[k]);
  
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  run(sql, values);
  saveDb();
}

export function getMatch(tour, matchId) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  return queryOne(`SELECT * FROM ${table} WHERE match_id = ?`, [matchId]);
}

export function getMatchesByDateRange(tour, startDate, endDate) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  return queryAll(`
    SELECT * FROM ${table} 
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `, [startDate, endDate]);
}

export function getMatchesBySurface(tour, surface, limit = 1000) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  return queryAll(`
    SELECT * FROM ${table} 
    WHERE surface = ?
    ORDER BY date DESC
    LIMIT ?
  `, [surface, limit]);
}

export function getPlayerMatches(tour, playerId, limit = 100) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  return queryAll(`
    SELECT * FROM ${table} 
    WHERE player1_id = ? OR player2_id = ?
    ORDER BY date DESC
    LIMIT ?
  `, [playerId, playerId, limit]);
}

export function getPlayerMatchesBySurface(tour, playerId, surface, limit = 50) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  return queryAll(`
    SELECT * FROM ${table} 
    WHERE (player1_id = ? OR player2_id = ?) AND surface = ?
    ORDER BY date DESC
    LIMIT ?
  `, [playerId, playerId, surface, limit]);
}

export function getHeadToHead(tour, player1Id, player2Id) {
  const table = tour === 'ATP' ? 'atp_matches' : 'wta_matches';
  return queryAll(`
    SELECT * FROM ${table} 
    WHERE (player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?)
    ORDER BY date DESC
  `, [player1Id, player2Id, player2Id, player1Id]);
}

// =============================================
// ODDS OPERATIONS
// =============================================

export function insertOdds(tour, odds) {
  const table = tour === 'ATP' ? 'atp_odds' : 'wta_odds';
  const columns = Object.keys(odds).filter(k => k !== 'odds_id');
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => odds[k]);
  
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  run(sql, values);
  saveDb();
}

export function getOddsForMatch(tour, matchId) {
  const table = tour === 'ATP' ? 'atp_odds' : 'wta_odds';
  return queryOne(`
    SELECT * FROM ${table} 
    WHERE match_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `, [matchId]);
}

export function getClosingOdds(tour, matchId) {
  return getOddsForMatch(tour, matchId);
}

// =============================================
// ELO OPERATIONS
// =============================================

export function upsertEloRating(tour, rating) {
  const table = tour === 'ATP' ? 'atp_elo_ratings' : 'wta_elo_ratings';
  const sql = `
    INSERT INTO ${table} (player_id, date, elo_global, elo_hard, elo_clay, elo_grass,
                          matches_global, matches_hard, matches_clay, matches_grass)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  run(sql, [
    rating.player_id, rating.date, rating.elo_global, rating.elo_hard, 
    rating.elo_clay, rating.elo_grass, rating.matches_global, 
    rating.matches_hard, rating.matches_clay, rating.matches_grass
  ]);
  saveDb();
}

export function getLatestElo(tour, playerId, beforeDate = null) {
  const table = tour === 'ATP' ? 'atp_elo_ratings' : 'wta_elo_ratings';
  
  if (beforeDate) {
    return queryOne(`
      SELECT * FROM ${table} 
      WHERE player_id = ? AND date < ?
      ORDER BY date DESC
      LIMIT 1
    `, [playerId, beforeDate]);
  }
  
  return queryOne(`
    SELECT * FROM ${table} 
    WHERE player_id = ?
    ORDER BY date DESC
    LIMIT 1
  `, [playerId]);
}

// =============================================
// PLAYER SKILLS OPERATIONS
// =============================================

export function upsertPlayerSkills(tour, skills) {
  const table = tour === 'ATP' ? 'atp_player_skills' : 'wta_player_skills';
  const columns = Object.keys(skills).filter(k => k !== 'skill_id');
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => skills[k]);
  
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  run(sql, values);
  saveDb();
}

export function getLatestPlayerSkills(tour, playerId, surface = null, beforeDate = null) {
  const table = tour === 'ATP' ? 'atp_player_skills' : 'wta_player_skills';
  
  let sql = `SELECT * FROM ${table} WHERE player_id = ?`;
  const params = [playerId];
  
  if (surface) {
    sql += ` AND surface = ?`;
    params.push(surface);
  }
  
  if (beforeDate) {
    sql += ` AND date < ?`;
    params.push(beforeDate);
  }
  
  sql += ` ORDER BY date DESC LIMIT 1`;
  
  return queryOne(sql, params);
}

// =============================================
// PREDICTIONS OPERATIONS
// =============================================

export function insertPrediction(prediction) {
  const columns = Object.keys(prediction).filter(k => k !== 'prediction_id');
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => prediction[k]);
  
  const sql = `INSERT INTO predictions (${columns.join(', ')}) VALUES (${placeholders})`;
  run(sql, values);
  saveDb();
}

export function getPrediction(matchId) {
  return queryOne(`
    SELECT * FROM predictions 
    WHERE match_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `, [matchId]);
}

// =============================================
// BACKTEST OPERATIONS
// =============================================

export function insertBacktestResult(result) {
  const columns = Object.keys(result).filter(k => k !== 'result_id');
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => result[k]);
  
  const sql = `INSERT INTO backtest_results (${columns.join(', ')}) VALUES (${placeholders})`;
  run(sql, values);
  saveDb();
}

export function getBacktestResults(runId) {
  return queryAll(`
    SELECT * FROM backtest_results 
    WHERE run_id = ?
    ORDER BY created_at
  `, [runId]);
}

export function getBacktestSummary(runId) {
  return queryAll(`
    SELECT 
      tour,
      COUNT(*) as total_predictions,
      SUM(CASE WHEN match_correct = 1 THEN 1 ELSE 0 END) as match_correct_count,
      SUM(CASE WHEN set1_correct = 1 THEN 1 ELSE 0 END) as set1_correct_count,
      SUM(CASE WHEN bet_placed = 1 THEN 1 ELSE 0 END) as bets_placed,
      SUM(pnl) as total_pnl,
      AVG(log_loss_match) as avg_log_loss_match,
      AVG(log_loss_set1) as avg_log_loss_set1,
      AVG(roi) as avg_roi
    FROM backtest_results
    WHERE run_id = ?
    GROUP BY tour
  `, [runId]);
}

export default {
  getDb,
  initDb,
  saveDb,
  closeDb,
  upsertPlayer,
  getPlayer,
  getAllPlayers,
  insertMatch,
  getMatch,
  getMatchesByDateRange,
  getMatchesBySurface,
  getPlayerMatches,
  getPlayerMatchesBySurface,
  getHeadToHead,
  insertOdds,
  getOddsForMatch,
  getClosingOdds,
  upsertEloRating,
  getLatestElo,
  upsertPlayerSkills,
  getLatestPlayerSkills,
  insertPrediction,
  getPrediction,
  insertBacktestResult,
  getBacktestResults,
  getBacktestSummary
};
