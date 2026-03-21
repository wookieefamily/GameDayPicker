// Proxy for ESPN's public (undocumented) API — no API key required.
// Supported actions:
//   GET /api/schedule?action=teams&league=mlb
//   GET /api/schedule?action=games&league=mlb&teamId=28&season=2026

const LEAGUES = {
  // Men's
  mlb:   { sport: "baseball",    league: "mlb",                         label: "MLB" },
  nfl:   { sport: "football",    league: "nfl",                         label: "NFL" },
  nba:   { sport: "basketball",  league: "nba",                         label: "NBA" },
  nhl:   { sport: "hockey",      league: "nhl",                         label: "NHL" },
  mls:   { sport: "soccer",      league: "usa.1",                       label: "MLS" },
  ncaaf: { sport: "football",    league: "college-football",            label: "College Football" },
  ncaab: { sport: "basketball",  league: "mens-college-basketball",     label: "College Basketball" },
  // Women's
  wnba:  { sport: "basketball",  league: "wnba",                        label: "WNBA" },
  nwsl:  { sport: "soccer",      league: "usa.nwsl",                    label: "NWSL" },
  pwhl:  { sport: "hockey",      league: "pwhl",                        label: "PWHL" },
  wcbb:  { sport: "basketball",  league: "womens-college-basketball",   label: "Women's College Basketball" },
  wncaas:{ sport: "soccer",      league: "womens.college.soccer.ng",    label: "Women's College Soccer" },
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600",
  };

  const params = event.queryStringParameters || {};
  const { action, league: leagueKey, teamId, season, teamAbbr, debug } = params;

  const cfg = LEAGUES[leagueKey];
  if (!cfg) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown league: ${leagueKey}` }) };
  }

  // ── PWHL (uses HockeyTech API, not ESPN) ─────────────────────────────
  if (leagueKey === "pwhl") {
    const PWHL_TEAMS = [
      { id: "1", name: "Boston Fleet",         abbreviation: "BOS", location: "Boston" },
      { id: "4", name: "Minnesota Frost",      abbreviation: "MIN", location: "Minnesota" },
      { id: "3", name: "Montréal Victoire",    abbreviation: "MTL", location: "Montréal" },
      { id: "2", name: "New York Sirens",      abbreviation: "NY",  location: "New York" },
      { id: "5", name: "Ottawa Charge",        abbreviation: "OTT", location: "Ottawa" },
      { id: "9", name: "Seattle Torrent",      abbreviation: "SEA", location: "Seattle" },
      { id: "6", name: "Toronto Sceptres",     abbreviation: "TOR", location: "Toronto" },
      { id: "8", name: "Vancouver Goldeneyes", abbreviation: "VAN", location: "Vancouver" },
    ];

    if (action === "teams") {
      return { statusCode: 200, headers, body: JSON.stringify({ teams: PWHL_TEAMS }) };
    }

    if (action === "games") {
      if (!teamId) return { statusCode: 400, headers, body: JSON.stringify({ error: "teamId required" }) };
      // PWHL seasons: 2023-24=3, 2024-25=5, 2025-26=7 (increments of 2 per year from season 5 at 2025)
      const yr = parseInt(season || String(new Date().getFullYear()));
      const seasonId = Math.max(3, (yr - 2025) * 2 + 5);
      const url = `https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&key=446521baf8c38984&fmt=json&client_code=pwhl&lang=en&season_id=${seasonId}&team_id=${teamId}`;
      const res = await fetch(url);
      if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: "PWHL API request failed" }) };
      const data = await res.json();
      const schedule = data?.SiteKit?.Schedule ?? [];
      const games = schedule.map(g => ({
        id:          g.game_id,
        utcDate:     g.GameDateISO8601,
        opponent:    String(g.home_team) === String(teamId) ? g.visiting_team_name : g.home_team_name,
        homeAway:    String(g.home_team) === String(teamId) ? "home" : "away",
        neutralSite: false,
        venue:       g.venue_name ?? "",
        status:      g.game_status ?? "",
      })).filter(g => g.utcDate);
      return { statusCode: 200, headers, body: JSON.stringify({ games }) };
    }
  }

  const base = `${ESPN}/${cfg.sport}/${cfg.league}`;

  // ── teams ────────────────────────────────────────────────────────────
  if (action === "teams") {
    const limit = ["ncaaf","ncaab"].includes(leagueKey) ? 500 : 100;
    const res  = await fetch(`${base}/teams?limit=${limit}`);
    if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: "ESPN request failed" }) };

    const data = await res.json();
    const raw  = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];

    const teams = raw.map(({ team: t }) => ({
      id:           t.id,
      name:         t.displayName,
      abbreviation: t.abbreviation,
      location:     t.location,
    })).sort((a, b) => a.name.localeCompare(b.name));

    return { statusCode: 200, headers, body: JSON.stringify({ teams }) };
  }

  // ── games ────────────────────────────────────────────────────────────
  if (action === "games") {
    if (!teamId) return { statusCode: 400, headers, body: JSON.stringify({ error: "teamId required" }) };

    const yr  = season || String(new Date().getFullYear());
    // seasontype=2 = regular season (1=preseason/spring training, 3=postseason)
    const res = await fetch(`${base}/teams/${teamId}/schedule?season=${yr}&seasontype=2`);
    if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: "ESPN request failed" }) };

    const data   = await res.json();
    const events = data?.events ?? [];

    const games = events.map(ev => {
      const comp  = ev.competitions?.[0] ?? {};
      const comps = comp.competitors ?? [];
      const home  = comps.find(c => c.homeAway === "home");
      const away  = comps.find(c => c.homeAway === "away");

      // Figure out which side our team is on.
      // Try multiple match strategies — ESPN can use different ID formats across leagues.
      const isOurs = c =>
        String(c.team?.id) === String(teamId) ||
        String(c.id)       === String(teamId) ||
        (teamAbbr && c.team?.abbreviation?.toUpperCase() === teamAbbr.toUpperCase());

      const ourSide   = comps.find(isOurs) ?? home;
      const otherSide = comps.find(c => !isOurs(c)) ?? away;
      const homeAway   = ourSide?.homeAway ?? "home";
      const opponent   = otherSide?.team?.displayName ?? "TBD";

      return {
        id:          ev.id,
        utcDate:     ev.date,          // ISO 8601 UTC string
        opponent,
        homeAway,
        neutralSite: comp.neutralSite ?? false,
        venue:       comp.venue?.fullName ?? "",
        status:      comp.status?.type?.description ?? "",
      };
    }).filter(g => g.utcDate); // drop games without a scheduled date

    // ?debug=1 returns raw competitor info for diagnosis
    if (debug) {
      const raw = events.slice(0, 5).map(ev => {
        const comp  = ev.competitions?.[0] ?? {};
        const comps = comp.competitors ?? [];
        return {
          date: ev.date,
          venue: comp.venue?.fullName,
          competitors: comps.map(c => ({
            homeAway: c.homeAway,
            id: c.id,
            teamId: c.team?.id,
            teamAbbr: c.team?.abbreviation,
            teamName: c.team?.displayName,
          })),
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ teamId, teamAbbr, raw }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ games }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: "action must be 'teams' or 'games'" }) };
};
