/**
 * Database Schema for Tennis Set Predictor
 * Separate ATP/WTA tables for clean data separation
 */

export const schema = `
-- =============================================
-- PLAYERS TABLES (ATP/WTA)
-- =============================================

CREATE TABLE IF NOT EXISTS atp_players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  hand TEXT CHECK(hand IN ('R', 'L', 'U')),
  birth_year INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wta_players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  hand TEXT CHECK(hand IN ('R', 'L', 'U')),
  birth_year INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- MATCHES TABLES (ATP/WTA)
-- =============================================

CREATE TABLE IF NOT EXISTS atp_matches (
  match_id TEXT PRIMARY KEY,
  tour TEXT DEFAULT 'ATP',
  date TEXT NOT NULL,
  tournament TEXT NOT NULL,
  tournament_level TEXT, -- G=Grand Slam, M=Masters, A=ATP500, etc
  surface TEXT CHECK(surface IN ('Hard', 'Clay', 'Grass', 'Carpet')),
  indoor INTEGER DEFAULT 0,
  round TEXT,
  best_of INTEGER DEFAULT 3,
  
  -- Players
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  winner_id TEXT,
  
  -- Score
  score TEXT, -- e.g., "6-4 7-6(3) 6-2"
  sets_p1 INTEGER,
  sets_p2 INTEGER,
  games_p1 INTEGER,
  games_p2 INTEGER,
  
  -- Set-by-set scores (for Set 1 analysis)
  set1_p1 INTEGER,
  set1_p2 INTEGER,
  set2_p1 INTEGER,
  set2_p2 INTEGER,
  set3_p1 INTEGER,
  set3_p2 INTEGER,
  set4_p1 INTEGER,
  set4_p2 INTEGER,
  set5_p1 INTEGER,
  set5_p2 INTEGER,
  
  -- Serve stats (Player 1)
  p1_aces INTEGER,
  p1_double_faults INTEGER,
  p1_first_serve_pct REAL,
  p1_first_serve_won_pct REAL,
  p1_second_serve_won_pct REAL,
  p1_break_points_saved_pct REAL,
  p1_service_games_won INTEGER,
  p1_service_games_total INTEGER,
  
  -- Return stats (Player 1)
  p1_first_return_won_pct REAL,
  p1_second_return_won_pct REAL,
  p1_break_points_won_pct REAL,
  p1_return_games_won INTEGER,
  p1_return_games_total INTEGER,
  
  -- Serve stats (Player 2)
  p2_aces INTEGER,
  p2_double_faults INTEGER,
  p2_first_serve_pct REAL,
  p2_first_serve_won_pct REAL,
  p2_second_serve_won_pct REAL,
  p2_break_points_saved_pct REAL,
  p2_service_games_won INTEGER,
  p2_service_games_total INTEGER,
  
  -- Return stats (Player 2)
  p2_first_return_won_pct REAL,
  p2_second_return_won_pct REAL,
  p2_break_points_won_pct REAL,
  p2_return_games_won INTEGER,
  p2_return_games_total INTEGER,
  
  -- Metadata
  minutes INTEGER,
  retirement INTEGER DEFAULT 0,
  walkover INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player1_id) REFERENCES atp_players(player_id),
  FOREIGN KEY (player2_id) REFERENCES atp_players(player_id)
);

CREATE TABLE IF NOT EXISTS wta_matches (
  match_id TEXT PRIMARY KEY,
  tour TEXT DEFAULT 'WTA',
  date TEXT NOT NULL,
  tournament TEXT NOT NULL,
  tournament_level TEXT, -- G=Grand Slam, P=Premier, etc
  surface TEXT CHECK(surface IN ('Hard', 'Clay', 'Grass', 'Carpet')),
  indoor INTEGER DEFAULT 0,
  round TEXT,
  best_of INTEGER DEFAULT 3,
  
  -- Players
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  winner_id TEXT,
  
  -- Score
  score TEXT,
  sets_p1 INTEGER,
  sets_p2 INTEGER,
  games_p1 INTEGER,
  games_p2 INTEGER,
  
  -- Set-by-set scores
  set1_p1 INTEGER,
  set1_p2 INTEGER,
  set2_p1 INTEGER,
  set2_p2 INTEGER,
  set3_p1 INTEGER,
  set3_p2 INTEGER,
  
  -- Serve stats (Player 1)
  p1_aces INTEGER,
  p1_double_faults INTEGER,
  p1_first_serve_pct REAL,
  p1_first_serve_won_pct REAL,
  p1_second_serve_won_pct REAL,
  p1_break_points_saved_pct REAL,
  p1_service_games_won INTEGER,
  p1_service_games_total INTEGER,
  
  -- Return stats (Player 1)
  p1_first_return_won_pct REAL,
  p1_second_return_won_pct REAL,
  p1_break_points_won_pct REAL,
  p1_return_games_won INTEGER,
  p1_return_games_total INTEGER,
  
  -- Serve stats (Player 2)
  p2_aces INTEGER,
  p2_double_faults INTEGER,
  p2_first_serve_pct REAL,
  p2_first_serve_won_pct REAL,
  p2_second_serve_won_pct REAL,
  p2_break_points_saved_pct REAL,
  p2_service_games_won INTEGER,
  p2_service_games_total INTEGER,
  
  -- Return stats (Player 2)
  p2_first_return_won_pct REAL,
  p2_second_return_won_pct REAL,
  p2_break_points_won_pct REAL,
  p2_return_games_won INTEGER,
  p2_return_games_total INTEGER,
  
  -- Metadata
  minutes INTEGER,
  retirement INTEGER DEFAULT 0,
  walkover INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player1_id) REFERENCES wta_players(player_id),
  FOREIGN KEY (player2_id) REFERENCES wta_players(player_id)
);

-- =============================================
-- ODDS TABLES (ATP/WTA)
-- =============================================

CREATE TABLE IF NOT EXISTS atp_odds (
  odds_id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  source TEXT DEFAULT 'pinnacle',
  
  -- Match winner odds
  ml_p1 REAL, -- Money line (decimal odds) player 1
  ml_p2 REAL, -- Money line (decimal odds) player 2
  
  -- Set 1 winner odds
  set1_p1 REAL,
  set1_p2 REAL,
  
  -- Implied probabilities (for reference)
  implied_p1 REAL,
  implied_p2 REAL,
  implied_set1_p1 REAL,
  implied_set1_p2 REAL,
  
  -- Vig/juice calculation
  vig REAL,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (match_id) REFERENCES atp_matches(match_id)
);

CREATE TABLE IF NOT EXISTS wta_odds (
  odds_id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  source TEXT DEFAULT 'pinnacle',
  
  -- Match winner odds
  ml_p1 REAL,
  ml_p2 REAL,
  
  -- Set 1 winner odds
  set1_p1 REAL,
  set1_p2 REAL,
  
  -- Implied probabilities
  implied_p1 REAL,
  implied_p2 REAL,
  implied_set1_p1 REAL,
  implied_set1_p2 REAL,
  
  -- Vig
  vig REAL,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (match_id) REFERENCES wta_matches(match_id)
);

-- =============================================
-- ELO RATINGS TABLES (ATP/WTA)
-- =============================================

CREATE TABLE IF NOT EXISTS atp_elo_ratings (
  rating_id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  date TEXT NOT NULL,
  
  -- Global Elo
  elo_global REAL DEFAULT 1500,
  
  -- Surface-specific Elo
  elo_hard REAL DEFAULT 1500,
  elo_clay REAL DEFAULT 1500,
  elo_grass REAL DEFAULT 1500,
  
  -- Match counts for confidence
  matches_global INTEGER DEFAULT 0,
  matches_hard INTEGER DEFAULT 0,
  matches_clay INTEGER DEFAULT 0,
  matches_grass INTEGER DEFAULT 0,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES atp_players(player_id)
);

CREATE TABLE IF NOT EXISTS wta_elo_ratings (
  rating_id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  date TEXT NOT NULL,
  
  elo_global REAL DEFAULT 1500,
  elo_hard REAL DEFAULT 1500,
  elo_clay REAL DEFAULT 1500,
  elo_grass REAL DEFAULT 1500,
  
  matches_global INTEGER DEFAULT 0,
  matches_hard INTEGER DEFAULT 0,
  matches_clay INTEGER DEFAULT 0,
  matches_grass INTEGER DEFAULT 0,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES wta_players(player_id)
);

-- =============================================
-- PLAYER SKILLS (Bayesian Point Model)
-- =============================================

CREATE TABLE IF NOT EXISTS atp_player_skills (
  skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  date TEXT NOT NULL,
  surface TEXT,
  
  -- Serve skills (mean, variance for Bayesian)
  serve_skill_mean REAL DEFAULT 0.65,
  serve_skill_var REAL DEFAULT 0.01,
  first_serve_pct_mean REAL DEFAULT 0.62,
  first_serve_won_mean REAL DEFAULT 0.73,
  second_serve_won_mean REAL DEFAULT 0.52,
  
  -- Return skills
  return_skill_mean REAL DEFAULT 0.35,
  return_skill_var REAL DEFAULT 0.01,
  first_return_won_mean REAL DEFAULT 0.27,
  second_return_won_mean REAL DEFAULT 0.48,
  
  -- Sample size for regularization
  serve_n INTEGER DEFAULT 0,
  return_n INTEGER DEFAULT 0,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES atp_players(player_id)
);

CREATE TABLE IF NOT EXISTS wta_player_skills (
  skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  date TEXT NOT NULL,
  surface TEXT,
  
  -- Serve skills (WTA-specific defaults)
  serve_skill_mean REAL DEFAULT 0.58,
  serve_skill_var REAL DEFAULT 0.02,
  first_serve_pct_mean REAL DEFAULT 0.60,
  first_serve_won_mean REAL DEFAULT 0.65,
  second_serve_won_mean REAL DEFAULT 0.45, -- Lower for WTA
  
  -- Double fault rate (important for WTA)
  double_fault_rate_mean REAL DEFAULT 0.05,
  double_fault_rate_var REAL DEFAULT 0.01,
  
  -- Return skills (stronger in WTA)
  return_skill_mean REAL DEFAULT 0.42,
  return_skill_var REAL DEFAULT 0.02,
  first_return_won_mean REAL DEFAULT 0.35,
  second_return_won_mean REAL DEFAULT 0.55,
  
  serve_n INTEGER DEFAULT 0,
  return_n INTEGER DEFAULT 0,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES wta_players(player_id)
);

-- =============================================
-- PREDICTIONS & RESULTS (for backtesting)
-- =============================================

CREATE TABLE IF NOT EXISTS predictions (
  prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  tour TEXT NOT NULL CHECK(tour IN ('ATP', 'WTA')),
  timestamp TEXT NOT NULL,
  
  -- Model predictions
  p_match_p1 REAL, -- P(Player 1 wins match)
  p_set1_p1 REAL,  -- P(Player 1 wins Set 1)
  
  -- Component predictions
  p_elo_p1 REAL,
  p_point_model_p1 REAL,
  p_ensemble_p1 REAL,
  
  -- Confidence bands
  p_match_lower REAL,
  p_match_upper REAL,
  p_set1_lower REAL,
  p_set1_upper REAL,
  
  -- Fair odds
  fair_ml_p1 REAL,
  fair_ml_p2 REAL,
  fair_set1_p1 REAL,
  fair_set1_p2 REAL,
  
  -- Market odds (at prediction time)
  market_ml_p1 REAL,
  market_ml_p2 REAL,
  market_set1_p1 REAL,
  market_set1_p2 REAL,
  
  -- Edge calculations
  edge_ml_p1 REAL,
  edge_ml_p2 REAL,
  edge_set1_p1 REAL,
  edge_set1_p2 REAL,
  
  -- Bet decision
  bet_side TEXT, -- 'P1_ML', 'P2_ML', 'P1_SET1', 'P2_SET1', 'PASS'
  bet_units REAL,
  kelly_fraction REAL,
  
  -- Why explanation
  explanation TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backtest_results (
  result_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  prediction_id INTEGER,
  match_id TEXT NOT NULL,
  tour TEXT NOT NULL,
  
  -- Actual outcomes
  actual_winner TEXT,
  actual_set1_winner TEXT,
  
  -- Prediction accuracy
  match_correct INTEGER,
  set1_correct INTEGER,
  
  -- Financial results
  bet_placed INTEGER,
  stake REAL,
  odds_taken REAL,
  pnl REAL,
  roi REAL,
  
  -- Model metrics
  log_loss_match REAL,
  log_loss_set1 REAL,
  brier_match REAL,
  brier_set1 REAL,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_atp_matches_date ON atp_matches(date);
CREATE INDEX IF NOT EXISTS idx_atp_matches_surface ON atp_matches(surface);
CREATE INDEX IF NOT EXISTS idx_atp_matches_players ON atp_matches(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_wta_matches_date ON wta_matches(date);
CREATE INDEX IF NOT EXISTS idx_wta_matches_surface ON wta_matches(surface);
CREATE INDEX IF NOT EXISTS idx_wta_matches_players ON wta_matches(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_atp_elo_player_date ON atp_elo_ratings(player_id, date);
CREATE INDEX IF NOT EXISTS idx_wta_elo_player_date ON wta_elo_ratings(player_id, date);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_backtest_run ON backtest_results(run_id);
`;

export default schema;
