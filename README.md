# Tennis Set Predictor 🎾

A comprehensive tennis match prediction system combining:
- **Surface-Specific Elo Ratings** with time decay
- **Bayesian Serve/Return Skill Model** with regularization
- **Markov Chain Tennis Scoring Engine**
- **Ensemble Calibration** optimizing log loss
- **Walk-Forward Backtesting Framework**

## Features

### Prediction Models
- **Elo Engine**: Global + surface-specific (Hard/Clay/Grass) ratings with weighted blending
- **Point Skill Model**: Bayesian estimation of serve/return skills with surface conditioning
- **Scoring Engine**: Full Markov probability calculations (Point → Game → Set → Match)
- **Ensemble Calibration**: Logistic combination of Elo + Point model, optimized for log loss

### Betting Workflow
- Fair odds calculation from model probabilities
- Edge calculation vs market odds
- Conservative thresholds: ≥4% Set 1, ≥3% Match
- Fractional Kelly sizing (¼ Kelly, 1% bankroll cap)
- "Why" explanations (3 bullets max)

### Data Architecture
- Separate ATP/WTA tables and models
- Match data: scores, serve/return stats
- Odds data: ML + Set 1 with timestamps
- Full backtest results tracking

## Quick Start

### 1. Install Dependencies

```bash
cd tennis-predictor
npm install
```

### 2. Initialize Database & Generate Sample Data

```bash
npm run init-db
npm run generate-sample-data
```

This creates realistic simulated data for testing since we don't have real odds feeds.

### 3. Start the API Server

```bash
npm run dev
```

Server runs on http://localhost:3001

### 4. Start the Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000

## API Endpoints

### Players
- `GET /api/:tour/players` - List all players
- `GET /api/:tour/players/:id` - Get player with skills

### Matches
- `GET /api/:tour/matches` - List matches (query: start, end, surface)
- `GET /api/:tour/h2h/:p1/:p2` - Head-to-head record

### Predictions
- `POST /api/:tour/predict` - Generate prediction
  ```json
  {
    "match": {
      "player1_id": "atp_carlos_alcaraz",
      "player2_id": "atp_jannik_sinner",
      "surface": "Hard",
      "best_of": 3
    },
    "marketOdds": {
      "ml_p1": 1.65,
      "ml_p2": 2.20,
      "set1_p1": 1.75,
      "set1_p2": 2.05
    }
  }
  ```

### Ratings
- `GET /api/:tour/ratings?surface=Hard&limit=20` - Elo leaderboard

### Training & Backtest
- `POST /api/:tour/train` - Train models on all data
- `POST /api/:tour/backtest` - Run walk-forward backtest

## Project Structure

```
tennis-predictor/
├── src/
│   ├── db/
│   │   ├── schema.js         # SQLite schema
│   │   └── database.js       # DB operations
│   ├── models/
│   │   ├── elo-engine.js     # Surface-specific Elo
│   │   ├── point-skill-model.js  # Bayesian skills
│   │   └── predictor.js      # Main orchestrator
│   ├── engine/
│   │   └── scoring-engine.js # Markov probability
│   ├── calibration/
│   │   └── ensemble.js       # Log loss calibration
│   ├── backtest/
│   │   └── backtester.js     # Walk-forward testing
│   ├── api/
│   │   └── server.js         # Express API
│   └── index.js              # Entry point
├── frontend/
│   └── src/
│       ├── App.jsx           # Main app
│       └── components/       # React components
├── scripts/
│   ├── init-db.js
│   ├── generate-sample-data.js
│   └── run-backtest.js
└── data/
    └── tennis.db             # SQLite database
```

## Key Algorithms

### Elo Engine
```javascript
// Expected score
E(A) = 1 / (1 + 10^((R_B - R_A) / 400))

// Rating update
R'_A = R_A + K * (S - E)

// Surface blending
R_eff = w * R_surface + (1-w) * R_global
```

### Game/Set/Match Probabilities
```javascript
// P(win game) from P(win point on serve)
P(game) = p^4 + 4p^4q + 10p^4q^2 + 20p^3q^3 * P(deuce)

// P(win at deuce)
P(deuce) = p^2 / (p^2 + q^2)
```

### Kelly Criterion
```javascript
// Full Kelly
f* = (b*p - q) / b

// Fractional Kelly (¼)
stake = f* * 0.25

// Capped at 1% bankroll
```

## Thresholds

| Metric | Threshold |
|--------|-----------|
| Min Match Edge | ≥3% |
| Min Set 1 Edge | ≥4% |
| Kelly Fraction | ¼ (25%) |
| Max Stake | 1% bankroll |
| Elo K-factor | 12-48 (dynamic) |

## Model Calibration

The ensemble combines Elo and Point-based probabilities:

```
logit(P_final) = β₀ + β₁·logit(P_elo) + β₂·logit(P_point)
```

Fitted via gradient descent minimizing log loss with L2 regularization.

## Backtesting

Walk-forward validation ensures no look-ahead bias:
1. Train on matches 1...N
2. Predict match N+1
3. Repeat

Metrics tracked:
- Log loss (primary)
- Brier score
- ROI on bets placed
- Win rate
- Price improvement vs closing line

## ATP vs WTA Differences

| Aspect | ATP | WTA |
|--------|-----|-----|
| Serve skill prior | 0.65 | 0.58 |
| Return skill prior | 0.35 | 0.42 |
| 2nd serve won | 52% | 45% |
| Double fault rate | 3% | 5% |

The WTA model emphasizes 2nd serve weakness and break opportunities.

## License

MIT

## Future Improvements

- Real odds feed integration (licensed data)
- Live/in-play predictions
- Player injury/fatigue modeling
- Tournament draw analysis
- Machine learning ensemble (XGBoost, etc.)
- PostgreSQL for production scale
