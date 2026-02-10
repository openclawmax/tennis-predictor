/**
 * The Odds API integration for fetching live tennis matches and odds
 */

export class OddsFetcher {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.the-odds-api.com/v4';
  }

  /**
   * Get all active tennis sports
   */
  async getActiveTennisSports() {
    const url = `${this.baseUrl}/sports/?apiKey=${this.apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const sports = await response.json();
    return sports.filter(s => s.group === 'Tennis' && s.active);
  }

  /**
   * Fetch matches for a specific sport
   */
  async fetchMatchesForSport(sportKey) {
    const regions = 'us,uk,eu';
    const markets = 'h2h';
    const oddsFormat = 'decimal';
    const url = `${this.baseUrl}/sports/${sportKey}/odds/?apiKey=${this.apiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${sportKey}: ${response.status}`);
      return [];
    }
    return await response.json();
  }

  /**
   * Fetch upcoming tennis matches with odds
   */
  async fetchTennisMatches() {
    console.log('Finding active tennis tournaments...');
    const tennisSports = await this.getActiveTennisSports();
    console.log(`Found ${tennisSports.length} active tennis tournaments`);
    
    let allMatches = [];
    for (const sport of tennisSports) {
      const matches = await this.fetchMatchesForSport(sport.key);
      console.log(`${sport.title}: ${matches.length} matches`);
      allMatches = allMatches.concat(matches);
    }
    
    return allMatches;
  }

  /**
   * Fetch WTA matches
   */
  async fetchWTAMatches() {
    const tennisSports = await this.getActiveTennisSports();
    const wtaSports = tennisSports.filter(s => s.title.toLowerCase().includes('wta'));
    
    let allMatches = [];
    for (const sport of wtaSports) {
      const matches = await this.fetchMatchesForSport(sport.key);
      allMatches = allMatches.concat(matches);
    }
    return allMatches;
  }

  /**
   * Parse API response into our database format
   */
  parseMatches(apiData, tour = 'atp') {
    const matches = [];

    for (const match of apiData) {
      const teams = match.home_team && match.away_team ? 
        [match.home_team, match.away_team] : 
        (match.title || '').split(' v ');

      if (teams.length !== 2 || !teams[0] || !teams[1]) {
        console.warn('Could not parse teams from:', JSON.stringify(match));
        continue;
      }

      const [player1Name, player2Name] = teams;
      
      if (!player1Name || !player2Name) {
        console.warn('Empty player names:', teams);
        continue;
      }

      // Get best odds from bookmakers
      const bookmakers = match.bookmakers || [];
      let bestOddsP1 = null;
      let bestOddsP2 = null;
      let bookmakerName = null;

      for (const bookmaker of bookmakers) {
        const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
        if (h2hMarket && h2hMarket.outcomes) {
          const p1Odds = h2hMarket.outcomes[0]?.price;
          const p2Odds = h2hMarket.outcomes[1]?.price;
          
          if (p1Odds && (!bestOddsP1 || p1Odds > bestOddsP1)) {
            bestOddsP1 = p1Odds;
            bestOddsP2 = p2Odds;
            bookmakerName = bookmaker.title;
          }
        }
      }

      matches.push({
        id: match.id,
        player1_name: player1Name.trim(),
        player2_name: player2Name.trim(),
        commence_time: match.commence_time,
        tour: tour.toUpperCase(),
        surface: 'Hard', // Default, would need to enrich with tournament data
        best_of: 3, // Default
        ml_p1: bestOddsP1,
        ml_p2: bestOddsP2,
        bookmaker: bookmakerName,
        raw_data: match
      });
    }

    return matches;
  }

  /**
   * Check remaining quota
   */
  async checkQuota() {
    // The Odds API returns quota info in response headers
    const url = `${this.baseUrl}/sports/?apiKey=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      const remaining = response.headers.get('x-requests-remaining');
      const used = response.headers.get('x-requests-used');
      
      return {
        remaining: remaining ? parseInt(remaining) : null,
        used: used ? parseInt(used) : null
      };
    } catch (error) {
      console.error('Error checking quota:', error);
      return { remaining: null, used: null };
    }
  }
}

export default OddsFetcher;
