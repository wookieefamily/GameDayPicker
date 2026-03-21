// Proxy for ESPN's public (undocumented) API — no API key required.
// Supported actions:
//   GET /api/schedule?action=teams&league=mlb
//   GET /api/schedule?action=games&league=mlb&teamId=28&season=2026

const LEAGUES = {
  mlb:   { sport: "baseball",    league: "mlb",                       label: "MLB" },
  nfl:   { sport: "football",    league: "nfl",                       label: "NFL" },
  nba:   { sport: "basketball",  league: "nba",                       label: "NBA" },
  nhl:   { sport: "hockey",      league: "nhl",                       label: "NHL" },
  ncaaf: { sport: "football",    league: "college-football",          label: "College Football" },
  ncaab: { sport: "basketball",  league: "mens-college-basketball",   label: "College Basketball" },
  mls:   { sport: "soccer",      league: "usa.1",                     label: "MLS" },
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600",
  };

  const params = event.queryStringParameters || {};
  const { action, league: leagueKey, teamId, season } = params;

  const cfg = LEAGUES[leagueKey];
  if (!cfg) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown league: ${leagueKey}` }) };
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

      // Figure out which side our team is on
      const ourSide    = comps.find(c => String(c.team?.id) === String(teamId)) ?? home;
      const otherSide  = comps.find(c => String(c.team?.id) !== String(teamId)) ?? away;
      const homeAway   = ourSide?.homeAway ?? "home";
      const opponent   = otherSide?.team?.displayName ?? "TBD";

      return {
        id:       ev.id,
        utcDate:  ev.date,          // ISO 8601 UTC string
        opponent,
        homeAway,
        venue:    comp.venue?.fullName ?? "",
        status:   comp.status?.type?.description ?? "",
      };
    }).filter(g => g.utcDate); // drop games without a scheduled date

    return { statusCode: 200, headers, body: JSON.stringify({ games }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: "action must be 'teams' or 'games'" }) };
};
